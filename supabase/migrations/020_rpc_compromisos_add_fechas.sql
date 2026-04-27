-- =====================
-- 020. Actualizar obtener_compromisos_usuario
--      Agregar fecha_confirmacion y fecha_ejecucion al resultado
-- =====================

DROP FUNCTION IF EXISTS obtener_compromisos_usuario(uuid);

CREATE OR REPLACE FUNCTION obtener_compromisos_usuario(p_user_id uuid)
RETURNS TABLE(
  id uuid, op_id text, cliente_id uuid, banco_id uuid,
  subasta_id uuid, oferta_id uuid, monto numeric, moneda text,
  tasa numeric, plazo integer, fecha_inicio date, fecha_vencimiento date,
  fecha_confirmacion timestamptz, fecha_ejecucion timestamptz,
  estado text, notas text, created_at timestamptz, updated_at timestamptz,
  banco_nombre text, banco_entidad text, cliente_nombre text, cliente_entidad text,
  es_externo boolean, contraparte_nombre text, documento_url text
) AS $$
DECLARE
  v_role text;
  v_entidad text;
BEGIN
  SELECT u.role, u.entidad INTO v_role, v_entidad
  FROM users u WHERE u.id = p_user_id;

  IF v_role IN ('cliente_admin', 'cliente_usuario') THEN
    RETURN QUERY
    SELECT
      c.id, c.op_id, c.cliente_id, c.banco_id,
      c.subasta_id, c.oferta_id, c.monto, c.moneda,
      c.tasa, c.plazo, c.fecha_inicio, c.fecha_vencimiento,
      c.fecha_confirmacion, c.fecha_ejecucion,
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
    RETURN QUERY
    SELECT
      c.id, c.op_id, c.cliente_id, c.banco_id,
      c.subasta_id, c.oferta_id, c.monto, c.moneda,
      c.tasa, c.plazo, c.fecha_inicio, c.fecha_vencimiento,
      c.fecha_confirmacion, c.fecha_ejecucion,
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
