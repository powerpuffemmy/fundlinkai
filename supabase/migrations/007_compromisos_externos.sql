-- ============================================
-- FUNDLINK: Compromisos Externos
-- ============================================
-- Permite a clientes registrar compromisos con bancos
-- que NO están en la plataforma FundLink.
-- ============================================

-- =====================
-- 1. COLUMNAS NUEVAS EN COMPROMISOS
-- =====================

ALTER TABLE compromisos ADD COLUMN IF NOT EXISTS es_externo boolean DEFAULT false;
ALTER TABLE compromisos ADD COLUMN IF NOT EXISTS contraparte_nombre text;
ALTER TABLE compromisos ADD COLUMN IF NOT EXISTS documento_url text;

-- Hacer banco_id nullable (externos no tienen banco en sistema)
ALTER TABLE compromisos ALTER COLUMN banco_id DROP NOT NULL;

-- Constraint: internos requieren banco_id, externos requieren contraparte_nombre
ALTER TABLE compromisos ADD CONSTRAINT compromisos_externo_check
  CHECK (
    (es_externo = false AND banco_id IS NOT NULL)
    OR
    (es_externo = true AND contraparte_nombre IS NOT NULL AND contraparte_nombre != '')
  );

-- =====================
-- 2. RLS: UPDATE/DELETE para clientes en sus compromisos externos
-- =====================

CREATE POLICY "compromisos_cliente_update_externo" ON compromisos
  FOR UPDATE USING (
    cliente_id = auth.uid()
    AND es_externo = true
    AND get_user_role() = 'cliente'
  )
  WITH CHECK (
    cliente_id = auth.uid()
    AND es_externo = true
  );

CREATE POLICY "compromisos_cliente_delete_externo" ON compromisos
  FOR DELETE USING (
    cliente_id = auth.uid()
    AND es_externo = true
    AND get_user_role() = 'cliente'
  );

-- =====================
-- 3. TRIGGER: validate_compromiso (agregar prefijo EXT- para externos)
-- =====================

CREATE OR REPLACE FUNCTION validate_compromiso()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar monto positivo
  IF NEW.monto <= 0 THEN
    RAISE EXCEPTION 'El monto del compromiso debe ser mayor a 0';
  END IF;

  -- Validar tasa positiva
  IF NEW.tasa <= 0 OR NEW.tasa > 50 THEN
    RAISE EXCEPTION 'La tasa debe estar entre 0 y 50%%';
  END IF;

  -- Validar plazo
  IF NEW.plazo < 1 OR NEW.plazo > 365 THEN
    RAISE EXCEPTION 'El plazo debe estar entre 1 y 365 días';
  END IF;

  -- Validar fechas coherentes
  IF NEW.fecha_vencimiento <= NEW.fecha_inicio THEN
    RAISE EXCEPTION 'La fecha de vencimiento debe ser posterior a la fecha de inicio';
  END IF;

  -- Validar estado
  IF NEW.estado NOT IN ('vigente', 'vencido', 'renovado', 'cancelado') THEN
    RAISE EXCEPTION 'Estado de compromiso no válido';
  END IF;

  -- Generar OP-ID con prefijo EXT- para externos
  IF NEW.op_id IS NULL OR NEW.op_id = '' THEN
    IF NEW.es_externo = true THEN
      NEW.op_id := 'EXT-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    ELSE
      NEW.op_id := 'OP-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================
-- 4. TRIGGER: update_limite_utilizado (saltar externos)
-- =====================

CREATE OR REPLACE FUNCTION update_limite_utilizado()
RETURNS TRIGGER AS $func$
DECLARE
  v_banco_catalog_id uuid;
BEGIN
  -- Saltar compromisos externos (no afectan límites FundLink)
  IF NEW.es_externo = true THEN
    RETURN NEW;
  END IF;

  SELECT banco_catalog_id INTO v_banco_catalog_id FROM users WHERE id = NEW.banco_id;

  IF TG_OP = 'INSERT' AND NEW.estado = 'vigente' THEN
    UPDATE cliente_banco_limites
    SET monto_utilizado = monto_utilizado + NEW.monto, updated_at = NOW()
    WHERE cliente_id = NEW.cliente_id AND banco_id = v_banco_catalog_id;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.estado = 'vigente' AND NEW.estado IN ('vencido', 'cancelado') THEN
    SELECT banco_catalog_id INTO v_banco_catalog_id FROM users WHERE id = OLD.banco_id;
    UPDATE cliente_banco_limites
    SET monto_utilizado = GREATEST(0, monto_utilizado - OLD.monto), updated_at = NOW()
    WHERE cliente_id = NEW.cliente_id AND banco_id = v_banco_catalog_id;
  END IF;

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- =====================
-- 5. TRIGGER: notify_compromiso_creado (saltar externos)
-- =====================

CREATE OR REPLACE FUNCTION notify_compromiso_creado()
RETURNS TRIGGER AS $$
DECLARE
  v_cliente RECORD;
  v_banco RECORD;
BEGIN
  -- Saltar notificaciones para compromisos externos (no hay banco en sistema)
  IF NEW.es_externo = true THEN
    RETURN NEW;
  END IF;

  -- Obtener datos
  SELECT * INTO v_cliente FROM users WHERE id = NEW.cliente_id;
  SELECT * INTO v_banco FROM users WHERE id = NEW.banco_id;

  -- Notificar al cliente
  PERFORM notify_via_edge_function(
    'compromiso_creado',
    v_cliente.email,
    v_cliente.nombre,
    jsonb_build_object(
      'op_id', NEW.op_id,
      'monto', NEW.monto,
      'moneda', NEW.moneda,
      'tasa', NEW.tasa,
      'fecha_inicio', NEW.fecha_inicio,
      'fecha_vencimiento', NEW.fecha_vencimiento
    )
  );

  -- Notificar al banco
  PERFORM notify_via_edge_function(
    'compromiso_creado',
    v_banco.email,
    v_banco.nombre,
    jsonb_build_object(
      'op_id', NEW.op_id,
      'monto', NEW.monto,
      'moneda', NEW.moneda,
      'tasa', NEW.tasa,
      'fecha_inicio', NEW.fecha_inicio,
      'fecha_vencimiento', NEW.fecha_vencimiento
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 6. RPC: obtener_compromisos_usuario (LEFT JOIN + campos nuevos)
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
BEGIN
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
  WHERE c.cliente_id = p_user_id OR c.banco_id = p_user_id
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET row_security = off;
GRANT EXECUTE ON FUNCTION obtener_compromisos_usuario(uuid) TO authenticated;

-- =====================
-- 7. STORAGE: Bucket para documentos de compromisos
-- =====================

INSERT INTO storage.buckets (id, name, public)
VALUES ('compromisos-documentos', 'compromisos-documentos', true)
ON CONFLICT DO NOTHING;

-- Policy: clientes suben a su carpeta
CREATE POLICY "compromisos_docs_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'compromisos-documentos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: clientes leen sus archivos, webadmin lee todo
CREATE POLICY "compromisos_docs_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'compromisos-documentos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'webadmin')
    )
  );

-- Policy: clientes borran sus propios archivos
CREATE POLICY "compromisos_docs_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'compromisos-documentos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
