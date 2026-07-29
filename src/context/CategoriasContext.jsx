import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import {
  getCategoriasFallback,
  keysCategorias,
  mapCategorias,
  nombreCategoria,
} from '../lib/categorias'

export const CategoriasContext = createContext(null)

async function fetchCategorias(soloActivas) {
  let query = supabase
    .from('categorias')
    .select('clave, nombre, activo, orden')
    .order('orden')
    .order('nombre')

  if (soloActivas) {
    query = query.eq('activo', true)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return data ?? []
}

export function CategoriasProvider({ children, soloActivas = true }) {
  const { loading: authLoading, isAuthenticated } = useAuth()
  const [rows, setRows] = useState(getCategoriasFallback())
  const [loading, setLoading] = useState(true)
  const fromDbRef = useRef(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCategorias(soloActivas)
      if (data.length) {
        setRows(data)
        fromDbRef.current = true
      } else if (!fromDbRef.current) {
        setRows(getCategoriasFallback())
      }
    } catch {
      if (!fromDbRef.current) {
        setRows(getCategoriasFallback())
      }
    } finally {
      setLoading(false)
    }
  }, [soloActivas])

  // Esperar sesión: sin JWT la RLS bloquea y se usaba el fallback de 3 categorías.
  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      setRows(getCategoriasFallback())
      fromDbRef.current = false
      setLoading(false)
      return
    }

    cargar()
  }, [authLoading, isAuthenticated, cargar])

  const categoriaMap = useMemo(() => mapCategorias(rows), [rows])
  const categoriaKeys = useMemo(() => keysCategorias(rows), [rows])

  const value = useMemo(
    () => ({
      categorias: rows,
      categoriaMap,
      categoriaKeys,
      loading: authLoading || loading,
      refreshCategorias: cargar,
      getNombreCategoria: (clave) => nombreCategoria(clave, categoriaMap),
    }),
    [rows, categoriaMap, categoriaKeys, authLoading, loading, cargar],
  )

  return <CategoriasContext.Provider value={value}>{children}</CategoriasContext.Provider>
}

export function useCategoriasContext() {
  const ctx = useContext(CategoriasContext)
  if (!ctx) {
    throw new Error('useCategorias debe usarse dentro de CategoriasProvider')
  }
  return ctx
}
