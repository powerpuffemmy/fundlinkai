import { useState } from 'react'
import { useAuthStore } from './store/authStore'
import { LoginPage } from './components/auth/LoginPage'
import { Layout } from './components/common/Layout'
import { ClienteDashboard } from './pages/ClienteDashboard'
import { BancoDashboard } from './pages/BancoDashboard'
import { WebAdminDashboard } from './pages/WebAdminDashboard'
import { NuevaSubasta } from './pages/NuevaSubasta'
import { ClienteSubastas } from './pages/ClienteSubastas'
import { ClienteCompromisos } from './pages/ClienteCompromisos'
import { BancoSolicitudes } from './pages/BancoSolicitudes'
import { BancoOfertas } from './pages/BancoOfertas'
import { BancoAprobaciones } from './pages/BancoAprobaciones'
import { BancoCompromisos } from './pages/BancoCompromisos'
import { BancoConfiguracion } from './pages/BancoConfiguracion'
import { WebAdminUsuarios } from './pages/WebAdminUsuarios'
import { WebAdminSistema } from './pages/WebAdminSistema'
import { WebAdminAuditoria } from './pages/WebAdminAuditoria'
import { Button } from './components/common/Button'

type ClientePage = 'dashboard' | 'nueva-subasta' | 'subastas' | 'compromisos'
type BancoPage = 'dashboard' | 'solicitudes' | 'ofertas' | 'aprobaciones' | 'compromisos' | 'configuracion'
type WebAdminPage = 'dashboard' | 'usuarios' | 'sistema' | 'auditoria'
type Page = ClientePage | BancoPage | WebAdminPage

function App() {
  const { user } = useAuthStore()
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')

  if (!user) {
    return <LoginPage />
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
          return <NuevaSubasta />
        case 'subastas':
          return <ClienteSubastas />
        case 'compromisos':
          return <ClienteCompromisos />
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
          return <BancoDashboard />
      }
    }

    if (user.role === 'webadmin') {
      switch (currentPage) {
        case 'usuarios':
          return <WebAdminUsuarios />
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
    <Layout>
      {getNavigation()}
      {getPage()}
    </Layout>
  )
}

export default App
