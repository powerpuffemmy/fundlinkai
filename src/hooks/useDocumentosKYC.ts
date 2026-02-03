import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DocumentoKYC, TipoDocumentoKYC } from '@/types/database'
import { useAuthStore } from '@/store/authStore'

export const useDocumentosKYC = (clienteId?: string) => {
  const [documentos, setDocumentos] = useState<DocumentoKYC[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  const fetchDocumentos = async () => {
    try {
      setLoading(true)
      
      const idBuscar = clienteId || user?.id
      if (!idBuscar) return

      const { data, error } = await supabase
        .from('documentos_kyc')
        .select('*')
        .eq('cliente_id', idBuscar)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocumentos(data || [])
    } catch (error) {
      console.error('Error fetching documentos:', error)
    } finally {
      setLoading(false)
    }
  }

  const subirDocumento = async (
    tipo: TipoDocumentoKYC,
    archivo: File,
    descripcion?: string
  ) => {
    try {
      if (!user) throw new Error('Usuario no autenticado')

      // Subir archivo a storage
      const fileExt = archivo.name.split('.').pop()
      const fileName = `${user.id}/${tipo}_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('documentos-kyc')
        .upload(fileName, archivo)

      if (uploadError) throw uploadError

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('documentos-kyc')
        .getPublicUrl(fileName)

      // Guardar registro en BD
      const { error: dbError } = await supabase
        .from('documentos_kyc')
        .insert([{
          cliente_id: user.id,
          tipo_documento: tipo,
          nombre_archivo: archivo.name,
          url_archivo: publicUrl,
          descripcion: descripcion,
          estado: 'pendiente'
        }])

      if (dbError) throw dbError

      await fetchDocumentos()
      return { success: true }
    } catch (error: any) {
      console.error('Error subiendo documento:', error)
      return { success: false, error: error.message }
    }
  }

  const eliminarDocumento = async (documentoId: string) => {
    try {
      const documento = documentos.find(d => d.id === documentoId)
      if (!documento) throw new Error('Documento no encontrado')

      // Solo se puede eliminar si está pendiente
      if (documento.estado !== 'pendiente') {
        throw new Error('Solo se pueden eliminar documentos pendientes')
      }

      // Eliminar de storage
      const fileName = documento.url_archivo.split('/').pop()
      if (fileName) {
        await supabase.storage
          .from('documentos-kyc')
          .remove([`${user?.id}/${fileName}`])
      }

      // Eliminar de BD
      const { error } = await supabase
        .from('documentos_kyc')
        .delete()
        .eq('id', documentoId)

      if (error) throw error

      await fetchDocumentos()
      return { success: true }
    } catch (error: any) {
      console.error('Error eliminando documento:', error)
      return { success: false, error: error.message }
    }
  }

  const actualizarEstadoDocumento = async (
    documentoId: string,
    estado: 'aprobado' | 'rechazado',
    notas?: string
  ) => {
    try {
      if (!user || user.role !== 'webadmin') {
        throw new Error('Solo webadmins pueden aprobar/rechazar documentos')
      }

      const { error } = await supabase
        .from('documentos_kyc')
        .update({
          estado,
          revisado_por: user.id,
          fecha_revision: new Date().toISOString(),
          notas_revision: notas,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentoId)

      if (error) throw error

      await fetchDocumentos()
      return { success: true }
    } catch (error: any) {
      console.error('Error actualizando estado:', error)
      return { success: false, error: error.message }
    }
  }

  useEffect(() => {
    fetchDocumentos()
  }, [clienteId, user?.id])

  return {
    documentos,
    loading,
    subirDocumento,
    eliminarDocumento,
    actualizarEstadoDocumento,
    refetch: fetchDocumentos
  }
}
