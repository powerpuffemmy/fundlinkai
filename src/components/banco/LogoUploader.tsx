import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/common/Button'
import { useAuthStore } from '@/store/authStore'

interface LogoUploaderProps {
  currentLogoUrl?: string
  onLogoUpdated: (newUrl: string | null) => void
}

export const LogoUploader: React.FC<LogoUploaderProps> = ({ currentLogoUrl, onLogoUpdated }) => {
  const { user } = useAuthStore()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      setError(null)

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Debes seleccionar una imagen')
      }

      const file = event.target.files[0]
      
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        throw new Error('El archivo debe ser una imagen')
      }

      // Validar tamaño (máximo 2MB)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('La imagen no debe superar los 2MB')
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${user!.id}-${Math.random()}.${fileExt}`
      const filePath = `${user!.id}/${fileName}`

      // Subir archivo a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        throw uploadError
      }

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath)

      // Actualizar URL en la base de datos
      const { error: updateError } = await supabase
        .from('users')
        .update({ logo_url: publicUrl })
        .eq('id', user!.id)

      if (updateError) {
        throw updateError
      }

      onLogoUpdated(publicUrl)
      alert('Logo actualizado exitosamente')
    } catch (error: any) {
      console.error('Error al subir logo:', error)
      setError(error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar el logo?')) {
      return
    }

    try {
      setUploading(true)
      setError(null)

      // Actualizar base de datos para remover URL
      const { error: updateError } = await supabase
        .from('users')
        .update({ logo_url: null })
        .eq('id', user!.id)

      if (updateError) {
        throw updateError
      }

      onLogoUpdated(null)
      alert('Logo eliminado exitosamente')
    } catch (error: any) {
      console.error('Error al eliminar logo:', error)
      setError(error.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Logo de la Empresa</label>
        
        {currentLogoUrl && (
          <div className="mb-4 p-4 bg-white/5 rounded-lg">
            <img 
              src={currentLogoUrl} 
              alt="Logo actual" 
              className="max-h-32 object-contain"
            />
          </div>
        )}

        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
            <Button 
              variant="primary" 
              disabled={uploading}
              onClick={(e) => {
                e.preventDefault()
                const input = e.currentTarget.previousElementSibling as HTMLInputElement
                input?.click()
              }}
            >
              {uploading ? 'Subiendo...' : currentLogoUrl ? 'Cambiar Logo' : 'Subir Logo'}
            </Button>
          </label>

          {currentLogoUrl && (
            <Button 
              variant="danger" 
              onClick={handleDelete}
              disabled={uploading}
            >
              Eliminar Logo
            </Button>
          )}
        </div>

        <p className="text-xs text-[var(--muted)] mt-2">
          Formatos aceptados: PNG, JPG, SVG. Tamaño máximo: 2MB
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
