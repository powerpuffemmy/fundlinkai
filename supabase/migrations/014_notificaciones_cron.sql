-- ============================================================
-- Migration 014: Notificaciones automáticas (pg_cron + pg_net)
-- ============================================================
-- Configura un job diario que llama a la Edge Function
-- `alertas-vencimiento` para enviar alertas a clientes cuyos
-- compromisos vencen en 7 o 30 días.
--
-- REQUISITOS:
--   1. Extensiones pg_cron y pg_net habilitadas en el proyecto
--      (activar desde Supabase Dashboard → Database → Extensions)
--   2. Edge Function `alertas-vencimiento` desplegada:
--      supabase functions deploy alertas-vencimiento
--   3. Variables de entorno configuradas:
--      supabase secrets set RESEND_API_KEY=re_xxxxx
--
-- DEPLOY MANUAL DEL CRON (ejecutar desde Supabase SQL Editor):
--   Reemplaza <SUPABASE_URL> y <ANON_KEY> con los valores reales.
-- ============================================================

-- ── Habilitar extensiones (si no están activas) ──────────────
-- Estas extensiones deben activarse desde el Dashboard de Supabase.
-- Se incluyen aquí como referencia; si ya están activas, no causa error.
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Tabla de log de notificaciones enviadas ──────────────────
CREATE TABLE IF NOT EXISTS notificaciones_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo         TEXT NOT NULL,
  destinatario_id UUID,
  destinatario_email TEXT,
  datos        JSONB,
  resend_id    TEXT,
  estado       TEXT NOT NULL DEFAULT 'enviada',  -- enviada | error
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: solo webadmin puede ver logs
ALTER TABLE notificaciones_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_log_admin_select" ON notificaciones_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'webadmin')
  );

CREATE POLICY "notif_log_service_insert" ON notificaciones_log
  FOR INSERT WITH CHECK (true);  -- Edge Functions usan service role

-- ── Job cron: alertas de vencimiento diarias a las 8:00 AM GT ──
-- (8:00 AM Guatemala = UTC-6 → 14:00 UTC)
--
-- INSTRUCCIONES: Copiar y ejecutar en el SQL Editor de Supabase
-- reemplazando los placeholders:
--
-- SELECT cron.schedule(
--   'fundlink-alertas-vencimiento',
--   '0 14 * * *',
--   $$
--   SELECT net.http_post(
--     url        := 'https://<PROJECT_REF>.supabase.co/functions/v1/alertas-vencimiento',
--     headers    := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
--     body       := '{}'::jsonb,
--     timeout_milliseconds := 30000
--   ) AS request_id;
--   $$
-- );
--
-- Para verificar jobs activos:
--   SELECT * FROM cron.job;
--
-- Para eliminar el job:
--   SELECT cron.unschedule('fundlink-alertas-vencimiento');

-- ── Vista de compromisos próximos a vencer (útil para monitoreo) ──
CREATE OR REPLACE VIEW v_compromisos_proximos_vencer AS
SELECT
  c.id,
  c.op_id,
  c.monto,
  c.moneda,
  c.tasa,
  c.fecha_vencimiento,
  c.estado,
  c.cliente_id,
  u_cliente.nombre   AS cliente_nombre,
  u_cliente.entidad  AS cliente_entidad,
  u_cliente.email    AS cliente_email,
  u_banco.entidad    AS banco_nombre,
  (c.fecha_vencimiento::date - CURRENT_DATE) AS dias_restantes
FROM compromisos c
JOIN users u_cliente ON u_cliente.id = c.cliente_id
LEFT JOIN users u_banco ON u_banco.id = c.banco_id
WHERE
  c.estado IN ('vigente', 'confirmado', 'ejecutado')
  AND c.es_externo = false
  AND c.fecha_vencimiento::date >= CURRENT_DATE
  AND c.fecha_vencimiento::date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY c.fecha_vencimiento ASC;

COMMENT ON VIEW v_compromisos_proximos_vencer IS
  'Compromisos FundLink activos que vencen en los próximos 30 días, con datos de cliente y banco.';
