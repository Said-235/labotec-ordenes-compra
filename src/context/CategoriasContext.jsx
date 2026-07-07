import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
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

  if (error || !data?.length) {
    return getCategoriasFallback()
  }

  return data
}

export function CategoriasProvider({ children, soloActivas = false }) {
  const [rows, setRows] = useState(getCategoriasFallback())
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCategorias(soloActivas)
      setRows(data)
    } catch {
      setRows(getCategoriasFallback())
    } finally {
      setLoading(false)
    }
  }, [soloActivas])

  useEffect(() => {
    cargar()
  }, [cargar])

  const categoriaMap = useMemo(() => mapCategorias(rows), [rows])
  const categoriaKeys = useMemo(() => keysCategorias(rows), [rows])

  const value = useMemo(
    () => ({
      categorias: rows,
      categoriaMap,
      categoriaKeys,
      loading,
      refreshCategorias: cargar,
      getNombreCategoria: (clave) => nombreCategoria(clave, categoriaMap),
    }),
    [rows, categoriaMap, categoriaKeys, loading, cargar],
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
