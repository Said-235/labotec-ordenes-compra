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

export async function actualizarEstadoCategoria(clave, activo) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  if (!activo) {
    const { count, error: countError } = await admin
      .from('productos')
      .select('id', { count: 'exact', head: true })
      .eq('categoria', clave)
      .eq('activo', true)

    if (countError) throw new Error('No se pudo verificar productos de la categoría')
    if ((count ?? 0) > 0) {
      throw new Error('No se puede desactivar: hay productos activos en esta categoría')
    }
  }

  const { error } = await admin.from('categorias').update({ activo }).eq('clave', clave)

  if (error) throw new Error('No se pudo actualizar la categoría')
}

export async function obtenerClavesCategoriasActivas() {
  const rows = await listarCategorias()
  return rows.filter((row) => row.activo).map((row) => row.clave)
}
