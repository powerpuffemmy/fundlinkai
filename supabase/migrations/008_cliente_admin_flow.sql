-- ============================================
-- FUNDLINK: Flujo cliente_admin / cliente_usuario
-- ============================================
-- Agrega dos nuevos roles de cliente:
--   cliente_admin  → tiene la última palabra (aprueba ofertas, crea compromisos)
--   cliente_usuario → opera (crea subastas, ve ofertas) pero NO aprueba
-- Los usuarios se agrupan por el campo `entidad`.
-- ============================================

-- =====================
-- 1. MIGRAR USUARIOS EXISTENTES
-- =====================
UPDATE users SET role = 'cliente_admin' WHERE role = 'cliente';

-- =====================
-- 2. HELPER: get_user_entidad()
--    Equivalente a get_user_banco_catalog_id() pero para clientes.
--    SECURITY DEFINER + row_security=off evita recursión en RLS.
-- =====================
CREATE OR REPLACE FUNCTION get_user_entidad()
RETURNS TEXT AS $$
  SELECT entidad FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET row_security = off;

GRANT EXECUTE ON FUNCTION get_user_entidad() TO authenticated;

-- =====================
-- 3. HELPER: is_cliente_admin()
-- =====================
CREATE OR REPLACE FUNCTION is_cliente_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'cliente_admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE SET row_security = off;

GRANT EXECUTE ON FUNCTION is_cliente_admin() TO authenticated;

-- =====================
-- 4. ACTUALIZAR is_cliente() para incluir ambos roles
-- =====================
CREATE OR REPLACE FUNCTION is_cliente()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('cliente_admin', 'cliente_usuario')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE SET row_security = off;

-- =====================
-- 5. POLICIES: USERS
--    cliente_admin puede ver usuarios de su misma entidad
--    Bancos pueden ver ambos roles de cliente
-- =====================
DROP POLICY IF EXISTS "users_bancos_ver_clientes" ON users;
CREATE POLICY "users_bancos_ver_clientes" ON users
  FOR SELECT USING (
    get_user_role() IN ('banco_admin', 'banco_mesa', 'banco_auditor')
    AND role IN ('cliente_admin', 'cliente_usuario')
  );

CREATE POLICY "users_cliente_admin_ver_entidad" ON users
  FOR SELECT USING (
    get_user_role() = 'cliente_admin'
    AND role IN ('cliente_admin', 'cliente_usuario')
    AND entidad = get_user_entidad()
  );

-- =====================
-- 6. POLICIES: SUBASTAS
--    Ambos roles ven subastas de su entidad.
--    Ambos roles pueden crear subastas.
--    Ambos roles pueden actualizar subastas abiertas de su entidad.
-- =====================
DROP POLICY IF EXISTS "subastas_cliente_own" ON subastas;
CREATE POLICY "subastas_cliente_entidad" ON subastas
  FOR SELECT USING (
    get_user_role() IN ('cliente_admin', 'cliente_usuario')
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = subastas.cliente_id
        AND u.entidad = get_user_entidad()
    )
  );

DROP POLICY IF EXISTS "subastas_cliente_insert" ON subastas;
CREATE POLICY "subastas_cliente_insert" ON subastas
  FOR INSERT WITH CHECK (
    cliente_id = auth.uid()
    AND get_user_role() IN ('cliente_admin', 'cliente_usuario')
  );

DROP POLICY IF EXISTS "subastas_cliente_update" ON subastas;
CREATE POLICY "subastas_cliente_update" ON subastas
  FOR UPDATE USING (
    get_user_role() IN ('cliente_admin', 'cliente_usuario')
    AND estado = 'abierta'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = subastas.cliente_id
        AND u.entidad = get_user_entidad()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = subastas.cliente_id
        AND u.entidad = get_user_entidad()
    )
  );

-- =====================
-- 7. POLICIES: OFERTAS
--    Ambos roles ven ofertas de subastas de su entidad.
--    SOLO cliente_admin puede UPDATE (aprobar/rechazar).
-- =====================
DROP POLICY IF EXISTS "ofertas_cliente_ver" ON ofertas;
CREATE POLICY "ofertas_cliente_ver" ON ofertas
  FOR SELECT USING (
    get_user_role() IN ('cliente_admin', 'cliente_usuario')
    AND EXISTS (
      SELECT 1 FROM subastas s
      JOIN users u ON u.id = s.cliente_id
      WHERE s.id = ofertas.subasta_id
        AND u.entidad = get_user_entidad()
    )
  );

DROP POLICY IF EXISTS "ofertas_cliente_update" ON ofertas;
CREATE POLICY "ofertas_cliente_admin_update" ON ofertas
  FOR UPDATE USING (
    get_user_role() = 'cliente_admin'
    AND EXISTS (
      SELECT 1 FROM subastas s
      JOIN users u ON u.id = s.cliente_id
      WHERE s.id = ofertas.subasta_id
        AND u.entidad = get_user_entidad()
    )
  ) WITH CHECK (
    get_user_role() = 'cliente_admin'
    AND EXISTS (
      SELECT 1 FROM subastas s
      JOIN users u ON u.id = s.cliente_id
      WHERE s.id = ofertas.subasta_id
        AND u.entidad = get_user_entidad()
    )
  );

-- =====================
-- 8. POLICIES: COMPROMISOS
--    Ambos roles ven compromisos de su entidad.
--    SOLO cliente_admin puede INSERT (al aprobar oferta).
--    SOLO cliente_admin puede UPDATE/DELETE externos.
-- =====================
DROP POLICY IF EXISTS "compromisos_cliente" ON compromisos;
CREATE POLICY "compromisos_cliente_entidad" ON compromisos
  FOR SELECT USING (
    get_user_role() IN ('cliente_admin', 'cliente_usuario')
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = compromisos.cliente_id
        AND u.entidad = get_user_entidad()
    )
  );

DROP POLICY IF EXISTS "compromisos_cliente_insert" ON compromisos;
CREATE POLICY "compromisos_cliente_admin_insert" ON compromisos
  FOR INSERT WITH CHECK (
    get_user_role() = 'cliente_admin'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = compromisos.cliente_id
        AND u.entidad = get_user_entidad()
    )
  );

DROP POLICY IF EXISTS "compromisos_cliente_update_externo" ON compromisos;
CREATE POLICY "compromisos_cliente_admin_update_externo" ON compromisos
  FOR UPDATE USING (
    get_user_role() = 'cliente_admin'
    AND es_externo = true
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = compromisos.cliente_id
        AND u.entidad = get_user_entidad()
    )
  ) WITH CHECK (
    es_externo = true
  );

DROP POLICY IF EXISTS "compromisos_cliente_delete_externo" ON compromisos;
CREATE POLICY "compromisos_cliente_admin_delete_externo" ON compromisos
  FOR DELETE USING (
    get_user_role() = 'cliente_admin'
    AND es_externo = true
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = compromisos.cliente_id
        AND u.entidad = get_user_entidad()
    )
  );

-- =====================
-- 9. POLICIES: CLIENTE_BANCO_LIMITES
--    Ambos roles ven límites de su entidad.
--    SOLO cliente_admin puede INSERT/UPDATE.
-- =====================
DROP POLICY IF EXISTS "limites_cliente" ON cliente_banco_limites;
CREATE POLICY "limites_cliente_entidad" ON cliente_banco_limites
  FOR SELECT USING (
    get_user_role() IN ('cliente_admin', 'cliente_usuario')
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = cliente_banco_limites.cliente_id
        AND u.entidad = get_user_entidad()
    )
  );

DROP POLICY IF EXISTS "limites_cliente_insert" ON cliente_banco_limites;
CREATE POLICY "limites_cliente_admin_insert" ON cliente_banco_limites
  FOR INSERT WITH CHECK (
    get_user_role() = 'cliente_admin'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = cliente_banco_limites.cliente_id
        AND u.entidad = get_user_entidad()
    )
  );

DROP POLICY IF EXISTS "limites_cliente_update" ON cliente_banco_limites;
CREATE POLICY "limites_cliente_admin_update" ON cliente_banco_limites
  FOR UPDATE USING (
    get_user_role() = 'cliente_admin'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = cliente_banco_limites.cliente_id
        AND u.entidad = get_user_entidad()
    )
  ) WITH CHECK (
    get_user_role() = 'cliente_admin'
  );

-- =====================
-- 10. POLICIES: DOCUMENTOS KYC
--     Ambos roles ven docs de su entidad.
--     Ambos pueden subir (su propio user id).
--     SOLO cliente_admin puede borrar.
-- =====================
DROP POLICY IF EXISTS "kyc_cliente_own" ON documentos_kyc;
CREATE POLICY "kyc_cliente_entidad" ON documentos_kyc
  FOR SELECT USING (
    get_user_role() IN ('cliente_admin', 'cliente_usuario')
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = documentos_kyc.cliente_id
        AND u.entidad = get_user_entidad()
    )
  );

DROP POLICY IF EXISTS "kyc_cliente_insert" ON documentos_kyc;
CREATE POLICY "kyc_cliente_insert" ON documentos_kyc
  FOR INSERT WITH CHECK (
    cliente_id = auth.uid()
    AND get_user_role() IN ('cliente_admin', 'cliente_usuario')
  );

DROP POLICY IF EXISTS "kyc_cliente_delete" ON documentos_kyc;
CREATE POLICY "kyc_cliente_admin_delete" ON documentos_kyc
  FOR DELETE USING (
    get_user_role() = 'cliente_admin'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = documentos_kyc.cliente_id
        AND u.entidad = get_user_entidad()
    )
    AND estado = 'pendiente'
  );

-- =====================
-- 11. RPC: obtener_bancos_disponibles (entity-aware)
--     Ahora busca límites por entidad (no solo por user ID)
--     para que cliente_usuario vea los mismos bancos disponibles.
--     Usa tabla bancos (catálogo) como en migración 005.
-- =====================
DROP FUNCTION IF EXISTS obtener_bancos_disponibles(uuid, numeric);
CREATE OR REPLACE FUNCTION obtener_bancos_disponibles(p_cliente_id uuid, p_monto numeric)
RETURNS TABLE(
  banco_id uuid,
  banco_nombre text,
  banco_entidad text,
  limite_monto numeric,
  monto_utilizado numeric,
  monto_disponible numeric,
  todos_user_ids uuid[]
) AS $$
DECLARE
  v_entidad text;
BEGIN
  -- Obtener la entidad del cliente
  SELECT u.entidad INTO v_entidad FROM users u WHERE u.id = p_cliente_id;

  RETURN QUERY
  SELECT
    b.id AS banco_id, b.nombre AS banco_nombre, b.nombre AS banco_entidad,
    cbl.limite_monto, cbl.monto_utilizado,
    (cbl.limite_monto - cbl.monto_utilizado) AS monto_disponible,
    ARRAY(
      SELECT u2.id FROM users u2
      WHERE u2.banco_catalog_id = b.id AND u2.activo = true
        AND u2.role IN ('banco_admin', 'banco_mesa', 'banco_auditor')
    ) AS todos_user_ids
  FROM bancos b
  INNER JOIN cliente_banco_limites cbl ON cbl.banco_id = b.id
  -- Buscar límites de CUALQUIER usuario de la misma entidad
  INNER JOIN users cli ON cli.id = cbl.cliente_id AND cli.entidad = v_entidad
  WHERE b.activo = true AND cbl.activo = true
    AND (cbl.limite_monto - cbl.monto_utilizado) >= p_monto
  ORDER BY b.nombre;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET row_security = off;

GRANT EXECUTE ON FUNCTION obtener_bancos_disponibles(uuid, numeric) TO authenticated;

-- =====================
-- 11b. RPC: obtener_limites_cliente (entity-aware)
--      Ahora busca límites por entidad para que cliente_usuario
--      vea los mismos límites que cliente_admin configuró.
-- =====================
DROP FUNCTION IF EXISTS obtener_limites_cliente(uuid);
CREATE OR REPLACE FUNCTION obtener_limites_cliente(p_cliente_id uuid)
RETURNS TABLE(
  id uuid, cliente_id uuid, banco_id uuid, banco_nombre text,
  limite_monto numeric, monto_utilizado numeric, activo boolean,
  created_at timestamptz, updated_at timestamptz
) AS $$
DECLARE
  v_entidad text;
BEGIN
  SELECT u.entidad INTO v_entidad FROM users u WHERE u.id = p_cliente_id;

  RETURN QUERY
  SELECT cbl.id, cbl.cliente_id, cbl.banco_id, b.nombre AS banco_nombre,
    cbl.limite_monto, cbl.monto_utilizado, cbl.activo, cbl.created_at, cbl.updated_at
  FROM cliente_banco_limites cbl
  INNER JOIN bancos b ON b.id = cbl.banco_id
  INNER JOIN users cli ON cli.id = cbl.cliente_id AND cli.entidad = v_entidad
  ORDER BY b.nombre;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET row_security = off;

GRANT EXECUTE ON FUNCTION obtener_limites_cliente(uuid) TO authenticated;

-- =====================
-- 12. RPC: obtener_compromisos_usuario (entity-aware)
--     Ahora busca compromisos por entidad del usuario
--     para que ambos roles vean todos los compromisos de la entidad.
-- =====================
DROP FUNCTION IF EXISTS obtener_compromisos_usuario(uuid);
CREATE OR REPLACE FUNCTION obtener_compromisos_usuario(p_user_id uuid)
RETURNS TABLE(
  id uuid, op_id text, cliente_id uuid, banco_id uuid,
  subasta_id uuid, oferta_id uuid, monto numeric, moneda text,
  tasa numeric, plazo integer, fecha_inicio date, fecha_vencimiento date,
  estado text, notas text, created_at timestamptz, updated_at timestamptz,
  banco_nombre text, banco_entidad text, cliente_nombre text, cliente_entidad text,
  es_externo boolean, contraparte_nombre text, documento_url text
) AS $$
DECLARE
  v_role text;
  v_entidad text;
BEGIN
  -- Obtener rol y entidad del usuario
  SELECT u.role, u.entidad INTO v_role, v_entidad
  FROM users u WHERE u.id = p_user_id;

  -- Si es cliente (admin o usuario), buscar por entidad
  IF v_role IN ('cliente_admin', 'cliente_usuario') THEN
    RETURN QUERY
    SELECT
      c.id, c.op_id, c.cliente_id, c.banco_id,
      c.subasta_id, c.oferta_id, c.monto, c.moneda,
      c.tasa, c.plazo, c.fecha_inicio, c.fecha_vencimiento,
      c.estado, c.notas, c.created_at, c.updated_at,
      COALESCE(bc.nombre, banco_u.entidad) AS banco_nombre,
      COALESCE(bc.nombre, banco_u.entidad) AS banco_entidad,
      cli.nombre AS cliente_nombre,
      cli.entidad AS cliente_entidad,
      c.es_externo,
      c.contraparte_nombre,
      c.documento_url
    FROM compromisos c
    LEFT JOIN users banco_u ON banco_u.id = c.banco_id
    LEFT JOIN bancos bc     ON bc.id = banco_u.banco_catalog_id
    INNER JOIN users cli    ON cli.id = c.cliente_id
    WHERE cli.entidad = v_entidad
    ORDER BY c.created_at DESC;
  ELSE
    -- Para bancos, mantener comportamiento original (por user id)
    RETURN QUERY
    SELECT
      c.id, c.op_id, c.cliente_id, c.banco_id,
      c.subasta_id, c.oferta_id, c.monto, c.moneda,
      c.tasa, c.plazo, c.fecha_inicio, c.fecha_vencimiento,
      c.estado, c.notas, c.created_at, c.updated_at,
      COALESCE(bc.nombre, banco_u.entidad) AS banco_nombre,
      COALESCE(bc.nombre, banco_u.entidad) AS banco_entidad,
      cli.nombre AS cliente_nombre,
      cli.entidad AS cliente_entidad,
      c.es_externo,
      c.contraparte_nombre,
      c.documento_url
    FROM compromisos c
    LEFT JOIN users banco_u ON banco_u.id = c.banco_id
    LEFT JOIN bancos bc     ON bc.id = banco_u.banco_catalog_id
    INNER JOIN users cli    ON cli.id = c.cliente_id
    WHERE c.banco_id = p_user_id
    ORDER BY c.created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET row_security = off;

GRANT EXECUTE ON FUNCTION obtener_compromisos_usuario(uuid) TO authenticated;

-- =====================
-- 13. ACTUALIZAR TRIGGER notify_cuenta_aprobada
--     Para que funcione con los nuevos roles.
--     Solo se crea si la función existe.
-- =====================
DO $$ BEGIN
  DROP TRIGGER IF EXISTS trigger_notify_cuenta_aprobada ON users;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notify_cuenta_aprobada') THEN
    CREATE TRIGGER trigger_notify_cuenta_aprobada
      AFTER UPDATE ON users
      FOR EACH ROW
      WHEN (NEW.role IN ('cliente_admin', 'cliente_usuario'))
      EXECUTE FUNCTION notify_cuenta_aprobada();
  END IF;
END $$;

-- =====================
-- 14. STORAGE: Actualizar policy de compromisos-documentos
--     para incluir nuevos roles (solo si el bucket existe)
-- =====================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'compromisos-documentos') THEN
    DROP POLICY IF EXISTS "compromisos_docs_select" ON storage.objects;
    CREATE POLICY "compromisos_docs_select" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'compromisos-documentos'
        AND (
          auth.uid()::text = (storage.foldername(name))[1]
          OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'webadmin')
        )
      );
  END IF;
END $$;
