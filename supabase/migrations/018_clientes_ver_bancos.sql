-- 018_clientes_ver_bancos.sql
-- Permite que clientes vean datos públicos de usuarios banco.
-- Necesario para mostrar nombre/entidad del banco en ofertas de subastas.

DROP POLICY IF EXISTS "users_clientes_ver_bancos" ON users;

CREATE POLICY "users_clientes_ver_bancos" ON users
  FOR SELECT USING (
    get_user_role() IN ('cliente_admin', 'cliente_usuario')
    AND role IN ('banco_admin', 'banco_mesa', 'banco_auditor')
  );
