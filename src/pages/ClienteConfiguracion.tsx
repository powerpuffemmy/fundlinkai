import React, { useState, useEffect } from 'react'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { useClienteBancoLimites } from '@/hooks/useClienteBancoLimites'
import { useAuthStore } from '@/store/authStore'
import { formatMoney } from '@/lib/utils'

export const ClienteConfiguracion: React.FC = () => {
  const { user } = useAuthStore()
  const { 
    limites, 
    loading, 
    crearLimite, 
    actualizarLimite,
    obtenerTodosBancos 
  } = useClienteBancoLimites()

  const [bancosDisponibles, setBancosDisponibles] = useState<any[]>([])
  const [editando, setEditando] = useState<Record<string, boolean>>({})
  const [valoresTemp, setValoresTemp] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<Record<string, boolean>>({})

  useEffect(() => {
    cargarBancos()
  }, [])

  const cargarBancos = async () => {
    const bancos = await obtenerTodosBancos()
    setBancosDisponibles(bancos)
  }

  const bancosConLimite = limites.map(l => l.banco_id)
  const bancosSinLimite = bancosDisponibles.filter(b => !bancosConLimite.includes(b.id))

  const handleIniciarEdicion = (limiteId: string, valorActual: number) => {
    setEditando(prev => ({ ...prev, [limiteId]: true }))
    setValoresTemp(prev => ({ ...prev, [limiteId]: valorActual.toString() }))
  }

  const handleCancelarEdicion = (limiteId: string) => {
    setEditando(prev => ({ ...prev, [limiteId]: false }))
    setValoresTemp(prev => {
      const { [limiteId]: _, ...rest } = prev
      return rest
    })
  }

  const handleGuardarLimite = async (limiteId: string) => {
    try {
      setGuardando(prev => ({ ...prev, [limiteId]: true }))
      
      const nuevoLimite = parseFloat(valoresTemp[limiteId] || '0')
      
      if (nuevoLimite < 0) {
        alert('El límite no puede ser negativo')
        return
      }

      await actualizarLimite(limiteId, { limite_monto: nuevoLimite })
      
      setEditando(prev => ({ ...prev, [limiteId]: false }))
      alert('Límite actualizado exitosamente')
    } catch (error) {
      console.error('Error guardando límite:', error)
      alert('Error al actualizar el límite')
    } finally {
      setGuardando(prev => ({ ...prev, [limiteId]: false }))
    }
  }

  const handleToggleActivo = async (limiteId: string, activoActual: boolean) => {
    try {
      await actualizarLimite(limiteId, { activo: !activoActual })
    } catch (error) {
      console.error('Error toggling activo:', error)
      alert('Error al cambiar el estado')
    }
  }

  const handleAgregarBanco = async (bancoId: string) => {
    try {
      if (!user) return

      const limiteInicial = 10000000 // 10M por defecto

      await crearLimite({
        cliente_id: user.id,
        banco_id: bancoId,
        limite_monto: limiteInicial,
        activo: true
      })

      alert('Banco agregado exitosamente con límite de $10M')
    } catch (error) {
      console.error('Error agregando banco:', error)
      alert('Error al agregar el banco')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Configuración</h2>
        <Card>
          <p className="text-[var(--muted)]">Cargando...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configuración de Tesorería</h2>
        <p className="text-[var(--muted)] mt-1">
          Gestiona los límites de colocación con cada banco
        </p>
      </div>

      {/* Información del Cliente */}
      <Card>
        <h3 className="font-bold text-lg mb-4">Información de la Empresa</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Entidad</label>
            <div className="font-semibold">{user?.entidad}</div>
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Email</label>
            <div className="font-semibold">{user?.email}</div>
          </div>
        </div>
      </Card>

      {/* Límites por Banco */}
      <Card>
        <h3 className="font-bold text-lg mb-4">Límites por Banco</h3>
        
        {limites.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--muted)] mb-4">
              No tienes bancos configurados aún
            </p>
            <p className="text-sm text-blue-400">
              Agrega bancos para empezar a trabajar con ellos
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Banco</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Límite</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Utilizado</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Disponible</th>
                  <th className="text-left p-3 text-sm text-[var(--muted)]">Estado</th>
                  <th className="text-right p-3 text-sm text-[var(--muted)]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {limites.map(limite => {
                  const disponible = limite.limite_monto - limite.monto_utilizado
                  const porcentajeUsado = (limite.monto_utilizado / limite.limite_monto) * 100

                  return (
                    <tr key={limite.id} className="border-b border-[var(--line)] hover:bg-white/5">
                      <td className="p-3">
                        <div className="font-semibold text-sm">{limite.banco_entidad}</div>
                        <div className="text-xs text-[var(--muted)]">{limite.banco_nombre}</div>
                      </td>
                      <td className="p-3">
                        {editando[limite.id] ? (
                          <Input
                            type="number"
                            value={valoresTemp[limite.id]}
                            onChange={(e) => setValoresTemp(prev => ({ 
                              ...prev, 
                              [limite.id]: e.target.value 
                            }))}
                            className="w-32"
                            min="0"
                            step="1000000"
                          />
                        ) : (
                          <span className="font-semibold">
                            {formatMoney(limite.limite_monto, 'USD')}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={porcentajeUsado > 80 ? 'text-[var(--warn)]' : ''}>
                          {formatMoney(limite.monto_utilizado, 'USD')}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`font-semibold ${
                          disponible < 1000000 ? 'text-[var(--bad)]' : 'text-[var(--good)]'
                        }`}>
                          {formatMoney(disponible, 'USD')}
                        </span>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleToggleActivo(limite.id, limite.activo)}
                          className={`text-xs px-2 py-1 rounded ${
                            limite.activo 
                              ? 'bg-green-900/20 text-green-200' 
                              : 'bg-gray-900/20 text-gray-200'
                          }`}
                        >
                          {limite.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-end">
                          {editando[limite.id] ? (
                            <>
                              <Button
                                variant="primary"
                                className="text-xs"
                                onClick={() => handleGuardarLimite(limite.id)}
                                disabled={guardando[limite.id]}
                              >
                                {guardando[limite.id] ? 'Guardando...' : 'Guardar'}
                              </Button>
                              <Button
                                variant="small"
                                className="text-xs"
                                onClick={() => handleCancelarEdicion(limite.id)}
                                disabled={guardando[limite.id]}
                              >
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="small"
                              className="text-xs"
                              onClick={() => handleIniciarEdicion(limite.id, limite.limite_monto)}
                            >
                              Editar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Agregar Nuevos Bancos */}
      {bancosSinLimite.length > 0 && (
        <Card>
          <h3 className="font-bold text-lg mb-4">Agregar Bancos</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {bancosSinLimite.map(banco => (
              <div 
                key={banco.id}
                className="p-3 bg-white/5 rounded-lg border border-blue-900/30"
              >
                <div className="font-semibold text-sm mb-2">{banco.entidad}</div>
                <div className="text-xs text-[var(--muted)] mb-3">{banco.nombre}</div>
                <Button
                  variant="primary"
                  className="w-full text-xs"
                  onClick={() => handleAgregarBanco(banco.id)}
                >
                  Agregar con límite de $10M
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Información */}
      <Card className="bg-blue-900/10 border-blue-900/30">
        <div>
          <div className="font-semibold text-blue-200 mb-2">Sobre los límites</div>
          <ul className="text-sm text-blue-300 space-y-1">
            <li>• El límite es el monto máximo que puedes colocar con cada banco</li>
            <li>• El monto utilizado se calcula automáticamente según compromisos vigentes</li>
            <li>• Solo podrás crear subastas con bancos que tengan límite disponible suficiente</li>
            <li>• Puedes desactivar temporalmente un banco sin perder su configuración</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
