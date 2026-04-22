-- ============================================================
-- FUNDLINK: Migración 017 - Ejecución de compromiso por cliente_admin
-- Corrección: quien ejecuta es el CLIENTE (confirma desembolso),
-- no el banco. Se actualiza la RPC y se agrega obtener_bancos_activos.
-- ============================================================

-- 1. Actualizar ejecutar_compromiso: ahora lo autoriza cliente_admin
CREATE OR REPLACE FUNCTION ejecutar_compromiso(p_compromiso_id UUID)
RETURNS TABLE(id uuid, estado text)
LANGUAGE plpgsql SECURITY DEFINER SET row_security = off AS $$
BEGIN
  -- Verificar que el caller es cliente_admin de la misma entidad del compromiso
  IF NOT EXISTS (
    SELECT 1 FROM compromisos c
    JOIN users caller ON caller.id = auth.uid()
    JOIN users cli    ON cli.id = c.cliente_id
    WHERE c.id = p_compromiso_id
      AND caller.role = 'cliente_admin'
      AND cli.entidad = caller.entidad
      AND c.estado = 'confirmado'
  ) THEN
    RAISE EXCEPTION 'Sin permiso para ejecutar este compromiso o el estado no es confirmado';
  END IF;

  RETURN QUERY
  UPDATE compromisos
  SET
    estado          = 'ejecutado',
    fecha_ejecucion = NOW(),
    updated_at      = NOW()
  WHERE compromisos.id = p_compromiso_id
  RETURNING compromisos.id, compromisos.estado;
END;
$$;

GRANT EXECUTE ON FUNCTION ejecutar_compromiso(uuid) TO authenticated;

-- 2. Obtener todos los bancos activos del catálogo (para modal externo)
CREATE OR REPLACE FUNCTION obtener_bancos_activos()
RETURNS TABLE(banco_id uuid, banco_nombre text)
LANGUAGE sql SECURITY DEFINER STABLE SET row_security = off AS $$
  SELECT b.id AS banco_id, b.nombre AS banco_nombre
  FROM bancos b
  WHERE b.activo = true
  ORDER BY b.nombre;
$$;

GRANT EXECUTE ON FUNCTION obtener_bancos_activos() TO authenticated;
