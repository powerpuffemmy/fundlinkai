import React from 'react'
import { Button } from './Button'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'primary' | 'secondary'
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-lg max-w-md w-full p-6 animate-fade-in">
        <h3 className="text-xl font-bold mb-3">{title}</h3>
        <p className="text-[var(--muted)] mb-6">{message}</p>

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={() => {
              onConfirm()
              onCancel() // Cerrar modal después de confirmar
            }}
            className={confirmVariant === 'primary' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Hook para usar el modal de confirmación fácilmente
export const useConfirm = () => {
  const [confirmState, setConfirmState] = React.useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    confirmVariant?: 'primary' | 'secondary'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  const confirm = (options: {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    confirmVariant?: 'primary' | 'secondary'
    onConfirm: () => void
  }) => {
    setConfirmState({
      isOpen: true,
      ...options,
    })
  }

  const handleCancel = () => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }))
  }

  const ConfirmDialog = () => (
    <ConfirmModal
      isOpen={confirmState.isOpen}
      title={confirmState.title}
      message={confirmState.message}
      confirmText={confirmState.confirmText}
      cancelText={confirmState.cancelText}
      confirmVariant={confirmState.confirmVariant}
      onConfirm={confirmState.onConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, ConfirmDialog }
}
