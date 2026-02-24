-- Migración 006: Flujo admin-mesa para aprobación de ofertas
-- Problema: banco_admin no puede ver filas de otros usuarios en `users` (RLS lo bloquea)
-- y tampoco puede hacer UPDATE en ofertas donde banco_id es el mesa user.
-- Solución: helper SECURITY DEFINER + nueva policy RLS + RPC SECURITY DEFINER.

-- ============================================================
-- 0. HELPER: get_user_banco_catalog_id()
--    Obtiene el banco_catalog_id del usuario actual sin triggear RLS
--    (evita recursión infinita en policies de users)
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_banco_catalog_id()
RETURNS uuid AS $$
  SELECT banco_catalog_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET row_security = off;

GRANT EXECUTE ON FUNCTION get_user_banco_catalog_id() TO authenticated;

-- ============================================================
-- 1. POLICY: banco_admin puede leer usuarios del mismo banco
--    Usa get_user_banco_catalog_id() en vez de subquery para
--    evitar recursión infinita en policies de users.
-- ============================================================
DROP POLICY IF EXISTS "users_admin_ver_mismo_banco" ON users;
CREATE POLICY "users_admin_ver_mismo_banco" ON users
  FOR SELECT USING (
    get_user_role() = 'banco_admin'
    AND role IN ('banco_mesa', 'banco_auditor')
    AND banco_catalog_id = get_user_banco_catalog_id()
  );

-- ============================================================
-- 2. POLICY: banco_admin puede UPDATE en ofertas de mesa
--    del mismo banco (para aprobar/rechazar)
-- ============================================================
DROP POLICY IF EXISTS "ofertas_admin_update_mesa" ON ofertas;
CREATE POLICY "ofertas_admin_update_mesa" ON ofertas
  FOR UPDATE USING (
    get_user_role() = 'banco_admin'
    AND EXISTS (
      SELECT 1
      FROM users mesa
      WHERE mesa.id   = ofertas.banco_id
        AND mesa.role  = 'banco_mesa'
        AND mesa.banco_catalog_id = get_user_banco_catalog_id()
    )
  );

-- ============================================================
-- 3. RPC: obtener_ofertas_pendientes_admin()
--    Devuelve ofertas de banco_mesa del mismo banco que requieren
--    aprobación del admin. Usa SECURITY DEFINER para evitar
--    problemas de RLS al hacer joins en users.
-- ============================================================
DROP FUNCTION IF EXISTS obtener_ofertas_pendientes_admin();
CREATE OR REPLACE FUNCTION obtener_ofertas_pendientes_admin()
RETURNS TABLE (
  id                  uuid,
  subasta_id          uuid,
  banco_id            uuid,
  tasa                numeric,
  estado              text,
  aprobada_por_admin  boolean,
  created_at          timestamptz,
  usuario_nombre      text,
  subasta_monto       numeric,
  subasta_moneda      text,
  subasta_plazo       integer,
  subasta_tipo        text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_catalog_id uuid;
BEGIN
  -- Obtener el banco_catalog_id del admin que llama
  SELECT banco_catalog_id INTO v_catalog_id
  FROM users
  WHERE id = auth.uid() AND role = 'banco_admin';

  -- Si no es admin de banco, no devolver nada
  IF v_catalog_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      o.id,
      o.subasta_id,
      o.banco_id,
      o.tasa,
      o.estado::text,
      o.aprobada_por_admin,
      o.created_at,
      u.nombre         AS usuario_nombre,
      s.monto          AS subasta_monto,
      s.moneda::text   AS subasta_moneda,
      s.plazo          AS subasta_plazo,
      s.tipo::text     AS subasta_tipo
    FROM ofertas o
    JOIN users   u ON u.id = o.banco_id
    JOIN subastas s ON s.id = o.subasta_id
    WHERE u.banco_catalog_id = v_catalog_id
      AND u.role              = 'banco_mesa'
      AND o.aprobada_por_admin = false
      AND o.estado             = 'enviada'
    ORDER BY o.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_ofertas_pendientes_admin() TO authenticated;
