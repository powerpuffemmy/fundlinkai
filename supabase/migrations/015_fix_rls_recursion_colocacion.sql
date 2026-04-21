-- ============================================================
-- FUNDLINK: Migración 015 - Fix RLS Infinite Recursion
-- Problema: banco_select_solicitudes (en solicitudes_colocacion)
-- consulta solicitud_colocacion_bancos, cuya política
-- cliente_select_scb consulta solicitudes_colocacion de vuelta
-- → recursión infinita (code 42P17).
-- Solución: función SECURITY DEFINER que omite RLS para romper
-- el ciclo. Misma recursión aplica a ofertas_colocacion.
-- ============================================================

-- Helper: verifica si el usuario actual es dueño de la solicitud
-- SECURITY DEFINER + row_security=off evita volver a evaluar RLS
CREATE OR REPLACE FUNCTION cliente_owns_solicitud(p_solicitud_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM solicitudes_colocacion
    WHERE id = p_solicitud_id
      AND cliente_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION cliente_owns_solicitud(uuid) TO authenticated;

-- ── solicitud_colocacion_bancos ───────────────────────────────
-- Reemplazar políticas que referenciaban solicitudes_colocacion
-- directamente (causaba la recursión)

DROP POLICY IF EXISTS "cliente_select_scb" ON solicitud_colocacion_bancos;
CREATE POLICY "cliente_select_scb" ON solicitud_colocacion_bancos
  FOR SELECT USING (cliente_owns_solicitud(solicitud_id));

DROP POLICY IF EXISTS "cliente_insert_scb" ON solicitud_colocacion_bancos;
CREATE POLICY "cliente_insert_scb" ON solicitud_colocacion_bancos
  FOR INSERT WITH CHECK (cliente_owns_solicitud(solicitud_id));

-- ── ofertas_colocacion ────────────────────────────────────────
-- Misma recursión: cliente_select/update_oferta_col →
-- solicitudes_colocacion → banco_select_solicitudes →
-- solicitud_colocacion_bancos → cliente_select_scb → ...

DROP POLICY IF EXISTS "cliente_select_oferta_col" ON ofertas_colocacion;
CREATE POLICY "cliente_select_oferta_col" ON ofertas_colocacion
  FOR SELECT USING (
    aprobada_por_admin = true
    AND cliente_owns_solicitud(solicitud_id)
  );

DROP POLICY IF EXISTS "cliente_update_oferta_col" ON ofertas_colocacion;
CREATE POLICY "cliente_update_oferta_col" ON ofertas_colocacion
  FOR UPDATE USING (cliente_owns_solicitud(solicitud_id));

-- ============================================================
-- FIN DE MIGRACIÓN 015
-- ============================================================
