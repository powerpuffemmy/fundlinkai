-- ============================================
-- FUNDLINK: Fix RLS completo - sin recursión infinita
-- ============================================
-- Ejecutar en Supabase SQL Editor si se necesita re-aplicar
-- ============================================

-- =====================
-- 1. Agregar SET row_security=off a todas las funciones helper
--    (evita recursión cuando se llaman dentro de policies RLS)
-- =====================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET row_security = off;

CREATE OR REPLACE FUNCTION is_webadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'webadmin')
$$ LANGUAGE sql SECURITY DEFINER STABLE SET row_security = off;

CREATE OR REPLACE FUNCTION is_banco()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('banco_admin', 'banco_mesa', 'banco_auditor'))
$$ LANGUAGE sql SECURITY DEFINER STABLE SET row_security = off;

CREATE OR REPLACE FUNCTION is_cliente()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'cliente')
$$ LANGUAGE sql SECURITY DEFINER STABLE SET row_security = off;

-- =====================
-- 2. Fix audit_changes: row_security=off para evitar recursión al leer users
-- =====================
CREATE OR REPLACE FUNCTION audit_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO auditoria (user_id, accion, detalle, metadata)
  VALUES (
    auth.uid(),
    TG_OP || '_' || TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN 'Eliminado registro'
      WHEN TG_OP = 'INSERT' THEN 'Creado nuevo registro'
      ELSE 'Actualizado registro'
    END,
    jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP, 'record_id', COALESCE(NEW.id, OLD.id))
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET row_security = off;

-- =====================
-- 3. Reset completo de policies - evitar ciclos entre tablas
--    (El ciclo original: subastas → subasta_bancos → subastas)
-- =====================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.tablename;
  END LOOP;
END $$;

-- USERS
CREATE POLICY "users_select_own" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_bancos_ver_clientes" ON users FOR SELECT USING (get_user_role() IN ('banco_admin', 'banco_mesa', 'banco_auditor') AND role = 'cliente');
CREATE POLICY "users_webadmin_all" ON users FOR ALL USING (get_user_role() = 'webadmin');
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- SUBASTAS
CREATE POLICY "subastas_cliente_own" ON subastas FOR SELECT USING (cliente_id = auth.uid());
CREATE POLICY "subastas_cliente_insert" ON subastas FOR INSERT WITH CHECK (cliente_id = auth.uid() AND get_user_role() = 'cliente');
CREATE POLICY "subastas_cliente_update" ON subastas FOR UPDATE USING (cliente_id = auth.uid() AND estado = 'abierta') WITH CHECK (cliente_id = auth.uid());
CREATE POLICY "subastas_banco_invitado" ON subastas FOR SELECT USING (
  get_user_role() IN ('banco_admin', 'banco_mesa', 'banco_auditor')
  AND EXISTS (SELECT 1 FROM subasta_bancos sb WHERE sb.subasta_id = subastas.id AND sb.banco_id = auth.uid())
);
CREATE POLICY "subastas_webadmin" ON subastas FOR ALL USING (get_user_role() = 'webadmin');

-- SUBASTA_BANCOS (sin referencias a subastas para evitar ciclo)
CREATE POLICY "subasta_bancos_banco" ON subasta_bancos FOR SELECT USING (banco_id = auth.uid());
CREATE POLICY "subasta_bancos_cliente_insert" ON subasta_bancos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "subasta_bancos_cliente_select" ON subasta_bancos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "subasta_bancos_webadmin" ON subasta_bancos FOR ALL USING (get_user_role() = 'webadmin');

-- OFERTAS
CREATE POLICY "ofertas_banco_own" ON ofertas FOR SELECT USING (banco_id = auth.uid());
CREATE POLICY "ofertas_banco_insert" ON ofertas FOR INSERT WITH CHECK (
  banco_id = auth.uid()
  AND get_user_role() IN ('banco_admin', 'banco_mesa')
  AND EXISTS (SELECT 1 FROM subasta_bancos sb WHERE sb.subasta_id = ofertas.subasta_id AND sb.banco_id = auth.uid())
);
CREATE POLICY "ofertas_cliente_ver" ON ofertas FOR SELECT USING (
  EXISTS (SELECT 1 FROM subastas s WHERE s.id = ofertas.subasta_id AND s.cliente_id = auth.uid())
);
CREATE POLICY "ofertas_webadmin" ON ofertas FOR ALL USING (get_user_role() = 'webadmin');

-- COMPROMISOS
CREATE POLICY "compromisos_cliente" ON compromisos FOR SELECT USING (cliente_id = auth.uid());
CREATE POLICY "compromisos_banco" ON compromisos FOR SELECT USING (banco_id = auth.uid());
CREATE POLICY "compromisos_webadmin" ON compromisos FOR ALL USING (get_user_role() = 'webadmin');

-- CLIENTE_BANCO_LIMITES
CREATE POLICY "limites_cliente" ON cliente_banco_limites FOR SELECT USING (cliente_id = auth.uid());
CREATE POLICY "limites_banco" ON cliente_banco_limites FOR SELECT USING (banco_id = auth.uid());
CREATE POLICY "limites_cliente_insert" ON cliente_banco_limites FOR INSERT WITH CHECK (cliente_id = auth.uid() AND get_user_role() = 'cliente');
CREATE POLICY "limites_cliente_update" ON cliente_banco_limites FOR UPDATE USING (cliente_id = auth.uid()) WITH CHECK (cliente_id = auth.uid());
CREATE POLICY "limites_banco_admin" ON cliente_banco_limites FOR ALL USING (banco_id = auth.uid() AND get_user_role() = 'banco_admin');
CREATE POLICY "limites_webadmin" ON cliente_banco_limites FOR ALL USING (get_user_role() = 'webadmin');

-- DOCUMENTOS KYC
CREATE POLICY "kyc_cliente_own" ON documentos_kyc FOR SELECT USING (cliente_id = auth.uid());
CREATE POLICY "kyc_cliente_insert" ON documentos_kyc FOR INSERT WITH CHECK (cliente_id = auth.uid() AND get_user_role() = 'cliente');
CREATE POLICY "kyc_cliente_delete" ON documentos_kyc FOR DELETE USING (cliente_id = auth.uid() AND estado = 'pendiente');
CREATE POLICY "kyc_banco_ver" ON documentos_kyc FOR SELECT USING (
  get_user_role() IN ('banco_admin', 'banco_mesa', 'banco_auditor')
  AND EXISTS (SELECT 1 FROM cliente_banco_limites cbl WHERE cbl.cliente_id = documentos_kyc.cliente_id AND cbl.banco_id = auth.uid() AND cbl.activo = true)
);
CREATE POLICY "kyc_webadmin" ON documentos_kyc FOR ALL USING (get_user_role() = 'webadmin');

-- REGLAS_BANCO
CREATE POLICY "reglas_banco_own" ON reglas_banco FOR SELECT USING (banco_id = auth.uid());
CREATE POLICY "reglas_banco_admin" ON reglas_banco FOR ALL USING (banco_id = auth.uid() AND get_user_role() = 'banco_admin');
CREATE POLICY "reglas_webadmin" ON reglas_banco FOR ALL USING (get_user_role() = 'webadmin');

-- AUDITORIA
CREATE POLICY "auditoria_webadmin_select" ON auditoria FOR SELECT USING (get_user_role() = 'webadmin');
CREATE POLICY "auditoria_insert_all" ON auditoria FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================
-- 4. RPC obtener_todos_bancos con SECURITY DEFINER (clientes pueden ver bancos)
-- =====================
CREATE OR REPLACE FUNCTION obtener_todos_bancos()
RETURNS TABLE(id uuid, nombre text, entidad text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (u.entidad) u.id, u.nombre, u.entidad
  FROM users u
  WHERE u.role = 'banco_admin' AND u.activo = true
  ORDER BY u.entidad, u.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET row_security = off;

GRANT EXECUTE ON FUNCTION obtener_todos_bancos() TO authenticated;

-- =====================
-- 5. RPC obtener_bancos_disponibles con SECURITY DEFINER
-- =====================
CREATE OR REPLACE FUNCTION obtener_bancos_disponibles(p_cliente_id uuid, p_monto numeric)
RETURNS TABLE(
  banco_id uuid,
  banco_nombre text,
  banco_entidad text,
  limite_monto numeric,
  monto_utilizado numeric,
  monto_disponible numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS banco_id,
    u.nombre AS banco_nombre,
    u.entidad AS banco_entidad,
    cbl.limite_monto,
    cbl.monto_utilizado,
    (cbl.limite_monto - cbl.monto_utilizado) AS monto_disponible
  FROM users u
  INNER JOIN cliente_banco_limites cbl ON u.id = cbl.banco_id
  WHERE cbl.cliente_id = p_cliente_id
    AND u.activo = true
    AND u.role IN ('banco_admin', 'banco_mesa')
    AND cbl.activo = true
    AND (cbl.limite_monto - cbl.monto_utilizado) >= p_monto
  ORDER BY u.entidad;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET row_security = off;

GRANT EXECUTE ON FUNCTION obtener_bancos_disponibles(uuid, numeric) TO authenticated;
