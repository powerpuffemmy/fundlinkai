-- ============================================================
-- FUNDLINK: Migración 012 - Aprobaciones para Ofertas de Colocación
-- Problema: banco_mesa enviaba ofertas_colocacion directamente
-- sin pasar por aprobación de banco_admin.
-- Solución: campo aprobada_por_admin + RLS + RPC para admin.
-- ============================================================

-- 1. Columna de aprobación en ofertas_colocacion
ALTER TABLE ofertas_colocacion
  ADD COLUMN IF NOT EXISTS aprobada_por_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Marcar ofertas existentes de banco_admin como aprobadas
UPDATE ofertas_colocacion oc
SET aprobada_por_admin = true
FROM users u
WHERE u.id = oc.banco_id AND u.role = 'banco_admin';

-- 3. RLS cliente: solo ve ofertas aprobadas
DROP POLICY IF EXISTS "cliente_select_oferta_col" ON ofertas_colocacion;
CREATE POLICY "cliente_select_oferta_col" ON ofertas_colocacion
  FOR SELECT USING (
    aprobada_por_admin = true
    AND EXISTS (
      SELECT 1 FROM solicitudes_colocacion sc
      WHERE sc.id = ofertas_colocacion.solicitud_id
        AND sc.cliente_id = auth.uid()
    )
  );

-- 4. RLS banco_admin: puede SELECT ofertas_colocacion de mesa del mismo banco
DROP POLICY IF EXISTS "ofertas_col_admin_select_mesa" ON ofertas_colocacion;
CREATE POLICY "ofertas_col_admin_select_mesa" ON ofertas_colocacion
  FOR SELECT USING (
    get_user_role() = 'banco_admin'
    AND EXISTS (
      SELECT 1 FROM users mesa
      WHERE mesa.id = ofertas_colocacion.banco_id
        AND mesa.role = 'banco_mesa'
        AND mesa.banco_catalog_id = get_user_banco_catalog_id()
    )
  );

-- 5. RLS banco_admin: puede UPDATE ofertas_colocacion de mesa del mismo banco
DROP POLICY IF EXISTS "ofertas_col_admin_update_mesa" ON ofertas_colocacion;
CREATE POLICY "ofertas_col_admin_update_mesa" ON ofertas_colocacion
  FOR UPDATE USING (
    get_user_role() = 'banco_admin'
    AND EXISTS (
      SELECT 1 FROM users mesa
      WHERE mesa.id = ofertas_colocacion.banco_id
        AND mesa.role = 'banco_mesa'
        AND mesa.banco_catalog_id = get_user_banco_catalog_id()
    )
  );

-- 6. RPC: lista para banco_admin de ofertas_colocacion pendientes de mesa
DROP FUNCTION IF EXISTS obtener_ofertas_colocacion_pendientes_admin();
CREATE OR REPLACE FUNCTION obtener_ofertas_colocacion_pendientes_admin()
RETURNS TABLE (
  id                  uuid,
  solicitud_id        uuid,
  banco_id            uuid,
  tasa                numeric,
  monto               numeric,
  notas               text,
  estado              text,
  aprobada_por_admin  boolean,
  created_at          timestamptz,
  usuario_nombre      text,
  cliente_nombre      text,
  solicitud_moneda    text,
  solicitud_plazo     integer,
  solicitud_monto     numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_catalog_id uuid;
BEGIN
  SELECT banco_catalog_id INTO v_catalog_id
  FROM users
  WHERE id = auth.uid() AND role = 'banco_admin';

  IF v_catalog_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      oc.id,
      oc.solicitud_id,
      oc.banco_id,
      oc.tasa,
      oc.monto,
      oc.notas,
      oc.estado::text,
      oc.aprobada_por_admin,
      oc.created_at,
      u.nombre            AS usuario_nombre,
      cli.nombre          AS cliente_nombre,
      sc.moneda::text     AS solicitud_moneda,
      sc.plazo            AS solicitud_plazo,
      sc.monto            AS solicitud_monto
    FROM ofertas_colocacion oc
    JOIN users u   ON u.id   = oc.banco_id
    JOIN solicitudes_colocacion sc ON sc.id = oc.solicitud_id
    JOIN users cli ON cli.id = sc.cliente_id
    WHERE u.banco_catalog_id = v_catalog_id
      AND u.role              = 'banco_mesa'
      AND oc.aprobada_por_admin = false
      AND oc.estado             = 'enviada'
    ORDER BY oc.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_ofertas_colocacion_pendientes_admin() TO authenticated;
