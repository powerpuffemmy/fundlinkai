-- ============================================
-- FUNDLINK: Row Level Security (RLS) Policies
-- ============================================
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- =====================
-- 1. HABILITAR RLS EN TODAS LAS TABLAS
-- =====================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subastas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ofertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE compromisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_banco_limites ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE reglas_banco ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE subasta_bancos ENABLE ROW LEVEL SECURITY;

-- =====================
-- 2. FUNCIONES AUXILIARES
-- =====================

-- Obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verificar si es webadmin
CREATE OR REPLACE FUNCTION is_webadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'webadmin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verificar si es banco (cualquier rol de banco)
CREATE OR REPLACE FUNCTION is_banco()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('banco_admin', 'banco_mesa', 'banco_auditor')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verificar si es cliente
CREATE OR REPLACE FUNCTION is_cliente()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'cliente'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================
-- 3. POLICIES: USERS
-- =====================

-- Los usuarios pueden ver su propio perfil
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (id = auth.uid());

-- Los bancos pueden ver clientes (para ofertar)
CREATE POLICY "users_bancos_ver_clientes" ON users
  FOR SELECT USING (
    is_banco() AND role = 'cliente'
  );

-- WebAdmin puede ver todos
CREATE POLICY "users_webadmin_all" ON users
  FOR ALL USING (is_webadmin());

-- Los usuarios pueden actualizar su propio perfil (campos limitados)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =====================
-- 4. POLICIES: SUBASTAS
-- =====================

-- Cliente ve sus propias subastas
CREATE POLICY "subastas_cliente_own" ON subastas
  FOR SELECT USING (cliente_id = auth.uid());

-- Cliente puede crear subastas
CREATE POLICY "subastas_cliente_insert" ON subastas
  FOR INSERT WITH CHECK (cliente_id = auth.uid() AND is_cliente());

-- Cliente puede actualizar sus subastas (solo si están abiertas)
CREATE POLICY "subastas_cliente_update" ON subastas
  FOR UPDATE USING (cliente_id = auth.uid() AND estado = 'abierta')
  WITH CHECK (cliente_id = auth.uid());

-- Bancos ven subastas donde fueron invitados
CREATE POLICY "subastas_banco_invitado" ON subastas
  FOR SELECT USING (
    is_banco() AND EXISTS (
      SELECT 1 FROM subasta_bancos sb
      WHERE sb.subasta_id = subastas.id AND sb.banco_id = auth.uid()
    )
  );

-- WebAdmin ve todas
CREATE POLICY "subastas_webadmin" ON subastas
  FOR ALL USING (is_webadmin());

-- =====================
-- 5. POLICIES: OFERTAS
-- =====================

-- Banco ve sus propias ofertas
CREATE POLICY "ofertas_banco_own" ON ofertas
  FOR SELECT USING (banco_id = auth.uid());

-- Banco puede crear ofertas (solo en subastas donde fue invitado)
CREATE POLICY "ofertas_banco_insert" ON ofertas
  FOR INSERT WITH CHECK (
    banco_id = auth.uid() AND
    is_banco() AND
    EXISTS (
      SELECT 1 FROM subasta_bancos sb
      WHERE sb.subasta_id = ofertas.subasta_id AND sb.banco_id = auth.uid()
    )
  );

-- Cliente ve ofertas de sus subastas
CREATE POLICY "ofertas_cliente_ver" ON ofertas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM subastas s
      WHERE s.id = ofertas.subasta_id AND s.cliente_id = auth.uid()
    )
  );

-- WebAdmin ve todas
CREATE POLICY "ofertas_webadmin" ON ofertas
  FOR ALL USING (is_webadmin());

-- =====================
-- 6. POLICIES: COMPROMISOS
-- =====================

-- Cliente ve sus compromisos
CREATE POLICY "compromisos_cliente" ON compromisos
  FOR SELECT USING (cliente_id = auth.uid());

-- Banco ve compromisos donde es parte
CREATE POLICY "compromisos_banco" ON compromisos
  FOR SELECT USING (banco_id = auth.uid());

-- Solo WebAdmin puede crear/modificar compromisos (o via Edge Function)
CREATE POLICY "compromisos_webadmin" ON compromisos
  FOR ALL USING (is_webadmin());

-- =====================
-- 7. POLICIES: CLIENTE_BANCO_LIMITES
-- =====================

-- Cliente ve sus limites
CREATE POLICY "limites_cliente" ON cliente_banco_limites
  FOR SELECT USING (cliente_id = auth.uid());

-- Banco ve limites de sus clientes
CREATE POLICY "limites_banco" ON cliente_banco_limites
  FOR SELECT USING (banco_id = auth.uid());

-- Solo banco_admin puede modificar limites
CREATE POLICY "limites_banco_admin" ON cliente_banco_limites
  FOR ALL USING (
    banco_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'banco_admin'
    )
  );

-- WebAdmin puede todo
CREATE POLICY "limites_webadmin" ON cliente_banco_limites
  FOR ALL USING (is_webadmin());

-- =====================
-- 8. POLICIES: DOCUMENTOS_KYC
-- =====================

-- Cliente ve y sube sus documentos
CREATE POLICY "kyc_cliente_own" ON documentos_kyc
  FOR SELECT USING (cliente_id = auth.uid());

CREATE POLICY "kyc_cliente_insert" ON documentos_kyc
  FOR INSERT WITH CHECK (cliente_id = auth.uid() AND is_cliente());

-- Cliente puede eliminar solo documentos pendientes
CREATE POLICY "kyc_cliente_delete" ON documentos_kyc
  FOR DELETE USING (cliente_id = auth.uid() AND estado = 'pendiente');

-- Bancos pueden ver documentos de clientes con limites activos
CREATE POLICY "kyc_banco_ver" ON documentos_kyc
  FOR SELECT USING (
    is_banco() AND EXISTS (
      SELECT 1 FROM cliente_banco_limites cbl
      WHERE cbl.cliente_id = documentos_kyc.cliente_id
      AND cbl.banco_id = auth.uid()
      AND cbl.activo = true
    )
  );

-- WebAdmin puede todo
CREATE POLICY "kyc_webadmin" ON documentos_kyc
  FOR ALL USING (is_webadmin());

-- =====================
-- 9. POLICIES: REGLAS_BANCO
-- =====================

-- Banco ve sus reglas
CREATE POLICY "reglas_banco_own" ON reglas_banco
  FOR SELECT USING (banco_id = auth.uid());

-- Solo banco_admin modifica reglas
CREATE POLICY "reglas_banco_admin" ON reglas_banco
  FOR ALL USING (
    banco_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'banco_admin'
    )
  );

-- WebAdmin puede todo
CREATE POLICY "reglas_webadmin" ON reglas_banco
  FOR ALL USING (is_webadmin());

-- =====================
-- 10. POLICIES: AUDITORIA
-- =====================

-- Solo WebAdmin puede leer auditoria
CREATE POLICY "auditoria_webadmin_select" ON auditoria
  FOR SELECT USING (is_webadmin());

-- Cualquier usuario autenticado puede insertar (via RPC)
CREATE POLICY "auditoria_insert_all" ON auditoria
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================
-- 11. POLICIES: SUBASTA_BANCOS (tabla de invitaciones)
-- =====================

-- Cliente ve invitaciones de sus subastas
CREATE POLICY "subasta_bancos_cliente" ON subasta_bancos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM subastas s
      WHERE s.id = subasta_bancos.subasta_id AND s.cliente_id = auth.uid()
    )
  );

-- Cliente puede invitar bancos a sus subastas
CREATE POLICY "subasta_bancos_cliente_insert" ON subasta_bancos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM subastas s
      WHERE s.id = subasta_bancos.subasta_id AND s.cliente_id = auth.uid()
    )
  );

-- Banco ve donde fue invitado
CREATE POLICY "subasta_bancos_banco" ON subasta_bancos
  FOR SELECT USING (banco_id = auth.uid());

-- WebAdmin puede todo
CREATE POLICY "subasta_bancos_webadmin" ON subasta_bancos
  FOR ALL USING (is_webadmin());

-- =====================
-- 12. STORAGE: DOCUMENTOS-KYC
-- =====================

-- Crear policy para el bucket de documentos
-- (Ejecutar en Storage > Policies en Supabase Dashboard)

-- INSERT: Cliente sube a su carpeta
-- CREATE POLICY "kyc_storage_insert" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'documentos-kyc' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

-- SELECT: Cliente ve sus archivos, bancos con relacion activa
-- CREATE POLICY "kyc_storage_select" ON storage.objects
--   FOR SELECT USING (
--     bucket_id = 'documentos-kyc' AND (
--       auth.uid()::text = (storage.foldername(name))[1] OR
--       is_webadmin() OR
--       (is_banco() AND EXISTS (
--         SELECT 1 FROM cliente_banco_limites cbl
--         WHERE cbl.cliente_id::text = (storage.foldername(name))[1]
--         AND cbl.banco_id = auth.uid()
--         AND cbl.activo = true
--       ))
--     )
--   );

-- DELETE: Solo el cliente propietario
-- CREATE POLICY "kyc_storage_delete" ON storage.objects
--   FOR DELETE USING (
--     bucket_id = 'documentos-kyc' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

-- =====================
-- FIN DE MIGRACION RLS
-- =====================
