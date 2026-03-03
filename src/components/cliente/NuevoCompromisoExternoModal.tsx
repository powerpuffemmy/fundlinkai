import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { Select } from '@/components/common/Select'
import { useCompromisos } from '@/hooks/useCompromisos'
import { useClienteBancoLimites } from '@/hooks/useClienteBancoLimites'
import toast from 'react-hot-toast'
import type { Moneda } from '@/types/database'

interface NuevoCompromisoExternoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const NuevoCompromisoExternoModal: React.FC<NuevoCompromisoExternoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { crearCompromisoExterno, subirDocumentoCompromiso } = useCompromisos()
  const { obtenerTodosBancos } = useClienteBancoLimites()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [bancosOptions, setBancosOptions] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    obtenerTodosBancos().then((bancos: any[]) => {
      const opts = (bancos || []).map((b: any) => ({
        value: b.banco_entidad || b.banco_nombre,
        label: b.banco_entidad || b.banco_nombre
      }))
      setBancosOptions([{ value: '', label: '— Selecciona un banco —' }, ...opts])
    })
  }, [])

  const [form, setForm] = useState({
    contraparte_nombre: '',
    monto: '',
    moneda: 'GTQ' as Moneda,
    tasa: '',
    plazo: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    notas: '',
  })
  const [archivo, setArchivo] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tamaño (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo no puede pesar más de 10MB')
      return
    }

    // Validar tipo
    const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!tiposPermitidos.includes(file.type)) {
      toast.error('Solo se permiten archivos PDF, JPG, PNG o WebP')
      return
    }

    setArchivo(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones
    if (!form.contraparte_nombre.trim()) {
      toast.error('Ingresa el nombre de la contraparte')
      return
    }
    const monto = parseFloat(form.monto)
    if (!monto || monto <= 0) {
      toast.error('El monto debe ser mayor a 0')
      return
    }
    const tasa = parseFloat(form.tasa)
    if (!tasa || tasa <= 0 || tasa > 50) {
      toast.error('La tasa debe estar entre 0.01% y 50%')
      return
    }
    const plazo = parseInt(form.plazo)
    if (!plazo || plazo < 1 || plazo > 365) {
      toast.error('El plazo debe estar entre 1 y 365 días')
      return
    }
    if (!form.fecha_inicio) {
      toast.error('Selecciona la fecha de inicio')
      return
    }

    setSaving(true)
    try {
      let documento_url: string | undefined

      // Subir documento si existe
      if (archivo) {
        documento_url = await subirDocumentoCompromiso(archivo)
      }

      await crearCompromisoExterno({
        contraparte_nombre: form.contraparte_nombre.trim(),
        monto,
        moneda: form.moneda,
        tasa,
        plazo,
        fecha_inicio: form.fecha_inicio,
        notas: form.notas.trim() || undefined,
        documento_url,
      })

      toast.success('Compromiso externo registrado')

      // Reset form
      setForm({
        contraparte_nombre: '',
        monto: '',
        moneda: 'GTQ',
        tasa: '',
        plazo: '',
        fecha_inicio: new Date().toISOString().split('T')[0],
        notas: '',
      })
      setArchivo(null)
      onSuccess()
    } catch (error: any) {
      console.error('Error creando compromiso externo:', error)
      toast.error(error.message || 'Error al registrar el compromiso')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f1623] border border-[var(--line)] rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <h3 className="text-xl font-bold mb-4">Registrar Compromiso Externo</h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          Registra un compromiso con un banco o institución fuera de FundLink para monitorear todos tus compromisos en un solo lugar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Banco / Institución"
            name="contraparte_nombre"
            value={form.contraparte_nombre}
            onChange={handleChange}
            options={bancosOptions.length > 1 ? bancosOptions : [{ value: '', label: 'Cargando bancos...' }]}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monto"
              name="monto"
              type="number"
              step="0.01"
              min="0"
              value={form.monto}
              onChange={handleChange}
              placeholder="100,000"
              required
            />
            <Select
              label="Moneda"
              name="moneda"
              value={form.moneda}
              onChange={handleChange}
              options={[
                { value: 'GTQ', label: 'Quetzales (GTQ)' },
                { value: 'USD', label: 'Dólares (USD)' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tasa de Interés (%)"
              name="tasa"
              type="number"
              step="0.01"
              min="0.01"
              max="50"
              value={form.tasa}
              onChange={handleChange}
              placeholder="5.50"
              required
            />
            <Input
              label="Plazo (días)"
              name="plazo"
              type="number"
              min="1"
              max="365"
              value={form.plazo}
              onChange={handleChange}
              placeholder="90"
              required
            />
          </div>

          <Input
            label="Fecha de Inicio"
            name="fecha_inicio"
            type="date"
            value={form.fecha_inicio}
            onChange={handleChange}
            required
          />

          <div className="flex flex-col">
            <label className="text-xs text-[var(--muted)] mb-1.5">Notas (opcional)</label>
            <textarea
              name="notas"
              value={form.notas}
              onChange={handleChange}
              placeholder="Observaciones o detalles adicionales..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-[#253047] bg-[var(--field)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition-colors resize-none"
            />
          </div>

          {/* Upload de documento */}
          <div className="flex flex-col">
            <label className="text-xs text-[var(--muted)] mb-1.5">Documento (opcional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-3 py-4 rounded-lg border border-dashed border-[#253047] bg-[var(--field)] text-center cursor-pointer hover:border-[var(--primary)] transition-colors"
            >
              {archivo ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm text-[var(--text)]">{archivo.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setArchivo(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="text-red-400 text-xs hover:text-red-300"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-[var(--muted)]">
                    Clic para subir PDF, JPG o PNG
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-1">Máximo 10MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Registrar Compromiso'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
