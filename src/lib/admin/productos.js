import { assertAdminSession, getSupabaseAdmin } from '../supabaseAdmin'
import { CLASES_PRODUCTO } from '../constants'
import { obtenerClavesCategoriasActivas } from './categorias'
import { CLASES_REQUIEREN_REACTIVO } from '../cartValidation'
import { sanitizeText } from '../validation'

function validateProductoInput(data, categoriaKeys, { isUpdate = false } = {}) {
  const codigo = sanitizeText(data.codigo, 50)
  const descripcion = sanitizeText(data.descripcion, 500)
  const clase = sanitizeText(data.clase, 50)
  const categoria = sanitizeText(data.categoria, 50)
  const grupoPrueba = data.grupo_prueba != null ? sanitizeText(data.grupo_prueba, 100) : undefined
  const precioBase = Number(data.precio_base)

  if (!isUpdate && !codigo) throw new Error('El código es requerido')
  if (data.descripcion != null && !descripcion) throw new Error('La descripción es requerida')
  if (data.clase != null && !CLASES_PRODUCTO.includes(clase)) throw new Error('Clase inválida')
  if (data.categoria != null && !categoriaKeys.includes(categoria)) {
    throw new Error('Categoría inválida')
  }
  if (data.precio_base != null && (!Number.isFinite(precioBase) || precioBase < 0)) {
    throw new Error('Precio base inválido')
  }

  const claseFinal = clase || data.clase
  if (CLASES_REQUIEREN_REACTIVO.includes(claseFinal) && data.grupo_prueba !== undefined && !grupoPrueba) {
    throw new Error('Calibrador y Control requieren un grupo de prueba')
  }
  if (!isUpdate && CLASES_REQUIEREN_REACTIVO.includes(claseFinal) && !grupoPrueba) {
    throw new Error('Calibrador y Control requieren un grupo de prueba')
  }

  return {
    codigo: codigo || undefined,
    descripcion: descripcion || undefined,
    clase: clase || undefined,
    categoria: categoria || undefined,
    grupo_prueba: data.grupo_prueba !== undefined ? (grupoPrueba || null) : undefined,
    precio_base: data.precio_base != null ? Math.round(precioBase * 100) / 100 : undefined,
  }
}

/**
 * Lista productos (incluye inactivos) con filtros opcionales.
 */
export async function listarProductos({ categoria, soloActivos } = {}) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  let query = admin
    .from('productos')
    .select('id, codigo, descripcion, clase, categoria, precio_base, grupo_prueba, activo, creado_en, actualizado_en')
    .order('categoria')
    .order('codigo')

  if (categoria) query = query.eq('categoria', categoria)
  if (soloActivos) query = query.eq('activo', true)

  const { data, error } = await query
  if (error) throw new Error('No se pudieron cargar los productos')
  return data ?? []
}

/**
 * Crea un producto en el catálogo.
 */
export async function crearProducto(data) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()
  const categoriaKeys = await obtenerClavesCategoriasActivas()

  const clean = validateProductoInput(data, categoriaKeys)

  const { data: producto, error } = await admin
    .from('productos')
    .insert({
      codigo: clean.codigo,
      descripcion: clean.descripcion,
      clase: clean.clase,
      categoria: clean.categoria,
      precio_base: clean.precio_base,
      grupo_prueba: clean.grupo_prueba ?? null,
      activo: true,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ya existe un producto con ese código en la misma categoría')
    }
    throw new Error('No se pudo crear el producto')
  }

  return producto
}

/**
 * Edita un producto existente.
 */
export async function actualizarProducto(productoId, data) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()
  const categoriaKeys = await obtenerClavesCategoriasActivas()

  const clean = validateProductoInput(data, categoriaKeys, { isUpdate: true })
  const updates = Object.fromEntries(
    Object.entries(clean).filter(([, v]) => v !== undefined),
  )

  if (!Object.keys(updates).length) {
    throw new Error('No hay cambios para guardar')
  }

  const { error } = await admin
    .from('productos')
    .update(updates)
    .eq('id', productoId)

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ya existe un producto con ese código en la misma categoría')
    }
    throw new Error('No se pudo actualizar el producto')
  }
}

/**
 * Desactiva producto (nunca borrado físico).
 */
export async function desactivarProducto(productoId) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { error } = await admin
    .from('productos')
    .update({ activo: false })
    .eq('id', productoId)

  if (error) throw new Error('No se pudo desactivar el producto')
}

/**
 * Reactiva un producto desactivado.
 */
export async function reactivarProducto(productoId) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { error } = await admin
    .from('productos')
    .update({ activo: true })
    .eq('id', productoId)

  if (error) throw new Error('No se pudo reactivar el producto')
}
