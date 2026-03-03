-- ============================================================
-- FUNDLINK: Migración 013 - Estados Confirmado/Ejecutado en Compromisos
-- Nuevo flujo: compromiso se crea como 'confirmado' (contrato firmado),
-- luego el banco marca 'ejecutado' cuando el cliente hace el desembolso.
-- ============================================================

-- 1. Nuevas columnas de fechas
ALTER TABLE compromisos
  ADD COLUMN IF NOT EXISTS fecha_confirmacion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_ejecucion    TIMESTAMPTZ;

-- 2. Backfill: compromisos existentes toman fecha_confirmacion = created_at
UPDATE compromisos
SET fecha_confirmacion = created_at
WHERE fecha_confirmacion IS NULL;

-- 3. Ampliar CHECK constraint de estado para incluir nuevos estados
ALTER TABLE compromisos DROP CONSTRAINT IF EXISTS compromisos_estado_check;
ALTER TABLE compromisos
  ADD CONSTRAINT compromisos_estado_check
  CHECK (estado IN ('confirmado', 'ejecutado', 'vigente', 'vencido', 'renovado', 'cancelado'));

-- 4. Actualizar trigger validate_compromiso para aceptar nuevos estados
CREATE OR REPLACE FUNCTION validate_compromiso()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.monto <= 0 THEN
    RAISE EXCEPTION 'El monto del compromiso debe ser mayor a 0';
  END IF;
  IF NEW.tasa <= 0 OR NEW.tasa > 50 THEN
    RAISE EXCEPTION 'La tasa debe estar entre 0 y 50%%';
  END IF;
  IF NEW.plazo < 1 OR NEW.plazo > 365 THEN
    RAISE EXCEPTION 'El plazo debe estar entre 1 y 365 días';
  END IF;
  IF NEW.fecha_vencimiento <= NEW.fecha_inicio THEN
    RAISE EXCEPTION 'La fecha de vencimiento debe ser posterior a la fecha de inicio';
  END IF;
  IF NEW.estado NOT IN ('confirmado', 'ejecutado', 'vigente', 'vencido', 'renovado', 'cancelado') THEN
    RAISE EXCEPTION 'Estado de compromiso no válido';
  END IF;
  IF NEW.op_id IS NULL OR NEW.op_id = '' THEN
    IF NEW.es_externo = true THEN
      NEW.op_id := 'EXT-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    ELSE
      NEW.op_id := 'OP-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
