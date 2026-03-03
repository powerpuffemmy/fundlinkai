-- ============================================
-- FUNDLINK: Migración 010 - Fix check constraint tipo subasta
-- ============================================
-- La migración 009 actualizó el trigger pero no el CHECK constraint
-- de la tabla subastas. Este fix elimina el constraint viejo y
-- agrega uno nuevo con los tipos actuales.
-- ============================================

-- 1. Eliminar el constraint viejo
ALTER TABLE subastas DROP CONSTRAINT IF EXISTS subastas_tipo_check;

-- 2. Agregar nuevo constraint con tipos actuales
ALTER TABLE subastas
  ADD CONSTRAINT subastas_tipo_check
  CHECK (tipo IN ('rapida', 'programada'));

-- ============================================
-- FIN DE MIGRACIÓN 010
-- ============================================
