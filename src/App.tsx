import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { LoginPage } from './components/auth/LoginPage'
import { Layout } from './components/common/Layout'
import { CambiarPasswordModal } from './components/common/CambiarPasswordModal'
import { supabase } from './lib/supabase'
import { ClienteDashboard } from './pages/ClienteDashboard'
import { BancoDashboard } from './pages/BancoDashboard'
import { WebAdminDashboard } from './pages/WebAdminDashboard'
import { NuevaSubasta } from './pages/NuevaSubasta'
import { NuevaSolicitudColocacion } from './pages/NuevaSolicitudColocacion'
import { ClienteSolicitudesColocacion } from './pages/ClienteSolicitudesColocacion'
import { BancoColocaciones } from './pages/BancoColocaciones'
import { ClienteSubastas } from './pages/ClienteSubastas'
import { HistorialSubastas } from './pages/HistorialSubastas'
import { ClienteCompromisos } from './pages/ClienteCompromisos'
import { ClienteConfiguracion } from './pages/ClienteConfiguracion'
import { ClienteVencimientos } from './pages/ClienteVencimientos'
import { ClienteOnboarding } from './pages/ClienteOnboarding'
import { BancoSolicitudes } from './pages/BancoSolicitudes'
import { BancoOfertas } from './pages/BancoOfertas'
import { BancoAprobaciones } from './pages/BancoAprobaciones'
import { BancoCompromisos } from './pages/BancoCompromisos'
import { BancoClientes } from './pages/BancoClientes'
import { BancoConfiguracion } from './pages/BancoConfiguracion'
import { WebAdminUsuarios } from './pages/WebAdminUsuarios'
import { WebAdminCompromisos } from './pages/WebAdminCompromisos'
import { WebAdminSistema } from './pages/WebAdminSistema'
import { WebAdminAuditoria } from './pages/WebAdminAuditoria'
import { WebAdminAprobaciones } from './pages/WebAdminAprobaciones'
import { HelpDesk } from './pages/HelpDesk'
import type { User } from './types/database'

type ClientePage = 'dashboard' | 'nueva-subasta' | 'subastas' | 'historial' | 'compromisos' | 'vencimientos' | 'configuracion' | 'solicitudes' | 'nueva-solicitud' | 'help'
type BancoPage = 'dashboard' | 'solicitudes' | 'ofertas' | 'aprobaciones' | 'compromisos' | 'clientes' | 'configuracion' | 'colocaciones' | 'help'
type WebAdminPage = 'dashboard' | 'usuarios' | 'compromisos' | 'sistema' | 'auditoria' | 'aprobaciones' | 'help'
type Page = ClientePage | BancoPage | WebAdminPage

// ─── Sidebar helpers ─────────────────────────────────────────────────────────

function NavItem({
  icon, label, active, onClick, indent = false,
}: {
  icon: string; label: string; active: boolean; onClick: () => void; indent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 py-2 pr-4 text-sm transition-all text-left relative
        ${indent ? 'pl-10' : 'pl-4'}
        ${active
          ? 'text-[var(--primary)] bg-[var(--primary)]/10 font-semibold before:absolute before:left-0 before:inset-y-0 before:w-0.5 before:bg-[var(--primary)] before:rounded-r'
          : 'text-[var(--muted)] hover:text-white hover:bg-white/5'
        }
      `}
    >
      <span className="text-base leading-none flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

function NavGroup({
  icon, label, children, defaultOpen = true,
}: {
  icon: string; label: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between pl-4 pr-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-base leading-none">{icon}</span>
          <span className="font-semibold">{label}</span>
        </div>
        <span className="text-[10px] text-[var(--muted)]">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

function NavDivider({ label }: { label?: string }) {
  return (
    <div className="px-4 pt-4 pb-1">
      {label
        ? <span className="text-[10px] uppercase tracking-widest text-white/25 font-semibold">{label}</span>
        : <div className="border-t border-[var(--line)]" />
      }
    </div>
  )
}

// ─── Sidebars por rol ────────────────────────────────────────────────────────

function ClienteSidebar({
  current, go, goNuevaSolicitud, user,
}: {
  current: Page
  go: (p: Page) => void
  goNuevaSolicitud: () => void
  user: User
}) {
  const rolLabel = user.role === 'cliente_admin' ? 'Admin' : 'Usuario'
  return (
    <nav className="py-4 flex flex-col gap-0.5">
      {/* Role badge */}
      <div className="px-4 pb-3 flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30 font-semibold">
          Cliente · {rolLabel}
        </span>
      </div>

      <NavItem icon="🏠" label="Dashboard" active={current === 'dashboard'} onClick={() => go('dashboard')} />

      <NavDivider label="Colocaciones" />
      <NavItem icon="➕" label="Nueva Solicitud" active={current === 'nueva-solicitud'} onClick={goNuevaSolicitud} />
      <NavItem icon="📋" label="Mis Solicitudes" active={current === 'solicitudes'} onClick={() => go('solicitudes')} />

      <NavDivider label="Subastas" />
      <NavGroup icon="🏛️" label="Subastas">
        <NavItem indent icon="➕" label="Nueva Subasta" active={current === 'nueva-subasta'} onClick={() => go('nueva-subasta')} />
        <NavItem indent icon="📑" label="Mis Subastas" active={current === 'subastas'} onClick={() => go('subastas')} />
        <NavItem indent icon="📜" label="Historial" active={current === 'historial'} onClick={() => go('historial')} />
      </NavGroup>

      <NavDivider label="Seguimiento" />
      <NavItem icon="📄" label="Compromisos" active={current === 'compromisos'} onClick={() => go('compromisos')} />
      <NavItem icon="📅" label="Vencimientos" active={current === 'vencimientos'} onClick={() => go('vencimientos')} />

      <NavDivider />
      <NavItem icon="⚙️" label="Configuración" active={current === 'configuracion'} onClick={() => go('configuracion')} />
      <NavItem icon="❓" label="Help Desk" active={current === 'help'} onClick={() => go('help')} />
    </nav>
  )
}

function BancoSidebar({
  current, go, user,
}: {
  current: Page
  go: (p: Page) => void
  user: User
}) {
  const isAdmin = user.role === 'banco_admin'
  const rolLabel = user.role === 'banco_admin' ? 'Admin' : user.role === 'banco_mesa' ? 'Mesa' : 'Auditor'
  return (
    <nav className="py-4 flex flex-col gap-0.5">
      <div className="px-4 pb-3 flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
          Banco · {rolLabel}
        </span>
      </div>

      <NavItem icon="🏠" label="Dashboard" active={current === 'dashboard'} onClick={() => go('dashboard')} />

      <NavDivider label="Mercado" />
      <NavGroup icon="📋" label="Solicitudes & Ofertas">
        <NavItem indent icon="📋" label="Subastas Activas" active={current === 'solicitudes'} onClick={() => go('solicitudes')} />
        <NavItem indent icon="📤" label="Mis Ofertas" active={current === 'ofertas'} onClick={() => go('ofertas')} />
      </NavGroup>
      <NavItem icon="🏦" label="Colocaciones" active={current === 'colocaciones'} onClick={() => go('colocaciones')} />

      {isAdmin && (
        <>
          <NavDivider label="Gestión" />
          <NavItem icon="✅" label="Aprobaciones" active={current === 'aprobaciones'} onClick={() => go('aprobaciones')} />
          <NavItem icon="👥" label="Clientes" active={current === 'clientes'} onClick={() => go('clientes')} />
        </>
      )}

      <NavDivider label="Operaciones" />
      <NavItem icon="📄" label="Compromisos" active={current === 'compromisos'} onClick={() => go('compromisos')} />

      <NavDivider />
      <NavItem icon="⚙️" label="Configuración" active={current === 'configuracion'} onClick={() => go('configuracion')} />
      <NavItem icon="❓" label="Help Desk" active={current === 'help'} onClick={() => go('help')} />
    </nav>
  )
}

function WebAdminSidebar({ current, go }: { current: Page; go: (p: Page) => void }) {
  return (
    <nav className="py-4 flex flex-col gap-0.5">
      <div className="px-4 pb-3 flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
          Web Admin
        </span>
      </div>

      <NavItem icon="🏠" label="Dashboard" active={current === 'dashboard'} onClick={() => go('dashboard')} />

      <NavDivider label="Usuarios" />
      <NavItem icon="👥" label="Usuarios" active={current === 'usuarios'} onClick={() => go('usuarios')} />
      <NavItem icon="✅" label="Aprobaciones" active={current === 'aprobaciones'} onClick={() => go('aprobaciones')} />

      <NavDivider label="Operaciones" />
      <NavItem icon="📄" label="Compromisos" active={current === 'compromisos'} onClick={() => go('compromisos')} />

      <NavDivider label="Plataforma" />
      <NavGroup icon="🖥️" label="Sistema & Auditoría">
        <NavItem indent icon="🖥️" label="Sistema" active={current === 'sistema'} onClick={() => go('sistema')} />
        <NavItem indent icon="🔍" label="Auditoría" active={current === 'auditoria'} onClick={() => go('auditoria')} />
      </NavGroup>

      <NavDivider />
      <NavItem icon="❓" label="Help Desk" active={current === 'help'} onClick={() => go('help')} />
    </nav>
  )
}

// ─── App principal ────────────────────────────────────────────────────────────

function App() {
  const { user, loading, initialized, initialize } = useAuthStore()
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [nuevaSolicitudKey, setNuevaSolicitudKey] = useState(0)
  const [mostrarCambioPassword, setMostrarCambioPassword] = useState(false)

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('verify') || params.get('verify-sol') || params.get('verify-oferta')) {
      window.history.replaceState({}, '', window.location.pathname)
      if (user) setCurrentPage('compromisos')
    }
  }, [user])

  useEffect(() => {
    if (user && user.primer_login) {
      setMostrarCambioPassword(true)
    }
  }, [user])

  const handlePasswordCambiado = async () => {
    if (user) {
      await supabase.from('users').update({ primer_login: false }).eq('id', user.id)
    }
    setMostrarCambioPassword(false)
    window.location.reload()
  }

  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[var(--primary)] mx-auto mb-4" />
          <p className="text-white text-lg">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  if (user.role.startsWith('cliente') && !user.onboarding_completado) {
    return <Layout><ClienteOnboarding /></Layout>
  }

  if (user.role.startsWith('cliente') && user.onboarding_completado && !user.aprobado_por_admin) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="animate-pulse text-6xl mb-4">⏱️</div>
          <h2 className="text-2xl font-bold mb-4">Cuenta en Revisión</h2>
          <p className="text-[var(--muted)] mb-6">
            Tu configuración está siendo revisada por nuestro equipo.
            Te notificaremos cuando tu cuenta esté aprobada y puedas empezar a operar.
          </p>
          <p className="text-sm text-[var(--muted)]">Si tienes preguntas, contacta a soporte.</p>
        </div>
      </Layout>
    )
  }

  const go = (p: Page) => setCurrentPage(p)

  const getSidebar = () => {
    if (user.role.startsWith('cliente')) {
      return (
        <ClienteSidebar
          current={currentPage}
          go={go}
          goNuevaSolicitud={() => { go('nueva-solicitud'); setNuevaSolicitudKey(k => k + 1) }}
          user={user}
        />
      )
    }
    if (user.role.startsWith('banco')) {
      return <BancoSidebar current={currentPage} go={go} user={user} />
    }
    if (user.role === 'webadmin') {
      return <WebAdminSidebar current={currentPage} go={go} />
    }
    return null
  }

  const getPage = () => {
    if (user.role.startsWith('cliente')) {
      switch (currentPage) {
        case 'nueva-subasta':   return <NuevaSubasta onSubastaCreada={() => go('subastas')} />
        case 'subastas':        return <ClienteSubastas />
        case 'historial':       return <HistorialSubastas />
        case 'compromisos':     return <ClienteCompromisos />
        case 'vencimientos':    return <ClienteVencimientos />
        case 'solicitudes':     return <ClienteSolicitudesColocacion />
        case 'nueva-solicitud': return <NuevaSolicitudColocacion key={nuevaSolicitudKey} onCreada={() => go('solicitudes')} />
        case 'configuracion':   return <ClienteConfiguracion />
        case 'help':            return <HelpDesk />
        default:                return <ClienteDashboard onNavigate={(page) => go(page as Page)} />
      }
    }

    if (user.role.startsWith('banco')) {
      switch (currentPage) {
        case 'solicitudes':   return <BancoSolicitudes />
        case 'ofertas':       return <BancoOfertas />
        case 'aprobaciones':  return <BancoAprobaciones />
        case 'compromisos':   return <BancoCompromisos />
        case 'clientes':      return <BancoClientes />
        case 'colocaciones':  return <BancoColocaciones />
        case 'configuracion': return <BancoConfiguracion />
        case 'help':          return <HelpDesk />
        default:              return <BancoDashboard onNavigate={go} />
      }
    }

    if (user.role === 'webadmin') {
      switch (currentPage) {
        case 'usuarios':     return <WebAdminUsuarios />
        case 'aprobaciones': return <WebAdminAprobaciones />
        case 'compromisos':  return <WebAdminCompromisos />
        case 'sistema':      return <WebAdminSistema />
        case 'auditoria':    return <WebAdminAuditoria />
        case 'help':         return <HelpDesk />
        default:             return <WebAdminDashboard />
      }
    }

    return <div>Rol no reconocido</div>
  }

  return (
    <>
      <Layout sidebar={getSidebar()}>
        {getPage()}
      </Layout>

      {mostrarCambioPassword && (
        <CambiarPasswordModal onSuccess={handlePasswordCambiado} />
      )}

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
      />
    </>
  )
}

export default App
