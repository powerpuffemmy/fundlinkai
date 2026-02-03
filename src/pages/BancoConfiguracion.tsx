import React, { useState, useEffect } from 'react'
import { Card } from '@/components/common/Card'
import { LogoUploader } from '@/components/banco/LogoUploader'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

export const BancoConfiguracion: React.FC = () => {
  const { user, setUser } = useAuthStore()
  const [logoUrl, setLogoUrl] = useState<string | undefined>(user?.logo_url)

  useEffect(() => {
    setLogoUrl(user?.logo_url)
  }, [user?.logo_url])

  const handleLogoUpdated = async (newUrl: string | null) => {
    setLogoUrl(newUrl || undefined)
    
    // Actualizar el usuario en el store
    if (user) {
      setUser({ ...user, logo_url: newUrl || undefined })
    }

    // Refrescar datos del usuario desde la BD
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user!.id)
      .single()

    if (data) {
      setUser(data)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configuración</h2>
        <p className="text-[var(--muted)] mt-1">
          Gestiona la información y preferencias de tu banco
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Información del Banco */}
        <Card>
          <h3 className="font-bold text-lg mb-4">Información del Banco</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Entidad</label>
              <div className="font-semibold">{user?.entidad}</div>
            </div>

            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Email</label>
              <div className="font-semibold">{user?.email}</div>
            </div>

            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Rol</label>
              <div className="font-semibold capitalize">
                {user?.role.replace('banco_', '').replace('_', ' ')}
              </div>
            </div>

            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Estado</label>
              <div className="inline-flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${user?.activo ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="font-semibold">{user?.activo ? 'Activo' : 'Inactivo'}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Logo del Banco */}
        <Card>
          <h3 className="font-bold text-lg mb-4">Identidad Visual</h3>
          
          <LogoUploader 
            currentLogoUrl={logoUrl}
            onLogoUpdated={handleLogoUpdated}
          />

          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-400">
              <strong>💡 Tip:</strong> Tu logo aparecerá en los contratos (PDF) de los compromisos que tu banco genere con los clientes.
            </p>
          </div>
        </Card>
      </div>

      {/* Sección de preferencias (placeholder para futuro) */}
      <Card>
        <h3 className="font-bold text-lg mb-4">Preferencias</h3>
        <p className="text-[var(--muted)]">
          Próximamente podrás configurar notificaciones, límites de exposición y otras preferencias.
        </p>
      </Card>
    </div>
  )
}
