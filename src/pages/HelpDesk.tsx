import React, { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

type HelpTab = 'manual' | 'contacto' | 'chat' | 'capacitacion'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

// ─── Manual accordion ───────────────────────────────────────────────────────
const MANUAL_SECTIONS = [
  {
    id: 'primeros-pasos',
    icono: '🚀',
    titulo: 'Primeros Pasos',
    items: [
      { sub: 'Ingresar al sistema', texto: 'Accede con tu correo y contraseña en la pantalla de inicio. En tu primer login el sistema te pedirá cambiar la contraseña temporal.' },
      { sub: 'Cambio de contraseña inicial', texto: 'Al ingresar por primera vez verás un modal obligatorio para establecer tu contraseña definitiva. Elige una contraseña segura de al menos 8 caracteres.' },
      { sub: 'Navegación', texto: 'El menú superior muestra las secciones disponibles según tu rol. Haz clic en cualquier botón para navegar entre secciones. El botón activo se resalta en azul.' },
    ],
  },
  {
    id: 'solicitudes',
    icono: '📋',
    titulo: 'Solicitudes de Colocación',
    items: [
      { sub: 'Crear una solicitud', texto: 'Ve a "Nueva Solicitud" en el menú. Completa los parámetros: moneda (GTQ/USD), monto (opcional), plazo, tasa objetivo/cierre y fecha de cierre. Avanza al paso 2 para seleccionar los bancos destinatarios.' },
      { sub: 'Tipos de tasa', texto: '"Tasa Cierre" es la tasa firme y definitiva que el banco propone. "Tasa Objetivo" es la tasa referencial que buscas — los bancos la verán como meta al preparar su oferta.' },
      { sub: 'Selección de bancos', texto: 'En el paso 2 verás todos los bancos activos en tu configuración. Puedes enviar a todos o seleccionar solo algunos. Confirma para despachar la solicitud.' },
      { sub: 'Gestionar ofertas', texto: 'En "Mis Solicitudes" verás las ofertas recibidas bajo cada solicitud abierta. Expande una solicitud para ver tasa, monto y banco ofertante.' },
      { sub: 'Aceptar o rechazar', texto: 'Al aceptar una oferta se crea automáticamente un Compromiso y se rechazan las demás ofertas pendientes. Al rechazar, el banco es notificado y la solicitud sigue abierta para otras ofertas.' },
    ],
  },
  {
    id: 'subastas',
    icono: '🏛️',
    titulo: 'Subastas Competitivas',
    items: [
      { sub: 'Crear una subasta', texto: 'Ve a "Nueva Subasta". Define moneda, monto, plazo y tasa objetivo (referencial). La subasta es enviada a todos los bancos activos de tu configuración.' },
      { sub: 'Flujo de la subasta', texto: 'Los bancos ven la subasta y envían sus ofertas (tasa + monto). Puedes ver todas las ofertas en tiempo real en "Mis Subastas". Las mejores tasas aparecen destacadas.' },
      { sub: 'Adjudicar y cerrar', texto: 'Cuando decidas adjudicar, selecciona la oferta ganadora. Se generará automáticamente un Compromiso con los datos acordados.' },
      { sub: 'Historial', texto: 'En "Historial" puedes consultar todas las subastas anteriores, incluyendo el ganador y las condiciones pactadas.' },
    ],
  },
  {
    id: 'compromisos',
    icono: '📄',
    titulo: 'Compromisos y Vencimientos',
    items: [
      { sub: '¿Qué es un Compromiso?', texto: 'Un Compromiso es la constancia de intención generada cuando se acepta una oferta. Documenta al banco, al cliente, la tasa, el monto, el plazo y las fechas pactadas. No es un contrato vinculante — las partes deben formalizarlo directamente.' },
      { sub: 'Estados del Compromiso', texto: '"Confirmado": intención aceptada, pendiente de ejecución. "Ejecutado": el banco confirmó el desembolso. "Vencido": la fecha de vencimiento ha pasado.' },
      { sub: 'Exportar PDF', texto: 'Desde "Compromisos" puedes descargar la Constancia de Intención (PDF) o el Certificado de Ejecución (PDF ejecutado). Cada documento incluye código QR de verificación.' },
      { sub: 'Vencimientos', texto: 'La sección "Vencimientos" muestra un calendario de compromisos próximos a vencer. Recibe alertas cuando un compromiso esté por expirar.' },
    ],
  },
  {
    id: 'bancos',
    icono: '🏦',
    titulo: 'Para Bancos',
    items: [
      { sub: 'Ver solicitudes recibidas', texto: 'En "Colocaciones" verás todas las solicitudes enviadas por clientes. Las solicitudes activas aparecen en la sección superior; las históricas están colapsables al final.' },
      { sub: 'Enviar una oferta', texto: 'Expande una solicitud activa y completa el formulario: tasa cierre (%), monto y notas opcionales. Si eres banco_mesa, tu oferta queda pendiente de aprobación del Admin.' },
      { sub: 'Contraoferta', texto: 'Si ya enviaste una oferta y la solicitud sigue abierta, puedes mejorarla con el botón "Contraofertar". La oferta previa queda como histórico.' },
      { sub: 'Aprobación (banco_admin)', texto: 'En "Aprobaciones" verás las ofertas pendientes enviadas por usuarios banco_mesa. Apruébalas para que sean visibles al cliente, o recházalas con justificación.' },
      { sub: 'Compromisos del banco', texto: 'En "Compromisos" gestionas las operaciones aceptadas: marca como ejecutadas una vez realizado el desembolso.' },
    ],
  },
  {
    id: 'roles',
    icono: '👥',
    titulo: 'Roles y Permisos',
    items: [
      { sub: 'cliente_admin', texto: 'Acceso completo de cliente: crear solicitudes y subastas, aceptar/rechazar ofertas, gestionar compromisos y configuración. Puede crear usuarios cliente_usuario para su entidad.' },
      { sub: 'cliente_usuario', texto: 'Puede crear solicitudes y subastas, pero no tiene permisos de aprobación final. Operador estándar del lado cliente.' },
      { sub: 'banco_admin', texto: 'Administrador del banco: gestiona límites y clientes, aprueba ofertas de banco_mesa, acceso completo a compromisos y configuración del banco.' },
      { sub: 'banco_mesa', texto: 'Operador de mesa de dinero: puede ver solicitudes y enviar ofertas, pero sus ofertas requieren aprobación de banco_admin antes de ser visibles al cliente.' },
      { sub: 'banco_auditor', texto: 'Solo lectura: consulta solicitudes, ofertas y compromisos sin posibilidad de crear o modificar registros. Ideal para auditoría interna.' },
      { sub: 'webadmin', texto: 'Administrador del sistema: gestiona todos los usuarios, aprueba cuentas nuevas, supervisa operaciones y configuración global de la plataforma.' },
    ],
  },
]

// ─── Capacitación content por rol ───────────────────────────────────────────
const GUIA_CLIENTE = [
  {
    titulo: 'Tu primera Solicitud de Colocación',
    pasos: [
      'Haz clic en "Nueva Solicitud" en el menú superior.',
      'Selecciona la moneda (GTQ o USD) y define el plazo de inversión.',
      'Si tienes un monto específico actívalo; si no, déjalo libre para que el banco proponga.',
      'Indica la tasa objetivo (referencial) o cierre si ya tienes una meta.',
      'Selecciona la fecha límite para recibir ofertas y haz clic en "Siguiente".',
      'Elige los bancos destinatarios (todos o solo algunos) y confirma el envío.',
      'Recibirás notificación cuando un banco envíe su oferta.',
    ],
  },
  {
    titulo: 'Gestionar ofertas y aceptar',
    pasos: [
      'Ve a "Mis Solicitudes" y busca la solicitud con ofertas pendientes (indicador azul).',
      'Expande la solicitud haciendo clic en ella.',
      'Compara las ofertas: tasa, monto y banco.',
      'Haz clic en "Aceptar" en la oferta que más te convenga.',
      'Confirma en el modal — se crea automáticamente el Compromiso.',
      'Las demás ofertas quedan rechazadas automáticamente.',
      'Descarga el PDF de la Constancia desde "Compromisos".',
    ],
  },
  {
    titulo: 'Tu primera Subasta Competitiva',
    pasos: [
      'Haz clic en "Nueva Subasta" en el menú.',
      'Configura moneda, monto mínimo, plazo y tasa objetivo.',
      'La subasta se envía a todos tus bancos activos.',
      'Monitorea las ofertas en tiempo real en "Mis Subastas".',
      'Cuando estés listo, adjudica la mejor oferta.',
      'Se genera el Compromiso automáticamente.',
    ],
  },
]

const GUIA_BANCO = [
  {
    titulo: 'Responder a una Solicitud de Colocación',
    pasos: [
      'Ve a "Colocaciones" en el menú.',
      'Las solicitudes activas aparecen en la sección superior.',
      'Expande la solicitud para ver los detalles del cliente: monto, plazo, tasa objetivo.',
      'Completa el formulario de oferta: tasa cierre (%), monto y notas opcionales.',
      'Haz clic en "Enviar Oferta".',
      'Si eres banco_mesa, tu oferta queda en estado "Pendiente de aprobación".',
      'Si eres banco_admin, la oferta es visible al cliente de inmediato.',
    ],
  },
  {
    titulo: 'Aprobar ofertas de mesa (banco_admin)',
    pasos: [
      'Ve a "Aprobaciones" en el menú.',
      'Verás la lista de ofertas enviadas por tus usuarios banco_mesa que esperan revisión.',
      'Revisa tasa, monto y solicitud origen.',
      'Aprueba para que el cliente pueda verla, o rechaza con justificación.',
      'El usuario banco_mesa recibe notificación del resultado.',
    ],
  },
  {
    titulo: 'Participar en una Subasta',
    pasos: [
      'Ve a "Solicitudes" en el menú para ver subastas activas.',
      'Expande la subasta para ver los parámetros del cliente.',
      'Envía tu oferta con tasa y monto competitivos.',
      'Puedes enviar varias ofertas y actualizar tu propuesta.',
      'Si tu oferta es adjudicada recibirás notificación y se creará el Compromiso.',
    ],
  },
  {
    titulo: 'Registrar ejecución de un Compromiso',
    pasos: [
      'Ve a "Compromisos" y localiza el compromiso en estado "Confirmado".',
      'Una vez realizado el desembolso, haz clic en "Marcar como Ejecutado".',
      'El sistema registra la fecha y hora de ejecución.',
      'Puedes descargar el Certificado de Ejecución en PDF.',
    ],
  },
]

const FAQ = [
  { p: '¿Qué significa "Monto libre" en una solicitud?', r: 'Significa que el cliente no especificó un monto máximo. El banco puede proponer el monto que mejor se adapte a su capacidad.' },
  { p: '¿Cuánto tiempo tengo para responder una solicitud?', r: 'Hasta la fecha de cierre indicada en la solicitud. Después de esa fecha la solicitud puede cerrarse por el cliente.' },
  { p: '¿El Compromiso es un contrato legal?', r: 'No. El Compromiso es una Constancia de Intención preliminar, no vinculante. Las partes deben formalizar la operación directamente con contratos bancarios físicos.' },
  { p: '¿Puedo cancelar una solicitud ya enviada?', r: 'Sí. En "Mis Solicitudes", con la solicitud abierta, usa el botón "Cerrar". Las ofertas pendientes quedarán sin respuesta.' },
  { p: '¿Qué pasa si rechazo todas las ofertas?', r: 'La solicitud permanece abierta hasta la fecha de cierre. Puedes cerrarla manualmente o esperar a que lleguen nuevas ofertas.' },
  { p: '¿Cómo sé que mi oferta fue aprobada (banco_mesa)?', r: 'Recibirás una notificación cuando tu admin la apruebe o rechace. En "Mis Ofertas" puedes ver el estado en tiempo real.' },
]

// ─── Componente principal ────────────────────────────────────────────────────
export const HelpDesk: React.FC = () => {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<HelpTab>('manual')

  const esBanco = user?.role.startsWith('banco')
  const esCliente = user?.role.startsWith('cliente')

  const tabs: { id: HelpTab; label: string; icono: string }[] = [
    { id: 'manual',       label: 'Manual',       icono: '📖' },
    { id: 'chat',         label: 'Chat IA',       icono: '🤖' },
    { id: 'capacitacion', label: 'Capacitación',  icono: '🎓' },
    { id: 'contacto',     label: 'Contacto',      icono: '✉️' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Help Desk</h2>
        <p className="text-[var(--muted)] mt-1">
          Soporte, documentación y asistencia para FundLink AI
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--line)] pb-0 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--muted)] hover:text-white'
            }`}
          >
            {t.icono} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'manual'       && <TabManual />}
      {tab === 'chat'         && <TabChat />}
      {tab === 'capacitacion' && <TabCapacitacion esBanco={esBanco} esCliente={esCliente} />}
      {tab === 'contacto'     && <TabContacto />}
    </div>
  )
}

// ─── Tab: Manual ─────────────────────────────────────────────────────────────
const TabManual: React.FC = () => {
  const [abierto, setAbierto] = useState<string | null>('primeros-pasos')
  const [busqueda, setBusqueda] = useState('')

  const secciones = busqueda.trim()
    ? MANUAL_SECTIONS.filter(s =>
        s.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
        s.items.some(i =>
          i.sub.toLowerCase().includes(busqueda.toLowerCase()) ||
          i.texto.toLowerCase().includes(busqueda.toLowerCase())
        )
      )
    : MANUAL_SECTIONS

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">🔍</span>
        <input
          type="text"
          placeholder="Buscar en el manual..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-[var(--line)] rounded-lg text-sm focus:outline-none focus:border-[var(--primary)] transition-colors"
        />
      </div>

      {secciones.length === 0 ? (
        <Card>
          <p className="text-center text-[var(--muted)] py-8 text-sm">
            No se encontraron resultados para "{busqueda}"
          </p>
        </Card>
      ) : (
        secciones.map(sec => {
          const isOpen = abierto === sec.id
          return (
            <Card key={sec.id} className="!p-0 overflow-hidden">
              {/* Header acordeón */}
              <button
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors text-left"
                onClick={() => setAbierto(isOpen ? null : sec.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{sec.icono}</span>
                  <span className="font-semibold">{sec.titulo}</span>
                </div>
                <span className="text-[var(--muted)] text-sm">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Contenido */}
              {isOpen && (
                <div className="border-t border-[var(--line)] px-5 pb-5 pt-4 space-y-4">
                  {sec.items.map((item, idx) => (
                    <div key={idx}>
                      <div className="text-sm font-semibold text-[var(--primary)] mb-1">
                        {item.sub}
                      </div>
                      <p className="text-sm text-[var(--muted)] leading-relaxed">
                        {item.texto}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}

// ─── Tab: Chat ────────────────────────────────────────────────────────────────
const TabChat: React.FC = () => {
  const { user } = useAuthStore()
  const [mensajes, setMensajes] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      content: `¡Hola${user?.nombre ? `, ${user.nombre}` : ''}! Soy el asistente de FundLink AI. ¿En qué puedo ayudarte hoy? Puedo responder preguntas sobre solicitudes de colocación, subastas, compromisos y el uso de la plataforma.`,
    },
  ])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, cargando])

  const enviar = async () => {
    const texto = input.trim()
    if (!texto || cargando) return

    const nuevo = [...mensajes, { role: 'user' as const, content: texto }]
    setMensajes(nuevo)
    setInput('')
    setCargando(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No autenticado')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/helpdesk-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            messages: nuevo.map(m => ({ role: m.role, content: m.content })),
            userRole: user?.role,
          }),
        }
      )

      const data = await res.json()
      if (!res.ok || !data.reply) throw new Error(data.error || 'Sin respuesta')

      setMensajes(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err: any) {
      setError(err.message?.includes('Failed to fetch') || err.message?.includes('ANTHROPIC')
        ? 'El chat de IA no está configurado aún. Usa el correo de contacto para soporte.'
        : 'Error al conectar con el asistente. Intenta de nuevo.'
      )
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="!p-0 overflow-hidden">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--line)] bg-white/[0.02]">
          <div className="w-8 h-8 rounded-full bg-[var(--primary)]/20 border border-[var(--primary)]/40 flex items-center justify-center text-sm">
            🤖
          </div>
          <div>
            <div className="text-sm font-semibold">Asistente FundLink AI</div>
            <div className="text-xs text-[var(--muted)]">Responde sobre el uso de la plataforma</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[var(--good)] animate-pulse"></div>
            <span className="text-xs text-[var(--good)]">En línea</span>
          </div>
        </div>

        {/* Mensajes */}
        <div className="h-96 overflow-y-auto p-4 space-y-3">
          {mensajes.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-[var(--primary)]/20 flex items-center justify-center text-xs mr-2 flex-shrink-0 mt-0.5">
                  🤖
                </div>
              )}
              <div
                className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[var(--primary)] text-white rounded-br-sm'
                    : 'bg-white/8 border border-white/10 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs ml-2 flex-shrink-0 mt-0.5">
                  {user?.nombre?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
          ))}

          {cargando && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-[var(--primary)]/20 flex items-center justify-center text-xs mr-2 mt-0.5">
                🤖
              </div>
              <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  <div className="w-2 h-2 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-[var(--warn)] bg-yellow-900/20 border border-yellow-900/40 rounded-lg px-3 py-2 text-center">
              ⚠️ {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[var(--line)] p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
            placeholder="Escribe tu consulta..."
            disabled={cargando}
            className="flex-1 bg-white/5 border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-50"
          />
          <Button
            variant="primary"
            onClick={enviar}
            disabled={!input.trim() || cargando}
            className="px-4"
          >
            Enviar
          </Button>
        </div>
      </Card>

      <p className="text-xs text-[var(--muted)] text-center">
        El asistente responde sobre el uso de FundLink AI. Para soporte técnico urgente usa la pestaña Contacto.
      </p>
    </div>
  )
}

// ─── Tab: Capacitación ────────────────────────────────────────────────────────
const TabCapacitacion: React.FC<{ esBanco?: boolean; esCliente?: boolean }> = ({ esBanco, esCliente }) => {
  const [seccion, setSeccion] = useState<'cliente' | 'banco' | 'faq'>(
    esBanco ? 'banco' : 'cliente'
  )
  const [guiaAbierta, setGuiaAbierta] = useState<number | null>(0)
  const [faqAbierto, setFaqAbierto] = useState<number | null>(null)

  const guias = seccion === 'cliente' ? GUIA_CLIENTE : GUIA_BANCO

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {[
          { id: 'cliente', label: '👔 Para Clientes' },
          { id: 'banco',   label: '🏦 Para Bancos' },
          { id: 'faq',     label: '❓ Preguntas Frecuentes' },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => { setSeccion(s.id as any); setGuiaAbierta(0); setFaqAbierto(null) }}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              seccion === s.id
                ? 'bg-[var(--primary)] text-white'
                : 'bg-white/10 text-[var(--muted)] hover:text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Guías paso a paso */}
      {seccion !== 'faq' && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            {seccion === 'cliente'
              ? 'Guías paso a paso para usuarios clientes de FundLink AI.'
              : 'Guías paso a paso para usuarios de bancos en FundLink AI.'}
          </p>
          {guias.map((guia, idx) => {
            const isOpen = guiaAbierta === idx
            return (
              <Card key={idx} className="!p-0 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors text-left"
                  onClick={() => setGuiaAbierta(isOpen ? null : idx)}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-sm">{guia.titulo}</span>
                  </div>
                  <span className="text-[var(--muted)] text-sm">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--line)] px-5 pb-5 pt-4">
                    <ol className="space-y-3">
                      {guia.pasos.map((paso, pi) => (
                        <li key={pi} className="flex items-start gap-3 text-sm">
                          <span className="w-6 h-6 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            {pi + 1}
                          </span>
                          <span className="text-[var(--muted)] leading-relaxed">{paso}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Botón solicitar capacitación */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            const subject = encodeURIComponent('[FundLink AI] Solicitud de Capacitación')
            const body = encodeURIComponent('Hola,\n\nMe gustaría solicitar una sesión de capacitación para mi equipo sobre el uso de FundLink AI.\n\nPor favor contáctenme para coordinar.\n\nGracias.')
            window.open(`mailto:soporte@fundlink.gt?subject=${subject}&body=${body}`)
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary)]/80 text-white text-sm font-semibold transition-colors"
        >
          🎓 Solicitar Capacitación
        </button>
      </div>

      {/* FAQ */}
      {seccion === 'faq' && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">Respuestas a las dudas más comunes sobre FundLink AI.</p>
          {FAQ.map((item, idx) => {
            const isOpen = faqAbierto === idx
            return (
              <Card key={idx} className="!p-0 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors text-left"
                  onClick={() => setFaqAbierto(isOpen ? null : idx)}
                >
                  <span className="text-sm font-semibold pr-4">{item.p}</span>
                  <span className="text-[var(--muted)] text-sm flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--line)] px-5 py-4">
                    <p className="text-sm text-[var(--muted)] leading-relaxed">{item.r}</p>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Contacto ────────────────────────────────────────────────────────────
const TabContacto: React.FC = () => {
  const { user } = useAuthStore()
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [prioridad, setPrioridad] = useState<'normal' | 'urgente'>('normal')
  const [enviado, setEnviado] = useState(false)

  const EMAIL_SOPORTE = 'soporte@fundlink.gt'

  const handleEnviar = () => {
    if (!asunto.trim() || !mensaje.trim()) return
    const body = encodeURIComponent(
      `Prioridad: ${prioridad.toUpperCase()}\n\nUsuario: ${user?.nombre || ''} (${user?.email || ''})\nRol: ${user?.role || ''}\nEntidad: ${user?.entidad || ''}\n\n---\n\n${mensaje}`
    )
    const subject = encodeURIComponent(`[FundLink AI${prioridad === 'urgente' ? ' - URGENTE' : ''}] ${asunto}`)
    window.open(`mailto:${EMAIL_SOPORTE}?subject=${subject}&body=${body}`)
    setEnviado(true)
    setTimeout(() => setEnviado(false), 5000)
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Info de contacto */}
      <div className="space-y-4">
        <Card>
          <h3 className="font-bold mb-4">Información de Soporte</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✉️</span>
              <div>
                <div className="text-xs text-[var(--muted)] mb-0.5">Correo de soporte</div>
                <a
                  href={`mailto:${EMAIL_SOPORTE}`}
                  className="font-semibold text-[var(--link)] hover:underline"
                >
                  {EMAIL_SOPORTE}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">⏰</span>
              <div>
                <div className="text-xs text-[var(--muted)] mb-0.5">Horario de atención</div>
                <div className="text-sm font-semibold">Lunes a Viernes</div>
                <div className="text-sm text-[var(--muted)]">8:00 AM — 6:00 PM (GMT-6)</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <div className="text-xs text-[var(--muted)] mb-0.5">Tiempo de respuesta</div>
                <div className="text-sm font-semibold">Normal: 24 h hábiles</div>
                <div className="text-sm text-[var(--muted)]">Urgente: 4 h hábiles</div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-blue-900/10 border-blue-900/30">
          <p className="text-sm text-blue-200 leading-relaxed">
            <strong>Antes de escribir</strong>, te recomendamos revisar el <strong>Manual</strong> o usar el <strong>Chat IA</strong> — la mayoría de dudas operativas se resuelven allí de inmediato.
          </p>
        </Card>
      </div>

      {/* Formulario */}
      <Card>
        <h3 className="font-bold mb-4">Enviar Consulta</h3>
        {enviado && (
          <div className="mb-4 p-3 rounded-lg bg-green-900/20 border border-green-900/50 text-green-300 text-sm">
            ✓ Se abrió tu cliente de correo. Si no se abrió, escríbenos directamente a {EMAIL_SOPORTE}
          </div>
        )}
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-[var(--muted)]">Prioridad</label>
            <div className="flex gap-2">
              {(['normal', 'urgente'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPrioridad(p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors capitalize ${
                    prioridad === p
                      ? p === 'urgente'
                        ? 'bg-red-900/30 border-red-700 text-red-300'
                        : 'bg-[var(--primary)]/20 border-[var(--primary)]/60 text-[var(--primary)]'
                      : 'bg-white/5 border-[var(--line)] text-[var(--muted)] hover:text-white'
                  }`}
                >
                  {p === 'urgente' ? '🔴 Urgente' : '🟢 Normal'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[var(--muted)]">Asunto</label>
            <input
              type="text"
              value={asunto}
              onChange={e => setAsunto(e.target.value)}
              placeholder="Describe brevemente tu consulta"
              className="w-full bg-white/5 border border-[var(--line)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[var(--muted)]">Mensaje</label>
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              placeholder="Describe el problema o consulta con el mayor detalle posible..."
              rows={5}
              className="w-full bg-white/5 border border-[var(--line)] rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>

          <Button
            variant="primary"
            className="w-full"
            onClick={handleEnviar}
            disabled={!asunto.trim() || !mensaje.trim()}
          >
            ✉️ Abrir en Correo
          </Button>
          <p className="text-xs text-[var(--muted)] text-center">
            Se abrirá tu cliente de correo con los datos pre-llenados.
          </p>
        </div>
      </Card>
    </div>
  )
}
