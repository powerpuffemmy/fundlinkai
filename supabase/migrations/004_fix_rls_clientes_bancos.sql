-- ============================================
-- FUNDLINK: Fix RLS - Clientes pueden ver bancos
-- ============================================
-- Ejecutar en Supabase SQL Editor:
-- Dashboard → SQL Editor → New query → Pegar y ejecutar
-- ============================================

-- 1. Agregar policy para que clientes puedan ver usuarios de bancos
--    Usa get_user_role() (SECURITY DEFINER) para evitar recursión infinita en RLS
DROP POLICY IF EXISTS "users_clientes_ver_bancos" ON users;
CREATE POLICY "users_clientes_ver_bancos" ON users
  FOR SELECT USING (
    get_user_role() = 'cliente'
    AND role IN ('banco_admin', 'banco_mesa')
    AND activo = true
  );

-- 2. Crear función RPC para que clientes obtengan lista de todos los bancos
--    (con SECURITY DEFINER para bypassar RLS en caso de que el cliente
--     no tenga la policy correcta aún)
CREATE OR REPLACE FUNCTION obtener_todos_bancos()
RETURNS TABLE(
  id uuid,
  nombre text,
  entidad text
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (u.entidad)
    u.id,
    u.nombre,
    u.entidad
  FROM users u
  WHERE u.role = 'banco_admin'
    AND u.activo = true
  ORDER BY u.entidad, u.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Dar permisos a usuarios autenticados para llamar la función
GRANT EXECUTE ON FUNCTION obtener_todos_bancos() TO authenticated;

-- 4. Verificar que la función funciona
SELECT * FROM obtener_todos_bancos();
