-- ============================================
-- FUNDLINK: Migración 011 - Solicitudes de Colocación
-- ============================================
-- Nueva funcionalidad: cliente envía solicitud de colocación
-- al banco (monto opcional), banco responde con tasa en firme.
-- Al aceptar se genera un Compromiso automáticamente.
-- ============================================

-- 1. Tabla principal de solicitudes
CREATE TABLE IF NOT EXISTS solicitudes_colocacion (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID REFERENCES users(id) NOT NULL,
  moneda        TEXT NOT NULL CHECK (moneda IN ('USD', 'GTQ')),
  monto         NUMERIC,
  plazo         INTEGER NOT NULL CHECK (plazo BETWEEN 1 AND 365),
  tasa_objetivo NUMERIC CHECK (tasa_objetivo IS NULL OR (tasa_objetivo >= 0 AND tasa_objetivo <= 50)),
  fecha_cierre  TIMESTAMPTZ NOT NULL,
  estado        TEXT NOT NULL DEFAULT 'abierta'
                  CHECK (estado IN ('abierta', 'cerrada', 'cancelada')),
  notas         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bancos invitados a cada solicitud
CREATE TABLE IF NOT EXISTS solicitud_colocacion_bancos (
  solicitud_id UUID REFERENCES solicitudes_colocacion(id) ON DELETE CASCADE,
  banco_id     UUID REFERENCES users(id),
  PRIMARY KEY (solicitud_id, banco_id)
);

-- 3. Ofertas del banco a una solicitud
CREATE TABLE IF NOT EXISTS ofertas_colocacion (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id UUID REFERENCES solicitudes_colocacion(id) ON DELETE CASCADE NOT NULL,
  banco_id     UUID REFERENCES users(id) NOT NULL,
  tasa         NUMERIC NOT NULL CHECK (tasa >= 0 AND tasa <= 50),
  monto        NUMERIC NOT NULL CHECK (monto > 0),
  notas        TEXT,
  estado       TEXT NOT NULL DEFAULT 'enviada'
                 CHECK (estado IN ('enviada', 'aceptada', 'rechazada')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS: solicitudes_colocacion
ALTER TABLE solicitudes_colocacion ENABLE ROW LEVEL SECURITY;

-- Cliente puede ver y crear sus propias solicitudes
CREATE POLICY "cliente_select_solicitudes" ON solicitudes_colocacion
  FOR SELECT USING (cliente_id = auth.uid());

CREATE POLICY "cliente_insert_solicitudes" ON solicitudes_colocacion
  FOR INSERT WITH CHECK (cliente_id = auth.uid());

CREATE POLICY "cliente_update_solicitudes" ON solicitudes_colocacion
  FOR UPDATE USING (cliente_id = auth.uid());

-- Banco puede ver solicitudes donde fue invitado
CREATE POLICY "banco_select_solicitudes" ON solicitudes_colocacion
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM solicitud_colocacion_bancos scb
      WHERE scb.solicitud_id = solicitudes_colocacion.id
        AND scb.banco_id = auth.uid()
    )
  );

-- 5. RLS: solicitud_colocacion_bancos
ALTER TABLE solicitud_colocacion_bancos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cliente_select_scb" ON solicitud_colocacion_bancos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM solicitudes_colocacion sc
      WHERE sc.id = solicitud_colocacion_bancos.solicitud_id
        AND sc.cliente_id = auth.uid()
    )
  );

CREATE POLICY "cliente_insert_scb" ON solicitud_colocacion_bancos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM solicitudes_colocacion sc
      WHERE sc.id = solicitud_colocacion_bancos.solicitud_id
        AND sc.cliente_id = auth.uid()
    )
  );

CREATE POLICY "banco_select_scb" ON solicitud_colocacion_bancos
  FOR SELECT USING (banco_id = auth.uid());

-- 6. RLS: ofertas_colocacion
ALTER TABLE ofertas_colocacion ENABLE ROW LEVEL SECURITY;

-- Banco puede insertar y ver sus propias ofertas
CREATE POLICY "banco_insert_oferta_col" ON ofertas_colocacion
  FOR INSERT WITH CHECK (banco_id = auth.uid());

CREATE POLICY "banco_select_oferta_col" ON ofertas_colocacion
  FOR SELECT USING (banco_id = auth.uid());

-- Cliente puede ver ofertas de sus solicitudes
CREATE POLICY "cliente_select_oferta_col" ON ofertas_colocacion
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM solicitudes_colocacion sc
      WHERE sc.id = ofertas_colocacion.solicitud_id
        AND sc.cliente_id = auth.uid()
    )
  );

-- Cliente puede actualizar estado de ofertas de sus solicitudes (aceptar/rechazar)
CREATE POLICY "cliente_update_oferta_col" ON ofertas_colocacion
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM solicitudes_colocacion sc
      WHERE sc.id = ofertas_colocacion.solicitud_id
        AND sc.cliente_id = auth.uid()
    )
  );

-- ============================================
-- FIN DE MIGRACIÓN 011
-- ============================================

-- ============================================
-- Actualización 011b: campo tipo_tasa
-- (ejecutado vía API, documentado aquí)
-- ============================================
-- ALTER TABLE solicitudes_colocacion
--   ADD COLUMN IF NOT EXISTS tipo_tasa TEXT
--   CHECK (tipo_tasa IS NULL OR tipo_tasa IN ('firme', 'cierre', 'indicativa'));
