import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  contarNotificacionesNoLeidas,
  marcarTodasNotificacionesLeidas,
} from '../lib/notificaciones'

export const NotificacionesContext = createContext(null)

export function NotificacionesProvider({ children }) {
  const { session, isAdmin } = useAuth()
  const userId = session?.user?.id
  const [noLeidas, setNoLeidas] = useState(0)

  const refresh = useCallback(async () => {
    if (!userId || isAdmin) {
      setNoLeidas(0)
      return
    }

    try {
      const total = await contarNotificacionesNoLeidas()
      setNoLeidas(total)
    } catch {
      setNoLeidas(0)
    }
  }, [userId, isAdmin])

  const marcarTodasLeidas = useCallback(async () => {
    if (!userId || isAdmin) return

    try {
      await marcarTodasNotificacionesLeidas()
      setNoLeidas(0)
    } catch {
      await refresh()
    }
  }, [userId, isAdmin, refresh])

  useEffect(() => {
    refresh()
    if (!userId || isAdmin) return undefined

    const timer = setInterval(refresh, 60_000)
    return () => clearInterval(timer)
  }, [refresh, userId, isAdmin])

  const value = useMemo(
    () => ({ noLeidas, refresh, marcarTodasLeidas }),
    [noLeidas, refresh, marcarTodasLeidas],
  )

  return (
    <NotificacionesContext.Provider value={value}>
      {children}
    </NotificacionesContext.Provider>
  )
}

export function useNotificacionesContext() {
  const ctx = useContext(NotificacionesContext)
  if (!ctx) {
    throw new Error('useNotificacionesContext debe usarse dentro de NotificacionesProvider')
  }
  return ctx
}
