-- ============================================================
-- Migration 019: Fix triggers de notificación + activar cron
-- ============================================================
-- EJECUTAR EN SUPABASE SQL EDITOR en este orden:
--
-- 1. Habilitar extensiones (desde Dashboard → Database → Extensions):
--    pg_net, pg_cron
--
-- 2. Ejecutar este archivo completo en SQL Editor
--
-- 3. Configurar anon key (reemplazar con la tuya):
--    ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'eyJ...';
--    (encontrarla en: Settings → API → Project API keys → anon public)
-- ============================================================

-- ── 1. FIX: cuenta_aprobada — roles actualizados a cliente_admin/cliente_usuario
-- (migration 003 usaba role = 'cliente' que ya no existe después de migration 008)
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trigger_notify_cuenta_aprobada ON users;

CREATE OR REPLACE FUNCTION notify_cuenta_aprobada()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.aprobado_por_admin = true
     AND (OLD.aprobado_por_admin IS NULL OR OLD.aprobado_por_admin = false)
     AND NEW.role IN ('cliente_admin', 'cliente_usuario', 'banco_admin', 'banco_mesa')
  THEN
    PERFORM notify_via_edge_function(
      'cuenta_aprobada',
      NEW.email,
      NEW.nombre,
      jsonb_build_object('cliente_nombre', COALESCE(NEW.entidad, NEW.nombre))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_cuenta_aprobada
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION notify_cuenta_aprobada();

-- ── 2. FIX: notify_via_edge_function — asegurar que la URL y key estén bien
-- Regenera la función con manejo de key más robusto
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_via_edge_function(
  p_tipo   TEXT,
  p_email  TEXT,
  p_nombre TEXT,
  p_datos  JSONB
)
RETURNS void AS $$
DECLARE
  v_url      TEXT := 'https://ewcvkvnnixrxmiruzmie.supabase.co/functions/v1/enviar-email';
  v_anon_key TEXT := current_setting('app.settings.supabase_anon_key', true);
BEGIN
  IF v_anon_key IS NULL OR v_anon_key = '' THEN
    RAISE WARNING '[notify_via_edge_function] supabase_anon_key no configurada — email no enviado para tipo=%', p_tipo;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'apikey',        v_anon_key
    ),
    body := jsonb_build_object(
      'tipo',        p_tipo,
      'destinatario', jsonb_build_object('email', p_email, 'nombre', p_nombre),
      'datos',       p_datos
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_via_edge_function] Error: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. CRON: alertas de vencimiento diarias a las 8:00 AM Guatemala (14:00 UTC)
-- Reemplaza <SUPABASE_URL> y <ANON_KEY> con los valores reales antes de ejecutar
-- ─────────────────────────────────────────────────────────────────────────────

-- Crear job (reemplazar los placeholders)
-- NOTA: Habilitar pg_cron primero desde Dashboard → Database → Extensions
-- Luego ejecutar este bloque por separado:
-- SELECT cron.schedule(
--   'fundlink-alertas-vencimiento',
--   '0 14 * * *',
--   $$
--   SELECT net.http_post(
--     url     := 'https://ewcvkvnnixrxmiruzmie.supabase.co/functions/v1/alertas-vencimiento',
--     headers := '{"Authorization":"Bearer <ANON_KEY>","apikey":"<ANON_KEY>","Content-Type":"application/json"}'::jsonb,
--     body    := '{}'::jsonb
--   )
--   $$
-- );

-- ── 4. Configurar anon_key (ejecutar por separado con tu key real):
-- ALTER DATABASE postgres SET app.settings.supabase_anon_key = '<ANON_KEY>';
