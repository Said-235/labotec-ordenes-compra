import { assertAdminSession, getSupabaseAdmin } from '../supabaseAdmin'
import { CATEGORIA_KEYS, CLASES_PRODUCTO } from '../constants'
import { sanitizeText } from '../validation'

function validateProductoInput(data, { isUpdate = false } = {}) {
  const codigo = sanitizeText(data.codigo, 50)
  const descripcion = sanitizeText(data.descripcion, 500)
  const clase = sanitizeText(data.clase, 50)
  const categoria = sanitizeText(data.categoria, 50)
  const precioBase = Number(data.precio_base)

  if (!isUpdate && !codigo) throw new Error('El código es requerido')
  if (data.descripcion != null && !descripcion) throw new Error('La descripción es requerida')
  if (data.clase != null && !CLASES_PRODUCTO.includes(clase)) throw new Error('Clase inválida')
  if (data.categoria != null && !CATEGORIA_KEYS.includes(categoria)) {
    throw new Error('Categoría inválida')
  }
  if (data.precio_base != null && (!Number.isFinite(precioBase) || precioBase < 0)) {
    throw new Error('Precio base inválido')
  }

  return {
    codigo: codigo || undefined,
    descripcion: descripcion || undefined,
    clase: clase || undefined,
    categoria: categoria || undefined,
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
    .select('id, codigo, descripcion, clase, categoria, precio_base, activo, creado_en, actualizado_en')
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

  const clean = validateProductoInput(data)

  const { data: producto, error } = await admin
    .from('productos')
    .insert({
      codigo: clean.codigo,
      descripcion: clean.descripcion,
      clase: clean.clase,
      categoria: clean.categoria,
      precio_base: clean.precio_base,
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

  const clean = validateProductoInput(data, { isUpdate: true })
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
