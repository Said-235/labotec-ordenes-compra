import { assertAdminSession, getSupabaseAdmin } from '../adminContext.js'
import { slugifyCategoria } from '../../lib/categorias.js'
import { sanitizeText } from '../../lib/validation.js'

function validateNombre(nombre) {
  const clean = sanitizeText(nombre, 100)
  if (!clean) throw new Error('El nombre de la categoría es requerido')
  return clean
}

export async function listarCategorias() {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('categorias')
    .select('clave, nombre, activo, orden, creado_en')
    .order('orden')
    .order('nombre')

  if (error) throw new Error('No se pudieron cargar las categorías')
  return data ?? []
}

export async function crearCategoria({ nombre, clave: claveInput }) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const nombreLimpio = validateNombre(nombre)
  const clave = slugifyCategoria(claveInput || nombreLimpio)

  if (!clave) {
    throw new Error('No se pudo generar una clave válida para la categoría')
  }

  const { data: existente } = await admin
    .from('categorias')
    .select('clave')
    .eq('clave', clave)
    .maybeSingle()

  if (existente) {
    throw new Error('Ya existe una categoría con esa clave')
  }

  const { data: maxOrdenRow } = await admin
    .from('categorias')
    .select('orden')
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()

  const orden = Number(maxOrdenRow?.orden ?? 0) + 1

  const { data, error } = await admin
    .from('categorias')
    .insert({
      clave,
      nombre: nombreLimpio,
      activo: true,
      orden,
    })
    .select('clave, nombre, activo, orden, creado_en')
    .single()

  if (error) {
    throw new Error('No se pudo crear la categoría. Verifique que ejecutó la migración SQL en Supabase.')
  }

  return data
}

function esCategoriaActiva(valor) {
  if (valor === true || valor === 1) return true
  if (valor === false || valor === 0 || valor == null) return false
  const s = String(valor).trim().toLowerCase()
  if (s === 'true' || s === 't' || s === '1') return true
  if (s === 'false' || s === 'f' || s === '0' || s === '') return false
  return Boolean(valor)
}

export async function actualizarEstadoCategoria(clave, activo) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()
  const claveLimpia = sanitizeText(clave, 50)
  if (!claveLimpia) throw new Error('Categoría inválida')

  const quiereActiva = esCategoriaActiva(activo)

  const { data: actual, error: lookupError } = await admin
    .from('categorias')
    .select('clave, activo')
    .eq('clave', claveLimpia)
    .maybeSingle()

  if (lookupError || !actual) throw new Error('Categoría inválida')

  if (esCategoriaActiva(actual.activo) === quiereActiva) {
    return { ...actual, activo: quiereActiva }
  }

  if (!quiereActiva) {
    const { count, error: countError } = await admin
      .from('productos')
      .select('id', { count: 'exact', head: true })
      .eq('categoria', claveLimpia)
      .eq('activo', true)

    if (countError) throw new Error('No se pudo verificar productos de la categoría')
    if ((count ?? 0) > 0) {
      throw new Error('No se puede desactivar: hay productos activos en esta categoría')
    }
  }

  const { data: updated, error } = await admin
    .from('categorias')
    .update({ activo: quiereActiva })
    .eq('clave', claveLimpia)
    .select('clave, nombre, activo, orden, creado_en')
    .maybeSingle()

  if (error) {
    console.error('[actualizarEstadoCategoria]', error.message, error.code, error.details)
    throw new Error('No se pudo actualizar la categoría')
  }

  if (!updated || esCategoriaActiva(updated.activo) !== quiereActiva) {
    throw new Error(
      'No se pudo actualizar la categoría: la base de datos rechaza el cambio de estado.',
    )
  }

  return { ...updated, activo: esCategoriaActiva(updated.activo) }
}

export async function obtenerClavesCategoriasActivas() {
  const rows = await listarCategorias()
  return rows.filter((row) => row.activo).map((row) => row.clave)
}
