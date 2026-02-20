-- ============================================
-- FUNDLINK: Validaciones y Triggers de Seguridad
-- ============================================
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- =====================
-- 1. VALIDACIONES EN SUBASTAS
-- =====================

-- Trigger para validar subasta antes de insertar
CREATE OR REPLACE FUNCTION validate_subasta()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar monto positivo
  IF NEW.monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0';
  END IF;

  -- Validar monto máximo razonable (100M)
  IF NEW.monto > 100000000 THEN
    RAISE EXCEPTION 'El monto excede el límite permitido';
  END IF;

  -- Validar plazo entre 1 y 365 días
  IF NEW.plazo < 1 OR NEW.plazo > 365 THEN
    RAISE EXCEPTION 'El plazo debe estar entre 1 y 365 días';
  END IF;

  -- Validar duración de subasta entre 1 y 72 horas
  IF NEW.duracion < 1 OR NEW.duracion > 72 THEN
    RAISE EXCEPTION 'La duración debe estar entre 1 y 72 horas';
  END IF;

  -- Validar tasa objetivo si existe (entre 0 y 50%)
  IF NEW.tasa_objetivo IS NOT NULL AND (NEW.tasa_objetivo < 0 OR NEW.tasa_objetivo > 50) THEN
    RAISE EXCEPTION 'La tasa objetivo debe estar entre 0 y 50%%';
  END IF;

  -- Validar moneda permitida
  IF NEW.moneda NOT IN ('USD', 'GTQ') THEN
    RAISE EXCEPTION 'Moneda no permitida. Use USD o GTQ';
  END IF;

  -- Validar tipo de subasta
  IF NEW.tipo NOT IN ('abierta', 'sellada', 'holandesa', 'multi') THEN
    RAISE EXCEPTION 'Tipo de subasta no válido';
  END IF;

  -- Calcular fecha de expiración si no existe
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + (NEW.duracion || ' hours')::interval;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_subasta_trigger ON subastas;
CREATE TRIGGER validate_subasta_trigger
  BEFORE INSERT OR UPDATE ON subastas
  FOR EACH ROW EXECUTE FUNCTION validate_subasta();

-- =====================
-- 2. VALIDACIONES EN OFERTAS
-- =====================

CREATE OR REPLACE FUNCTION validate_oferta()
RETURNS TRIGGER AS $$
DECLARE
  v_subasta RECORD;
  v_limite RECORD;
  v_tiene_oferta BOOLEAN;
BEGIN
  -- Obtener datos de la subasta
  SELECT * INTO v_subasta FROM subastas WHERE id = NEW.subasta_id;

  -- Validar que la subasta existe
  IF v_subasta IS NULL THEN
    RAISE EXCEPTION 'La subasta no existe';
  END IF;

  -- Validar que la subasta está abierta
  IF v_subasta.estado != 'abierta' THEN
    RAISE EXCEPTION 'La subasta no está abierta para ofertas';
  END IF;

  -- Validar que no ha expirado
  IF v_subasta.expires_at < NOW() THEN
    RAISE EXCEPTION 'La subasta ha expirado';
  END IF;

  -- Validar tasa positiva y razonable
  IF NEW.tasa <= 0 OR NEW.tasa > 50 THEN
    RAISE EXCEPTION 'La tasa debe estar entre 0 y 50%%';
  END IF;

  -- Validar que el banco tiene limite con el cliente
  SELECT * INTO v_limite
  FROM cliente_banco_limites
  WHERE cliente_id = v_subasta.cliente_id
    AND banco_id = NEW.banco_id
    AND activo = true;

  IF v_limite IS NULL THEN
    RAISE EXCEPTION 'No tiene línea de crédito activa con este cliente';
  END IF;

  -- Validar que tiene limite disponible
  IF (v_limite.limite_monto - v_limite.monto_utilizado) < v_subasta.monto THEN
    RAISE EXCEPTION 'Límite de crédito insuficiente para esta operación';
  END IF;

  -- Validar que no tiene oferta duplicada (solo una por subasta)
  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS (
      SELECT 1 FROM ofertas
      WHERE subasta_id = NEW.subasta_id AND banco_id = NEW.banco_id
    ) INTO v_tiene_oferta;

    IF v_tiene_oferta THEN
      RAISE EXCEPTION 'Ya tiene una oferta en esta subasta';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_oferta_trigger ON ofertas;
CREATE TRIGGER validate_oferta_trigger
  BEFORE INSERT OR UPDATE ON ofertas
  FOR EACH ROW EXECUTE FUNCTION validate_oferta();

-- =====================
-- 3. VALIDACIONES EN COMPROMISOS
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

  -- Generar OP-ID si no existe
  IF NEW.op_id IS NULL OR NEW.op_id = '' THEN
    NEW.op_id := 'OP-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_compromiso_trigger ON compromisos;
CREATE TRIGGER validate_compromiso_trigger
  BEFORE INSERT OR UPDATE ON compromisos
  FOR EACH ROW EXECUTE FUNCTION validate_compromiso();

-- =====================
-- 4. ACTUALIZAR MONTO UTILIZADO AL CREAR COMPROMISO
-- =====================

CREATE OR REPLACE FUNCTION update_limite_utilizado()
RETURNS TRIGGER AS $$
BEGIN
  -- Al crear un compromiso vigente, aumentar monto utilizado
  IF TG_OP = 'INSERT' AND NEW.estado = 'vigente' THEN
    UPDATE cliente_banco_limites
    SET monto_utilizado = monto_utilizado + NEW.monto,
        updated_at = NOW()
    WHERE cliente_id = NEW.cliente_id AND banco_id = NEW.banco_id;
  END IF;

  -- Al cancelar/vencer, liberar el monto
  IF TG_OP = 'UPDATE' AND OLD.estado = 'vigente' AND NEW.estado IN ('vencido', 'cancelado') THEN
    UPDATE cliente_banco_limites
    SET monto_utilizado = GREATEST(0, monto_utilizado - OLD.monto),
        updated_at = NOW()
    WHERE cliente_id = NEW.cliente_id AND banco_id = NEW.banco_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_limite_utilizado_trigger ON compromisos;
CREATE TRIGGER update_limite_utilizado_trigger
  AFTER INSERT OR UPDATE ON compromisos
  FOR EACH ROW EXECUTE FUNCTION update_limite_utilizado();

-- =====================
-- 5. AUTO-EXPIRAR SUBASTAS
-- =====================

CREATE OR REPLACE FUNCTION expirar_subastas_vencidas()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE subastas
  SET estado = 'expirada',
      updated_at = NOW()
  WHERE estado = 'abierta'
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 6. AUTO-MARCAR COMPROMISOS VENCIDOS
-- =====================

CREATE OR REPLACE FUNCTION marcar_compromisos_vencidos()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE compromisos
  SET estado = 'vencido',
      updated_at = NOW()
  WHERE estado = 'vigente'
    AND fecha_vencimiento < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 7. VALIDAR LIMITE ANTES DE CREAR
-- =====================

CREATE OR REPLACE FUNCTION validate_cliente_banco_limite()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar límite positivo
  IF NEW.limite_monto <= 0 THEN
    RAISE EXCEPTION 'El límite debe ser mayor a 0';
  END IF;

  -- Validar límite máximo razonable
  IF NEW.limite_monto > 500000000 THEN
    RAISE EXCEPTION 'El límite excede el máximo permitido';
  END IF;

  -- Inicializar monto utilizado si es nuevo
  IF TG_OP = 'INSERT' AND NEW.monto_utilizado IS NULL THEN
    NEW.monto_utilizado := 0;
  END IF;

  -- No permitir monto utilizado mayor al limite
  IF NEW.monto_utilizado > NEW.limite_monto THEN
    RAISE EXCEPTION 'El monto utilizado no puede exceder el límite';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_limite_trigger ON cliente_banco_limites;
CREATE TRIGGER validate_limite_trigger
  BEFORE INSERT OR UPDATE ON cliente_banco_limites
  FOR EACH ROW EXECUTE FUNCTION validate_cliente_banco_limite();

-- =====================
-- 8. AUDITORIA AUTOMATICA
-- =====================

CREATE OR REPLACE FUNCTION audit_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO auditoria (user_id, user_email, user_role, accion, detalle, metadata)
  SELECT
    auth.uid(),
    u.email,
    u.role,
    TG_OP || '_' || TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN 'Eliminado registro'
      WHEN TG_OP = 'INSERT' THEN 'Creado nuevo registro'
      ELSE 'Actualizado registro'
    END,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'record_id', COALESCE(NEW.id, OLD.id)
    )
  FROM users u WHERE u.id = auth.uid();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar auditoria a tablas críticas
DROP TRIGGER IF EXISTS audit_subastas ON subastas;
CREATE TRIGGER audit_subastas
  AFTER INSERT OR UPDATE OR DELETE ON subastas
  FOR EACH ROW EXECUTE FUNCTION audit_changes();

DROP TRIGGER IF EXISTS audit_ofertas ON ofertas;
CREATE TRIGGER audit_ofertas
  AFTER INSERT OR UPDATE OR DELETE ON ofertas
  FOR EACH ROW EXECUTE FUNCTION audit_changes();

DROP TRIGGER IF EXISTS audit_compromisos ON compromisos;
CREATE TRIGGER audit_compromisos
  AFTER INSERT OR UPDATE OR DELETE ON compromisos
  FOR EACH ROW EXECUTE FUNCTION audit_changes();

-- =====================
-- 9. CRON JOBS (pg_cron extension)
-- =====================

-- Habilitar pg_cron si no está habilitado:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Expirar subastas cada 5 minutos
-- SELECT cron.schedule('expire-subastas', '*/5 * * * *', 'SELECT expirar_subastas_vencidas()');

-- Marcar compromisos vencidos cada hora
-- SELECT cron.schedule('vencer-compromisos', '0 * * * *', 'SELECT marcar_compromisos_vencidos()');

-- =====================
-- FIN DE VALIDACIONES
-- =====================
