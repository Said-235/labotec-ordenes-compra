import { CATEGORIAS as CATEGORIAS_DEFAULT } from './constants'
import { sanitizeText } from './validation'

export function slugifyCategoria(nombre) {
  return sanitizeText(nombre, 80)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
}

export function mapCategorias(rows = []) {
  const map = {}
  for (const row of rows) {
    if (!row?.clave) continue
    map[row.clave] = row.nombre
  }
  return map
}

export function keysCategorias(rows = []) {
  return [...rows]
    .filter((row) => row?.clave && row.activo !== false)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre))
    .map((row) => row.clave)
}

export function getCategoriasFallback() {
  return Object.entries(CATEGORIAS_DEFAULT).map(([clave, nombre], index) => ({
    clave,
    nombre,
    activo: true,
    orden: index + 1,
  }))
}

export function nombreCategoria(clave, map = CATEGORIAS_DEFAULT) {
  return map[clave] ?? CATEGORIAS_DEFAULT[clave] ?? clave
}

export function esCategoriaValida(clave, keys) {
  return keys.includes(clave)
}

export async function fetchCategoriasDesdeBd(client, { soloActivas = true } = {}) {
  let query = client
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
