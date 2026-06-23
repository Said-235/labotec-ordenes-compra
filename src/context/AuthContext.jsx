import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getSafeErrorMessage } from '../lib/errors'

export const AuthContext = createContext(null)

async function fetchClienteProfile(userId) {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, email, es_admin, nivel, primer_login, datos_fiscales, activo')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadProfile = useCallback(async (userId) => {
    const profile = await fetchClienteProfile(userId)

    if (!profile.activo) {
      await supabase.auth.signOut()
      throw new Error('Cuenta desactivada')
    }

    setCliente(profile)
    return profile
  }, [])

  const refreshProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setCliente(null)
      return null
    }

    return loadProfile(user.id)
  }, [loadProfile])

  useEffect(() => {
    let mounted = true

    async function initSession() {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession()

        if (!mounted) return

        setSession(currentSession)

        if (currentSession?.user) {
          await loadProfile(currentSession.user.id)
        }
      } catch (err) {
        if (mounted) {
          setError(getSafeErrorMessage(err))
          setCliente(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      setError(null)

      if (newSession?.user) {
        try {
          await loadProfile(newSession.user.id)
        } catch (err) {
          setError(getSafeErrorMessage(err))
          setCliente(null)
        }
      } else {
        setCliente(null)
      }

      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email, password) => {
    setError(null)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) throw signInError

    const profile = await loadProfile(data.user.id)
    return profile
  }, [loadProfile])

  const signOut = useCallback(async () => {
    setError(null)
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) throw signOutError
    setCliente(null)
    setSession(null)
  }, [])

  const completeDatosFiscales = useCallback(async (datosFiscales) => {
    if (!session?.user) throw new Error('Sesión no válida')

    const { error: updateError } = await supabase
      .from('clientes')
      .update({
        datos_fiscales: datosFiscales,
        primer_login: false,
      })
      .eq('id', session.user.id)

    if (updateError) throw updateError

    await refreshProfile()
  }, [session, refreshProfile])

  const value = useMemo(
    () => ({
      session,
      cliente,
      loading,
      error,
      isAuthenticated: Boolean(session?.user && cliente),
      isAdmin: Boolean(cliente?.es_admin),
      needsDatosFiscales: Boolean(
        cliente && !cliente.es_admin && cliente.primer_login,
      ),
      signIn,
      signOut,
      refreshProfile,
      completeDatosFiscales,
    }),
    [
      session,
      cliente,
      loading,
      error,
      signIn,
      signOut,
      refreshProfile,
      completeDatosFiscales,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
