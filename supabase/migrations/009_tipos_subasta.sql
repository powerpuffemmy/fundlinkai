-- ============================================
-- FUNDLINK: Migración 009 - Nuevos tipos de subasta
-- ============================================
-- Reemplaza tipos (abierta, sellada, holandesa, multi)
-- por (rapida, programada)
-- Duración ahora en minutos (antes era ambiguo horas/minutos)
-- ============================================

-- 1. Migrar subastas históricas a tipo 'rapida'
UPDATE subastas
SET tipo = 'rapida'
WHERE tipo IN ('abierta', 'sellada', 'holandesa', 'multi');

-- 2. Actualizar trigger de validación
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

  -- Validar duración de subasta entre 1 y 43200 minutos (30 días)
  IF NEW.duracion < 1 OR NEW.duracion > 43200 THEN
    RAISE EXCEPTION 'La duración debe estar entre 1 minuto y 30 días';
  END IF;

  -- Validar tasa objetivo si existe (entre 0 y 50%)
  IF NEW.tasa_objetivo IS NOT NULL AND (NEW.tasa_objetivo < 0 OR NEW.tasa_objetivo > 50) THEN
    RAISE EXCEPTION 'La tasa objetivo debe estar entre 0 y 50%%';
  END IF;

  -- Validar moneda permitida
  IF NEW.moneda NOT IN ('USD', 'GTQ') THEN
    RAISE EXCEPTION 'Moneda no permitida. Use USD o GTQ';
  END IF;

  -- Validar tipo de subasta (incluye históricos para compatibilidad)
  IF NEW.tipo NOT IN ('rapida', 'programada', 'abierta', 'sellada', 'holandesa', 'multi') THEN
    RAISE EXCEPTION 'Tipo de subasta no válido';
  END IF;

  -- Calcular fecha de expiración si no existe (duracion en minutos)
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + (NEW.duracion || ' minutes')::interval;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FIN DE MIGRACIÓN 009
-- ============================================
