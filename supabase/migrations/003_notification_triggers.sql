-- ============================================
-- FUNDLINK: Triggers de Notificaciones por Email
-- ============================================
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- =====================
-- 1. FUNCIÓN GENÉRICA PARA LLAMAR EDGE FUNCTION
-- =====================

CREATE OR REPLACE FUNCTION notify_via_edge_function(
  p_tipo TEXT,
  p_email TEXT,
  p_nombre TEXT,
  p_datos JSONB
)
RETURNS void AS $$
DECLARE
  v_url TEXT;
  v_anon_key TEXT;
BEGIN
  -- Obtener URL del proyecto (ajustar según tu proyecto)
  v_url := 'https://ewcvkvnnixrxmiruzmie.supabase.co/functions/v1/enviar-email';

  -- Obtener anon key desde configuración (o hardcodear para testing)
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);

  -- Si no hay key configurada, usar net.http_post sin auth (solo para desarrollo)
  -- En producción, configurar: ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'tu-key';

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_anon_key, '')
    ),
    body := jsonb_build_object(
      'tipo', p_tipo,
      'destinatario', jsonb_build_object(
        'email', p_email,
        'nombre', p_nombre
      ),
      'datos', p_datos
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Log error pero no fallar la transacción principal
  RAISE WARNING 'Error enviando notificación: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 2. NOTIFICAR NUEVA OFERTA AL CLIENTE
-- =====================

CREATE OR REPLACE FUNCTION notify_nueva_oferta()
RETURNS TRIGGER AS $$
DECLARE
  v_subasta RECORD;
  v_cliente RECORD;
  v_banco RECORD;
BEGIN
  -- Obtener datos de la subasta
  SELECT * INTO v_subasta FROM subastas WHERE id = NEW.subasta_id;

  -- Obtener datos del cliente
  SELECT * INTO v_cliente FROM users WHERE id = v_subasta.cliente_id;

  -- Obtener datos del banco
  SELECT * INTO v_banco FROM users WHERE id = NEW.banco_id;

  -- Enviar notificación
  PERFORM notify_via_edge_function(
    'nueva_oferta',
    v_cliente.email,
    v_cliente.nombre,
    jsonb_build_object(
      'cliente_nombre', v_cliente.nombre,
      'banco_nombre', v_banco.entidad,
      'monto', v_subasta.monto,
      'moneda', v_subasta.moneda,
      'tasa', NEW.tasa,
      'plazo', v_subasta.plazo
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_nueva_oferta ON ofertas;
CREATE TRIGGER trigger_notify_nueva_oferta
  AFTER INSERT ON ofertas
  FOR EACH ROW
  EXECUTE FUNCTION notify_nueva_oferta();

-- =====================
-- 3. NOTIFICAR OFERTA ADJUDICADA AL BANCO
-- =====================

CREATE OR REPLACE FUNCTION notify_oferta_adjudicada()
RETURNS TRIGGER AS $$
DECLARE
  v_subasta RECORD;
  v_cliente RECORD;
  v_banco RECORD;
  v_compromiso RECORD;
BEGIN
  -- Solo si cambió a 'adjudicada'
  IF NEW.estado = 'adjudicada' AND (OLD.estado IS NULL OR OLD.estado != 'adjudicada') THEN
    -- Obtener datos
    SELECT * INTO v_subasta FROM subastas WHERE id = NEW.subasta_id;
    SELECT * INTO v_cliente FROM users WHERE id = v_subasta.cliente_id;
    SELECT * INTO v_banco FROM users WHERE id = NEW.banco_id;

    -- Buscar compromiso relacionado
    SELECT * INTO v_compromiso FROM compromisos WHERE oferta_id = NEW.id LIMIT 1;

    -- Notificar al banco
    PERFORM notify_via_edge_function(
      'oferta_adjudicada',
      v_banco.email,
      v_banco.nombre,
      jsonb_build_object(
        'banco_nombre', v_banco.nombre,
        'cliente_nombre', v_cliente.entidad,
        'monto', v_subasta.monto,
        'moneda', v_subasta.moneda,
        'tasa', NEW.tasa,
        'op_id', COALESCE(v_compromiso.op_id, 'N/A'),
        'fecha_vencimiento', COALESCE(v_compromiso.fecha_vencimiento::text, 'Por definir')
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_oferta_adjudicada ON ofertas;
CREATE TRIGGER trigger_notify_oferta_adjudicada
  AFTER UPDATE ON ofertas
  FOR EACH ROW
  EXECUTE FUNCTION notify_oferta_adjudicada();

-- =====================
-- 4. NOTIFICAR COMPROMISO CREADO
-- =====================

CREATE OR REPLACE FUNCTION notify_compromiso_creado()
RETURNS TRIGGER AS $$
DECLARE
  v_cliente RECORD;
  v_banco RECORD;
BEGIN
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

DROP TRIGGER IF EXISTS trigger_notify_compromiso_creado ON compromisos;
CREATE TRIGGER trigger_notify_compromiso_creado
  AFTER INSERT ON compromisos
  FOR EACH ROW
  EXECUTE FUNCTION notify_compromiso_creado();

-- =====================
-- 5. NOTIFICAR DOCUMENTO KYC APROBADO/RECHAZADO
-- =====================

CREATE OR REPLACE FUNCTION notify_documento_kyc()
RETURNS TRIGGER AS $$
DECLARE
  v_cliente RECORD;
BEGIN
  -- Solo si cambió el estado
  IF NEW.estado != OLD.estado AND NEW.estado IN ('aprobado', 'rechazado') THEN
    SELECT * INTO v_cliente FROM users WHERE id = NEW.cliente_id;

    IF NEW.estado = 'aprobado' THEN
      PERFORM notify_via_edge_function(
        'documento_aprobado',
        v_cliente.email,
        v_cliente.nombre,
        jsonb_build_object(
          'cliente_nombre', v_cliente.nombre,
          'tipo_documento', NEW.tipo_documento,
          'nombre_archivo', NEW.nombre_archivo,
          'fecha_aprobacion', NOW()::date
        )
      );
    ELSE
      PERFORM notify_via_edge_function(
        'documento_rechazado',
        v_cliente.email,
        v_cliente.nombre,
        jsonb_build_object(
          'cliente_nombre', v_cliente.nombre,
          'tipo_documento', NEW.tipo_documento,
          'motivo_rechazo', COALESCE(NEW.notas_revision, 'No especificado')
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_documento_kyc ON documentos_kyc;
CREATE TRIGGER trigger_notify_documento_kyc
  AFTER UPDATE ON documentos_kyc
  FOR EACH ROW
  EXECUTE FUNCTION notify_documento_kyc();

-- =====================
-- 6. NOTIFICAR CUENTA APROBADA
-- =====================

CREATE OR REPLACE FUNCTION notify_cuenta_aprobada()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo si cambió a aprobado
  IF NEW.aprobado_por_admin = true AND (OLD.aprobado_por_admin IS NULL OR OLD.aprobado_por_admin = false) THEN
    PERFORM notify_via_edge_function(
      'cuenta_aprobada',
      NEW.email,
      NEW.nombre,
      jsonb_build_object(
        'cliente_nombre', NEW.nombre
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_cuenta_aprobada ON users;
CREATE TRIGGER trigger_notify_cuenta_aprobada
  AFTER UPDATE ON users
  FOR EACH ROW
  WHEN (NEW.role = 'cliente')
  EXECUTE FUNCTION notify_cuenta_aprobada();

-- =====================
-- 7. FUNCIÓN PARA NOTIFICAR COMPROMISOS POR VENCER (CRON)
-- =====================

CREATE OR REPLACE FUNCTION notificar_compromisos_por_vencer()
RETURNS INTEGER AS $$
DECLARE
  v_compromiso RECORD;
  v_cliente RECORD;
  v_banco RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Buscar compromisos que vencen en 7 días o menos
  FOR v_compromiso IN
    SELECT c.*,
           (c.fecha_vencimiento - CURRENT_DATE) as dias_restantes
    FROM compromisos c
    WHERE c.estado = 'vigente'
      AND c.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  LOOP
    -- Obtener datos
    SELECT * INTO v_cliente FROM users WHERE id = v_compromiso.cliente_id;
    SELECT * INTO v_banco FROM users WHERE id = v_compromiso.banco_id;

    -- Notificar cliente
    PERFORM notify_via_edge_function(
      'compromiso_por_vencer',
      v_cliente.email,
      v_cliente.nombre,
      jsonb_build_object(
        'op_id', v_compromiso.op_id,
        'banco_nombre', v_banco.entidad,
        'monto', v_compromiso.monto,
        'moneda', v_compromiso.moneda,
        'dias_restantes', v_compromiso.dias_restantes,
        'fecha_vencimiento', v_compromiso.fecha_vencimiento
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 8. PROGRAMAR CRON PARA NOTIFICACIONES DIARIAS
-- =====================

-- Habilitar pg_cron si no está habilitado:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Ejecutar notificaciones de vencimiento cada día a las 8am
-- SELECT cron.schedule(
--   'notify-vencimientos',
--   '0 8 * * *',
--   'SELECT notificar_compromisos_por_vencer()'
-- );

-- =====================
-- 9. HABILITAR EXTENSIÓN HTTP (para llamar Edge Functions)
-- =====================

-- Esta extensión es necesaria para net.http_post
-- CREATE EXTENSION IF NOT EXISTS http;
-- O usar pg_net que viene con Supabase:
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================
-- FIN DE TRIGGERS DE NOTIFICACIÓN
-- =====================
