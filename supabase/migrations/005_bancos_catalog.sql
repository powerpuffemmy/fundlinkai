-- ============================================
-- FUNDLINK: Catálogo oficial de bancos guatemaltecos
-- Migration 005
-- ============================================
-- Arquitectura nueva:
--   bancos         → catálogo de los 19 bancos del sistema guatemalteco
--   users.banco_catalog_id → vincula usuario bancario a su banco en catálogo
--   cliente_banco_limites.banco_id → ahora FK a bancos(id), no a users(id)
-- ============================================

-- =====================
-- 1. Tabla catálogo de bancos
-- =====================
CREATE TABLE IF NOT EXISTS bancos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bancos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bancos_select_todos" ON bancos FOR SELECT USING (true);
CREATE POLICY "bancos_webadmin_all" ON bancos FOR ALL USING (get_user_role() = 'webadmin');

-- =====================
-- 2. Insertar todos los bancos que operan en Guatemala
-- =====================
INSERT INTO bancos (nombre) VALUES
  ('EL CREDITO HIPOTECARIO NACIONAL DE GUATEMALA'),
  ('BANCO CUSCATLAN GUATEMALA, S. A.'),
  ('BANCO DE LOS TRABAJADORES'),
  ('BANCO INDUSTRIAL, S. A.'),
  ('BANCO DE DESARROLLO RURAL, S. A.'),
  ('BANCO INTERNACIONAL, S. A.'),
  ('CITIBANK, N.A., SUCURSAL GUATEMALA'),
  ('VIVIBANCO, S. A.'),
  ('BANCO FICOHSA GUATEMALA, S. A.'),
  ('BANCO PROMERICA, S. A.'),
  ('BANCO DE ANTIGUA, S. A.'),
  ('BANCO DE AMERICA CENTRAL, S. A.'),
  ('BANCO AGROMERCANTIL DE GUATEMALA, S. A.'),
  ('BANCO G&T CONTINENTAL, S. A.'),
  ('BANCO AZTECA DE GUATEMALA, S. A.'),
  ('BANCO INV, S. A.'),
  ('BANCO CREDICORP, S. A.'),
  ('BANCO NEXA, S. A.'),
  ('BANCO MULTIMONEY, S. A.')
ON CONFLICT (nombre) DO NOTHING;

-- =====================
-- 3. Agregar banco_catalog_id a users
-- =====================
ALTER TABLE users ADD COLUMN IF NOT EXISTS banco_catalog_id uuid REFERENCES bancos(id);

-- Mapear usuarios de bancos existentes al catálogo
UPDATE users SET banco_catalog_id = (SELECT id FROM bancos WHERE nombre = 'BANCO INDUSTRIAL, S. A.')
  WHERE entidad = 'Banco Industrial' AND role IN ('banco_admin','banco_mesa','banco_auditor');
UPDATE users SET banco_catalog_id = (SELECT id FROM bancos WHERE nombre = 'BANCO G&T CONTINENTAL, S. A.')
  WHERE entidad = 'Banco G&T Continental' AND role IN ('banco_admin','banco_mesa','banco_auditor');
UPDATE users SET banco_catalog_id = (SELECT id FROM bancos WHERE nombre = 'BANCO DE AMERICA CENTRAL, S. A.')
  WHERE entidad = 'BAC Credomatic' AND role IN ('banco_admin','banco_mesa','banco_auditor');
UPDATE users SET banco_catalog_id = (SELECT id FROM bancos WHERE nombre = 'BANCO AZTECA DE GUATEMALA, S. A.')
  WHERE entidad = 'Banco Azteca' AND role IN ('banco_admin','banco_mesa','banco_auditor');
UPDATE users SET banco_catalog_id = (SELECT id FROM bancos WHERE nombre = 'BANCO AGROMERCANTIL DE GUATEMALA, S. A.')
  WHERE entidad = 'Banco Agromercantil' AND role IN ('banco_admin','banco_mesa','banco_auditor');

-- =====================
-- 4. Migrar cliente_banco_limites.banco_id → catálogo
-- =====================

-- Columna temporal
ALTER TABLE cliente_banco_limites ADD COLUMN IF NOT EXISTS _bcid uuid;

-- Poblar desde users
UPDATE cliente_banco_limites cbl
SET _bcid = u.banco_catalog_id
FROM users u
WHERE u.id = cbl.banco_id AND u.banco_catalog_id IS NOT NULL;

-- Deduplicar: 1 fila por (cliente_id, catalog_bank)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY cliente_id, _bcid
      ORDER BY limite_monto DESC, created_at
    ) as rn
  FROM cliente_banco_limites WHERE _bcid IS NOT NULL
)
DELETE FROM cliente_banco_limites WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Cambiar FK: eliminar FK a users, poner FK a bancos
ALTER TABLE cliente_banco_limites DROP CONSTRAINT IF EXISTS cliente_banco_limites_banco_id_fkey;
UPDATE cliente_banco_limites SET banco_id = _bcid WHERE _bcid IS NOT NULL;
DELETE FROM cliente_banco_limites WHERE banco_id NOT IN (SELECT id FROM bancos);
ALTER TABLE cliente_banco_limites
  ADD CONSTRAINT cliente_banco_limites_banco_id_fkey FOREIGN KEY (banco_id) REFERENCES bancos(id);

-- Unique constraint
ALTER TABLE cliente_banco_limites DROP CONSTRAINT IF EXISTS cliente_banco_limites_cliente_banco_unique;
ALTER TABLE cliente_banco_limites ADD CONSTRAINT cliente_banco_limites_cliente_banco_unique UNIQUE (cliente_id, banco_id);

-- Limpiar columna temporal
ALTER TABLE cliente_banco_limites DROP COLUMN IF EXISTS _bcid;

-- =====================
-- 5. Actualizar validate_oferta para usar banco_catalog_id
-- =====================
CREATE OR REPLACE FUNCTION validate_oferta()
RETURNS TRIGGER AS $func$
DECLARE
  v_subasta RECORD;
  v_limite RECORD;
  v_tiene_oferta BOOLEAN;
  v_banco_catalog_id uuid;
BEGIN
  SELECT * INTO v_subasta FROM subastas WHERE id = NEW.subasta_id;
  IF v_subasta IS NULL THEN RAISE EXCEPTION 'La subasta no existe'; END IF;
  IF v_subasta.estado != 'abierta' THEN RAISE EXCEPTION 'La subasta no está abierta para ofertas'; END IF;
  IF v_subasta.expires_at < NOW() THEN RAISE EXCEPTION 'La subasta ha expirado'; END IF;
  IF NEW.tasa <= 0 OR NEW.tasa > 50 THEN RAISE EXCEPTION 'La tasa debe estar entre 0 y 50%%'; END IF;

  SELECT banco_catalog_id INTO v_banco_catalog_id FROM users WHERE id = NEW.banco_id;

  SELECT * INTO v_limite
  FROM cliente_banco_limites
  WHERE cliente_id = v_subasta.cliente_id
    AND banco_id = v_banco_catalog_id
    AND activo = true;

  IF v_limite IS NULL THEN RAISE EXCEPTION 'No tiene línea de crédito activa con este cliente'; END IF;
  IF (v_limite.limite_monto - v_limite.monto_utilizado) < v_subasta.monto THEN
    RAISE EXCEPTION 'Límite de crédito insuficiente para esta operación';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS (
      SELECT 1 FROM ofertas o
      INNER JOIN users u ON u.id = o.banco_id
      WHERE o.subasta_id = NEW.subasta_id
        AND u.banco_catalog_id = v_banco_catalog_id
    ) INTO v_tiene_oferta;
    IF v_tiene_oferta THEN RAISE EXCEPTION 'Ya tiene una oferta en esta subasta'; END IF;
  END IF;

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- =====================
-- 6. Actualizar update_limite_utilizado para usar banco_catalog_id
-- =====================
CREATE OR REPLACE FUNCTION update_limite_utilizado()
RETURNS TRIGGER AS $func$
DECLARE
  v_banco_catalog_id uuid;
BEGIN
  SELECT banco_catalog_id INTO v_banco_catalog_id FROM users WHERE id = NEW.banco_id;

  IF TG_OP = 'INSERT' AND NEW.estado = 'vigente' THEN
    UPDATE cliente_banco_limites
    SET monto_utilizado = monto_utilizado + NEW.monto, updated_at = NOW()
    WHERE cliente_id = NEW.cliente_id AND banco_id = v_banco_catalog_id;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.estado = 'vigente' AND NEW.estado IN ('vencido', 'cancelado') THEN
    SELECT banco_catalog_id INTO v_banco_catalog_id FROM users WHERE id = OLD.banco_id;
    UPDATE cliente_banco_limites
    SET monto_utilizado = GREATEST(0, monto_utilizado - OLD.monto), updated_at = NOW()
    WHERE cliente_id = NEW.cliente_id AND banco_id = v_banco_catalog_id;
  END IF;

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- =====================
-- 7. RPCs actualizadas
-- =====================

-- obtener_todos_bancos: ahora devuelve el catálogo completo (19 bancos)
DROP FUNCTION IF EXISTS obtener_todos_bancos();
CREATE OR REPLACE FUNCTION obtener_todos_bancos()
RETURNS TABLE(id uuid, nombre text, entidad text) AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.nombre, b.nombre AS entidad
  FROM bancos b WHERE b.activo = true ORDER BY b.nombre;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET row_security = off;
GRANT EXECUTE ON FUNCTION obtener_todos_bancos() TO authenticated;

-- obtener_limites_cliente: limites con nombre del banco desde catálogo
CREATE OR REPLACE FUNCTION obtener_limites_cliente(p_cliente_id uuid)
RETURNS TABLE(
  id uuid, cliente_id uuid, banco_id uuid, banco_nombre text,
  limite_monto numeric, monto_utilizado numeric, activo boolean,
  created_at timestamptz, updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT cbl.id, cbl.cliente_id, cbl.banco_id, b.nombre AS banco_nombre,
    cbl.limite_monto, cbl.monto_utilizado, cbl.activo, cbl.created_at, cbl.updated_at
  FROM cliente_banco_limites cbl
  INNER JOIN bancos b ON b.id = cbl.banco_id
  WHERE cbl.cliente_id = p_cliente_id
  ORDER BY b.nombre;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET row_security = off;
GRANT EXECUTE ON FUNCTION obtener_limites_cliente(uuid) TO authenticated;

-- obtener_bancos_disponibles: usa catálogo, incluye todos_user_ids de usuarios activos
DROP FUNCTION IF EXISTS obtener_bancos_disponibles(uuid, numeric);
CREATE OR REPLACE FUNCTION obtener_bancos_disponibles(p_cliente_id uuid, p_monto numeric)
RETURNS TABLE(
  banco_id uuid, banco_nombre text, banco_entidad text,
  limite_monto numeric, monto_utilizado numeric, monto_disponible numeric,
  todos_user_ids uuid[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id AS banco_id, b.nombre AS banco_nombre, b.nombre AS banco_entidad,
    cbl.limite_monto, cbl.monto_utilizado,
    (cbl.limite_monto - cbl.monto_utilizado) AS monto_disponible,
    ARRAY(
      SELECT u.id FROM users u
      WHERE u.banco_catalog_id = b.id AND u.activo = true
        AND u.role IN ('banco_admin', 'banco_mesa', 'banco_auditor')
    ) AS todos_user_ids
  FROM bancos b
  INNER JOIN cliente_banco_limites cbl ON cbl.banco_id = b.id
  WHERE cbl.cliente_id = p_cliente_id AND b.activo = true AND cbl.activo = true
    AND (cbl.limite_monto - cbl.monto_utilizado) >= p_monto
  ORDER BY b.nombre;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET row_security = off;
GRANT EXECUTE ON FUNCTION obtener_bancos_disponibles(uuid, numeric) TO authenticated;

-- obtener_compromisos_usuario: usa nombre del catálogo para banco
DROP FUNCTION IF EXISTS obtener_compromisos_usuario(uuid);
CREATE OR REPLACE FUNCTION obtener_compromisos_usuario(p_user_id uuid)
RETURNS TABLE(
  id uuid, op_id text, cliente_id uuid, banco_id uuid,
  subasta_id uuid, oferta_id uuid, monto numeric, moneda text,
  tasa numeric, plazo integer, fecha_inicio date, fecha_vencimiento date,
  estado text, notas text, created_at timestamptz, updated_at timestamptz,
  banco_nombre text, banco_entidad text, cliente_nombre text, cliente_entidad text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.op_id, c.cliente_id, c.banco_id,
    c.subasta_id, c.oferta_id, c.monto, c.moneda,
    c.tasa, c.plazo, c.fecha_inicio, c.fecha_vencimiento,
    c.estado, c.notas, c.created_at, c.updated_at,
    COALESCE(bc.nombre, banco_u.entidad) AS banco_nombre,
    COALESCE(bc.nombre, banco_u.entidad) AS banco_entidad,
    cli.nombre AS cliente_nombre,
    cli.entidad AS cliente_entidad
  FROM compromisos c
  INNER JOIN users banco_u ON banco_u.id = c.banco_id
  LEFT  JOIN bancos bc     ON bc.id = banco_u.banco_catalog_id
  INNER JOIN users cli     ON cli.id = c.cliente_id
  WHERE c.cliente_id = p_user_id OR c.banco_id = p_user_id
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET row_security = off;
GRANT EXECUTE ON FUNCTION obtener_compromisos_usuario(uuid) TO authenticated;
