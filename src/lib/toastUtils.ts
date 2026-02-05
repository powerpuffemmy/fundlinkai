import toast from 'react-hot-toast'

// Configuración de estilos para dark mode
const toastStyles = {
  style: {
    background: '#1a1a2e',
    color: '#fff',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  success: {
    iconTheme: {
      primary: '#10b981',
      secondary: '#1a1a2e',
    },
  },
  error: {
    iconTheme: {
      primary: '#ef4444',
      secondary: '#1a1a2e',
    },
  },
}

// Toast de éxito
export const toastSuccess = (message: string, duration: number = 3000) => {
  return toast.success(message, {
    ...toastStyles,
    duration,
  })
}

// Toast de error
export const toastError = (message: string, duration: number = 4000) => {
  return toast.error(message, {
    ...toastStyles,
    duration,
  })
}

// Toast de loading (con promesa)
export const toastLoading = (message: string) => {
  return toast.loading(message, toastStyles)
}

// Toast personalizado
export const toastCustom = (message: string, icon?: string, duration: number = 3000) => {
  return toast(message, {
    ...toastStyles,
    icon: icon || '📢',
    duration,
  })
}

// Toast de promesa (para operaciones async)
export const toastPromise = <T,>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string
    error: string
  }
) => {
  return toast.promise(
    promise,
    {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    },
    toastStyles
  )
}

// Dismiss un toast específico
export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId)
}

// Dismiss todos los toasts
export const dismissAllToasts = () => {
  toast.dismiss()
}
