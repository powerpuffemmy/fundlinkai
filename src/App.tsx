import { useState, useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { LoginPage } from './components/auth/LoginPage'
import { Layout } from './components/common/Layout'
import { CambiarPasswordModal } from './components/common/CambiarPasswordModal'
import { supabase } from './lib/supabase'
import { ClienteDashboard } from './pages/ClienteDashboard'
import { BancoDashboard } from './pages/BancoDashboard'
import { WebAdminDashboard } from './pages/WebAdminDashboard'
import { NuevaSubasta } from './pages/NuevaSubasta'
import { ClienteSubastas } from './pages/ClienteSubastas'
import { ClienteCompromisos } from './pages/ClienteCompromisos'
import { ClienteConfiguracion } from './pages/ClienteConfiguracion'
import { ClienteOnboarding } from './pages/ClienteOnboarding'
import { BancoSolicitudes } from './pages/BancoSolicitudes'
import { BancoOfertas } from './pages/BancoOfertas'
import { BancoAprobaciones } from './pages/BancoAprobaciones'
import { BancoCompromisos } from './pages/BancoCompromisos'
import { BancoConfiguracion } from './pages/BancoConfiguracion'
import { WebAdminUsuarios } from './pages/WebAdminUsuarios'
import { WebAdminSistema } from './pages/WebAdminSistema'
import { WebAdminAuditoria } from './pages/WebAdminAuditoria'
import { WebAdminAprobaciones } from './pages/WebAdminAprobaciones'
import { Button } from './components/common/Button'

type ClientePage = 'dashboard' | 'nueva-subasta' | 'subastas' | 'compromisos' | 'configuracion'
type BancoPage = 'dashboard' | 'solicitudes' | 'ofertas' | 'aprobaciones' | 'compromisos' | 'configuracion'
type WebAdminPage = 'dashboard' | 'usuarios' | 'sistema' | 'auditoria' | 'aprobaciones'
type Page = ClientePage | BancoPage | WebAdminPage

function App() {
  const { user, loading, initialized, initialize } = useAuthStore()
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [mostrarCambioPassword, setMostrarCambioPassword] = useState(false)

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    // Si es primer login, mostrar modal para cambiar contraseña
    if (user && user.primer_login) {
      setMostrarCambioPassword(true)
    }
  }, [user])

  const handlePasswordCambiado = async () => {
    // Marcar que ya no es primer login
    if (user) {
      await supabase
        .from('users')
        .update({ primer_login: false })
        .eq('id', user.id)
    }
    setMostrarCambioPassword(false)
    window.location.reload() // Recargar para actualizar el usuario
  }

  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
          <p className="text-white text-lg">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  // Si es cliente y no ha completado onboarding, mostrar pantalla de configuración
  if (user.role === 'cliente' && !user.onboarding_completado) {
    return (
      <Layout>
        <ClienteOnboarding />
      </Layout>
    )
  }

  // Si es cliente aprobado pero no activo, mostrar mensaje de espera
  if (user.role === 'cliente' && user.onboarding_completado && !user.aprobado_por_admin) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="animate-pulse text-6xl mb-4">⏱️</div>
          <h2 className="text-2xl font-bold mb-4">Cuenta en Revisión</h2>
          <p className="text-[var(--muted)] mb-6">
            Tu configuración está siendo revisada por nuestro equipo.
            Te notificaremos cuando tu cuenta esté aprobada y puedas empezar a operar.
          </p>
          <p className="text-sm text-[var(--muted)]">
            Si tienes preguntas, contacta a soporte.
          </p>
        </div>
      </Layout>
    )
  }

  const getNavigation = () => {
    if (user.role === 'cliente') {
      return (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <Button 
            variant={currentPage === 'dashboard' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('dashboard')}
          >
            Dashboard
          </Button>
          <Button 
            variant={currentPage === 'nueva-subasta' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('nueva-subasta')}
          >
            Nueva Subasta
          </Button>
          <Button 
            variant={currentPage === 'subastas' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('subastas')}
          >
            Mis Subastas
          </Button>
          <Button 
            variant={currentPage === 'compromisos' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('compromisos')}
          >
            Compromisos
          </Button>
          <Button 
            variant={currentPage === 'configuracion' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('configuracion')}
          >
            Configuración
          </Button>
        </div>
      )
    }

    if (user.role.startsWith('banco')) {
      return (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <Button 
            variant={currentPage === 'dashboard' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('dashboard')}
          >
            Dashboard
          </Button>
          <Button 
            variant={currentPage === 'solicitudes' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('solicitudes')}
          >
            Solicitudes
          </Button>
          <Button 
            variant={currentPage === 'ofertas' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('ofertas')}
          >
            Mis Ofertas
          </Button>
          {user.role === 'banco_admin' && (
            <Button 
              variant={currentPage === 'aprobaciones' ? 'primary' : 'secondary'}
              onClick={() => setCurrentPage('aprobaciones')}
            >
              Aprobaciones
            </Button>
          )}
          <Button 
            variant={currentPage === 'compromisos' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('compromisos')}
          >
            Compromisos
          </Button>
          <Button 
            variant={currentPage === 'configuracion' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('configuracion')}
          >
            Configuración
          </Button>
        </div>
      )
    }

    if (user.role === 'webadmin') {
      return (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <Button 
            variant={currentPage === 'dashboard' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('dashboard')}
          >
            Dashboard
          </Button>
          <Button 
            variant={currentPage === 'usuarios' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('usuarios')}
          >
            Usuarios
          </Button>
          <Button 
            variant={currentPage === 'aprobaciones' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('aprobaciones')}
          >
            Aprobaciones
          </Button>
          <Button 
            variant={currentPage === 'sistema' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('sistema')}
          >
            Sistema
          </Button>
          <Button 
            variant={currentPage === 'auditoria' ? 'primary' : 'secondary'}
            onClick={() => setCurrentPage('auditoria')}
          >
            Auditoría
          </Button>
        </div>
      )
    }

    return null
  }

  const getPage = () => {
    if (user.role === 'cliente') {
      switch (currentPage) {
        case 'nueva-subasta':
          return <NuevaSubasta onSubastaCreada={() => setCurrentPage('subastas')} />
        case 'subastas':
          return <ClienteSubastas />
        case 'compromisos':
          return <ClienteCompromisos />
        case 'configuracion':
          return <ClienteConfiguracion />
        default:
          return <ClienteDashboard />
      }
    }

    if (user.role.startsWith('banco')) {
      switch (currentPage) {
        case 'solicitudes':
          return <BancoSolicitudes />
        case 'ofertas':
          return <BancoOfertas />
        case 'aprobaciones':
          return <BancoAprobaciones />
        case 'compromisos':
          return <BancoCompromisos />
        case 'configuracion':
          return <BancoConfiguracion />
        default:
          return <BancoDashboard onNavigate={setCurrentPage} />
      }
    }

    if (user.role === 'webadmin') {
      switch (currentPage) {
        case 'usuarios':
          return <WebAdminUsuarios />
        case 'aprobaciones':
          return <WebAdminAprobaciones />
        case 'sistema':
          return <WebAdminSistema />
        case 'auditoria':
          return <WebAdminAuditoria />
        default:
          return <WebAdminDashboard />
      }
    }

    return <div>Rol no reconocido</div>
  }

  return (
    <>
      <Layout>
        {getNavigation()}
        {getPage()}
      </Layout>

      {/* Modal para cambiar contraseña en primer login */}
      {mostrarCambioPassword && (
        <CambiarPasswordModal onSuccess={handlePasswordCambiado} />
      )}
    </>
  )
}

export default App
