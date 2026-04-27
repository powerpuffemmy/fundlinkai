import React, { useState, useEffect } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { useSubastas } from '@/hooks/useSubastas'
import { useOfertas } from '@/hooks/useOfertas'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDateTime, formatTipoSubasta, formatDuracion } from '@/lib/utils'

// ─── Helpers ───────────────────────────────────────────────────────────────────

const tipoBadge = (tipo: string) => {
  const labels: Record<string, string> = {
    rapida: 'Rápida',
    programada: 'Programada',
    abierta: 'Abierta',
    sellada: 'Sellada',
    holandesa: 'Holandesa',
    multi: 'Multi-tramo',
  }
  return (
    <span className="px-2 py-0.5 rounded text-xs font-bold bg-sky-900/30 text-sky-200 border border-sky-900/50">
      SUBASTA {(labels[tipo] || tipo).toUpperCase()}
    </span>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const BancoSolicitudes: React.FC = () => {
  const { user } = useAuthStore()
  const { subastas, loading } = useSubastas()
  const { ofertas, crearOferta } = useOfertas()
  const [tasas, setTasas] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState<Record<string, boolean>>({})
  const [subastasInvitado, setSubastasInvitado] = useState<Set<string>>(new Set())
  const [loadingInvitaciones, setLoadingInvitaciones] = useState(true)

  // Filtro: 'abiertas' (activas + pendientes admin) | 'expiradas'
  const [filtro, setFiltro] = useState<'abiertas' | 'expiradas'>('abiertas')

  // IDs de subastas archivadas (ocultas de la vista) — persiste en localStorage
  const [archivadas, setArchivadas] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('subastas_archivadas_banco')
      return new Set(stored ? JSON.parse(stored) : [])
    } catch {
      return new Set()
    }
  })

  // ── Cargar invitaciones ──────────────────────────────────────────────────────
  useEffect(() => {
    const cargarInvitaciones = async () => {
      if (!user) return
      try {
        setLoadingInvitaciones(true)
        const { data, error } = await supabase
          .from('subasta_bancos')
          .select('subasta_id')
          .eq('banco_id', user.id)
        if (error) throw error
        setSubastasInvitado(new Set((data || []).map(inv => inv.subasta_id)))
      } catch (error) {
        console.error('Error cargando invitaciones:', error)
      } finally {
        setLoadingInvitaciones(false)
      }
    }
    cargarInvitaciones()
  }, [user?.id])

  // ── Derivaciones ────────────────────────────────────────────────────────────
  const ahora = new Date()

  const subastasConOferta = new Set(ofertas.map(o => o.subasta_id))

  // Ofertas de Mesa pendientes de aprobación del admin
  const ofertasPendientesMap: Record<string, typeof ofertas[0]> = {}
  ofertas
    .filter(o => !o.aprobada_por_admin && o.estado === 'enviada')
    .forEach(o => { ofertasPendientesMap[o.subasta_id] = o })
  const subastasConOfertaPendiente = new Set(Object.keys(ofertasPendientesMap))

  const estaExpirada = (s: any) =>
    new Date(s.expires_at) <= ahora || s.estado !== 'abierta'

  const subastasBase = subastas.filter(
    s => subastasInvitado.has(s.id) && !archivadas.has(s.id)
  )

  // Activas: no expiradas + no ofertadas aún
  const subastasActivas = subastasBase.filter(
    s => !estaExpirada(s) && !subastasConOferta.has(s.id)
  )

  // Pendientes de aprobación del admin (Mesa ya ofertó, esperando admin)
  const subastasPendientesAdmin = subastasBase.filter(
    s => !estaExpirada(s) && subastasConOfertaPendiente.has(s.id)
  )

  // Expiradas / históricas
  const subastasExpiradas = subastasBase.filter(s => estaExpirada(s))

  const getTiempoRestante = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now()
    if (diff <= 0) return 'Expirada'
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // ── Acciones ────────────────────────────────────────────────────────────────
  const handleTasaChange = (subastaId: string, value: string) => {
    setTasas(prev => ({ ...prev, [subastaId]: value }))
  }

  const handleOfertar = async (subasta: any) => {
    if (!user) return
    const tasa = parseFloat(tasas[subasta.id] || '0')
    if (tasa <= 0 || tasa > 100) {
      alert('Por favor ingresa una tasa válida entre 0 y 100')
      return
    }
    if (user.role === 'banco_auditor') {
      alert('Los auditores no pueden enviar ofertas')
      return
    }
    // Evitar re-oferta si ya tiene una pendiente
    if (subastasConOferta.has(subasta.id)) {
      alert('Ya enviaste una oferta para esta subasta.')
      return
    }
    try {
      setEnviando(prev => ({ ...prev, [subasta.id]: true }))
      const aprobada_por_admin = user.role === 'banco_admin'
      await crearOferta({
        subasta_id: subasta.id,
        banco_id: user.id,
        tasa,
        estado: 'enviada',
        aprobada_por_admin,
        notas: '',
      })
      const msg = aprobada_por_admin
        ? `Oferta enviada al ${tasa}%`
        : `Oferta enviada al ${tasa}% — pendiente de aprobación del Administrador`
      alert(msg)
      setTasas(prev => ({ ...prev, [subasta.id]: '' }))
    } catch (error) {
      console.error('Error al ofertar:', error)
      alert('Error al enviar la oferta. Por favor intenta de nuevo.')
    } finally {
      setEnviando(prev => ({ ...prev, [subasta.id]: false }))
    }
  }

  const archivarSubasta = (id: string) => {
    setArchivadas(prev => {
      const next = new Set(prev)
      next.add(id)
      try {
        localStorage.setItem('subastas_archivadas_banco', JSON.stringify([...next]))
      } catch { /* no bloquear */ }
      return next
    })
  }

  // ── Render helpers ──────────────────────────────────────────────────────────
  const renderSubastaActiva = (subasta: any) => (
    <Card key={subasta.id}>
      <div className="grid md:grid-cols-2 gap-6">
        {/* Info */}
        <div>
          <div className="flex flex-wrap gap-2 items-center mb-3">
            {tipoBadge(subasta.tipo)}
          </div>
          <div className="mb-3 p-2 bg-blue-900/20 border border-blue-900/50 rounded">
            <div className="text-sm">
              <span className="text-[var(--muted)]">Cliente:</span>
              <span className="ml-2 font-semibold">{subasta.cliente?.entidad}</span>
            </div>
            <div className="text-xs text-[var(--muted)]">{subasta.cliente?.nombre}</div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Monto:</span>
              <span className="font-semibold">{formatMoney(subasta.monto, subasta.moneda)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Moneda:</span>
              <span className="font-semibold">{subasta.moneda}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Plazo:</span>
              <span className="font-semibold">{subasta.plazo} días</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Duración:</span>
              <span className="font-semibold">{formatDuracion(subasta.duracion)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Creada:</span>
              <span className="font-semibold text-xs">{formatDateTime(subasta.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Tiempo restante:</span>
              <span className="font-semibold text-[var(--warn)]">
                {getTiempoRestante(subasta.expires_at)}
              </span>
            </div>
            {user?.ai_pro && subasta.tasa_objetivo && (
              <div className="flex justify-between items-center mt-3 p-2 bg-sky-900/20 border border-sky-500/30 rounded">
                <span className="text-sky-200 text-xs">Tasa Objetivo:</span>
                <span className="font-bold text-sky-200">{subasta.tasa_objetivo}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Formulario oferta */}
        <div>
          <h4 className="font-semibold mb-3">Enviar Oferta</h4>
          {user?.role === 'banco_auditor' ? (
            <div className="p-3 bg-gray-900/50 rounded text-sm text-[var(--muted)]">
              No tienes permisos para ofertar
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                label="Tasa (%)"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="5.75"
                value={tasas[subasta.id] || ''}
                onChange={(e) => handleTasaChange(subasta.id, e.target.value)}
                disabled={enviando[subasta.id]}
              />
              <Button
                variant="primary"
                className="w-full"
                onClick={() => handleOfertar(subasta)}
                disabled={enviando[subasta.id] || !tasas[subasta.id]}
              >
                {enviando[subasta.id] ? 'Enviando...' : 'Enviar Oferta'}
              </Button>
              {user?.role === 'banco_mesa' && (
                <p className="text-xs text-yellow-400">
                  Tu oferta será enviada al Administrador del banco para aprobación antes de llegar al cliente.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )

  const renderSubastaPendienteAdmin = (subasta: any) => {
    const oferta = ofertasPendientesMap[subasta.id]
    return (
      <Card key={subasta.id} className="border-yellow-900/40">
        <div className="flex flex-wrap gap-2 items-center mb-3">
          {tipoBadge(subasta.tipo)}
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-900/30 text-yellow-300 border border-yellow-900/50">
            OFERTA PENDIENTE DE APROBACIÓN ADMIN
          </span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="mb-2 p-2 bg-blue-900/20 border border-blue-900/50 rounded">
              <div className="text-sm">
                <span className="text-[var(--muted)]">Cliente:</span>
                <span className="ml-2 font-semibold">{subasta.cliente?.entidad}</span>
              </div>
              <div className="text-xs text-[var(--muted)]">{subasta.cliente?.nombre}</div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Monto:</span>
                <span className="font-semibold">{formatMoney(subasta.monto, subasta.moneda)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Plazo:</span>
                <span className="font-semibold">{subasta.plazo} días</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Creada:</span>
                <span className="font-semibold text-xs">{formatDateTime(subasta.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Tiempo restante:</span>
                <span className="font-semibold text-[var(--warn)]">
                  {getTiempoRestante(subasta.expires_at)}
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 bg-yellow-900/10 border border-yellow-900/30 rounded-lg">
            <p className="text-xs text-yellow-300 font-semibold mb-1">Tu oferta enviada</p>
            <p className="text-3xl font-black text-[var(--good)]">
              {oferta?.tasa ?? '—'}%
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">
              Enviada el {oferta ? formatDateTime(oferta.created_at) : '—'}
            </p>
            <p className="text-xs text-yellow-400 mt-2">
              En espera de aprobación del Administrador del banco.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const renderSubastaExpirada = (subasta: any) => (
    <Card key={subasta.id} className="opacity-70">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2 items-center mb-2">
            {tipoBadge(subasta.tipo)}
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-900/40 text-gray-400 border border-gray-700/50">
              EXPIRADA
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <span className="text-[var(--muted)]">Cliente: </span>
              <strong>{subasta.cliente?.entidad}</strong>
            </span>
            <span>
              <span className="text-[var(--muted)]">Monto: </span>
              <strong>{formatMoney(subasta.monto, subasta.moneda)}</strong>
            </span>
            <span>
              <span className="text-[var(--muted)]">Plazo: </span>
              <strong>{subasta.plazo} días</strong>
            </span>
            <span>
              <span className="text-[var(--muted)]">Expiró: </span>
              <strong className="text-xs">{formatDateTime(subasta.expires_at)}</strong>
            </span>
            {subastasConOferta.has(subasta.id) && (
              <span className="text-[var(--good)] font-semibold text-xs">Ofertada</span>
            )}
          </div>
        </div>
        <Button
          variant="small"
          className="text-xs shrink-0"
          onClick={() => archivarSubasta(subasta.id)}
        >
          Borrar
        </Button>
      </div>
    </Card>
  )

  // ── Render principal ─────────────────────────────────────────────────────────
  if (loading || loadingInvitaciones) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Solicitudes de Clientes</h2>
        <Card>
          <p className="text-[var(--muted)]">Cargando subastas...</p>
        </Card>
      </div>
    )
  }

  const totalAbiertas = subastasActivas.length + subastasPendientesAdmin.length

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold">Solicitudes de Clientes</h2>
          <p className="text-sm text-[var(--muted)] mt-1">
            Subastas disponibles para ofertar
          </p>
        </div>
        <div className="text-sm text-[var(--muted)]">
          {filtro === 'abiertas'
            ? `${totalAbiertas} solicitud(es) activa(s)`
            : `${subastasExpiradas.length} expirada(s)`}
        </div>
      </div>

      {/* Banners de rol */}
      {user?.role === 'banco_mesa' && (
        <Card className="bg-blue-900/20 border-blue-900/50">
          <p className="text-sm text-blue-200">
            Como Mesa de Dinero, tus ofertas requieren aprobación del Administrador antes de ser enviadas al cliente.
          </p>
        </Card>
      )}
      {user?.role === 'banco_auditor' && (
        <Card className="bg-yellow-900/20 border-yellow-900/50">
          <p className="text-sm text-yellow-200">
            Como Auditor, solo puedes ver las subastas pero no ofertar.
          </p>
        </Card>
      )}

      {/* Filtro tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFiltro('abiertas')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            filtro === 'abiertas'
              ? 'bg-[var(--primary)] text-white'
              : 'bg-white/10 text-[var(--muted)] hover:text-white'
          }`}
        >
          Abiertas
          {totalAbiertas > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white/20 text-xs">
              {totalAbiertas}
            </span>
          )}
        </button>
        <button
          onClick={() => setFiltro('expiradas')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            filtro === 'expiradas'
              ? 'bg-gray-700 text-white'
              : 'bg-white/10 text-[var(--muted)] hover:text-white'
          }`}
        >
          Expiradas
          {subastasExpiradas.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white/20 text-xs">
              {subastasExpiradas.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Vista ABIERTAS ─────────────────────────────────────────────────────── */}
      {filtro === 'abiertas' && (
        <>
          {/* Activas */}
          {subastasActivas.length === 0 && subastasPendientesAdmin.length === 0 ? (
            <Card>
              <p className="text-[var(--muted)] text-center py-8">
                No hay solicitudes disponibles en este momento.
              </p>
            </Card>
          ) : (
            <>
              {subastasActivas.length > 0 && (
                <div className="space-y-4">
                  {subastasActivas.map(s => renderSubastaActiva(s))}
                </div>
              )}

              {/* Pendientes de aprobación admin (solo mesa) */}
              {subastasPendientesAdmin.length > 0 && (
                <div className="space-y-3 mt-4">
                  <h3 className="text-sm font-semibold text-yellow-300 flex items-center gap-2">
                    Ofertas enviadas — pendientes de aprobación
                    <span className="px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-300 text-xs font-bold">
                      {subastasPendientesAdmin.length}
                    </span>
                  </h3>
                  {subastasPendientesAdmin.map(s => renderSubastaPendienteAdmin(s))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Vista EXPIRADAS ────────────────────────────────────────────────────── */}
      {filtro === 'expiradas' && (
        <>
          {subastasExpiradas.length === 0 ? (
            <Card>
              <p className="text-[var(--muted)] text-center py-8">
                No hay subastas expiradas.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[var(--muted)]">
                Usa "Borrar" para quitar una subasta expirada de esta vista.
              </p>
              {subastasExpiradas.map(s => renderSubastaExpirada(s))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
