-- ============================================================
-- FUNDLINK: Migración 016 - RPC ejecutar_compromiso
-- Permite a banco_admin marcar un compromiso como 'ejecutado'
-- sin requerir UPDATE directo (evita restricción RLS de la tabla).
-- ============================================================

CREATE OR REPLACE FUNCTION ejecutar_compromiso(p_compromiso_id UUID)
RETURNS TABLE(id uuid, estado text)
LANGUAGE plpgsql SECURITY DEFINER SET row_security = off AS $$
BEGIN
  -- Verificar que el caller es banco_admin y dueño del compromiso en estado confirmado
  IF NOT EXISTS (
    SELECT 1 FROM compromisos c
    JOIN users u ON u.id = auth.uid()
    WHERE c.id = p_compromiso_id
      AND c.banco_id = auth.uid()
      AND u.role = 'banco_admin'
      AND c.estado = 'confirmado'
  ) THEN
    RAISE EXCEPTION 'Sin permiso para ejecutar este compromiso o el estado no es confirmado';
  END IF;

  RETURN QUERY
  UPDATE compromisos
  SET
    estado       = 'ejecutado',
    fecha_ejecucion = NOW(),
    updated_at   = NOW()
  WHERE compromisos.id = p_compromiso_id
  RETURNING compromisos.id, compromisos.estado;
END;
$$;

GRANT EXECUTE ON FUNCTION ejecutar_compromiso(uuid) TO authenticated;
