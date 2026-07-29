import { CLASES_PRODUCTO } from '../../lib/constants.js'
import {
  aumentosPorClaseVacios,
  normalizarAumentosPorClase,
  sanitizePorcentaje,
} from '../../lib/pricing.js'
import { assertAdminSession, getSupabaseAdmin } from '../adminContext.js'
import { isValidEmail, sanitizeText } from '../../lib/validation.js'
import {
  ERRORES_ADMIN_PRINCIPAL,
} from './adminPrincipal.js'

function validatePorcentajeAumento(porcentaje) {
  const pct = Number(porcentaje)
  if (!Number.isFinite(pct) || pct < 0 || pct > 999.99) {
    throw new Error('Porcentaje inválido (0–999.99)')
  }
  return Math.round(pct * 100) / 100
}

function validateAumentosPorClase(raw) {
  const map = { ...aumentosPorClaseVacios() }

  if (raw == null) return map

  if (typeof raw === 'number' || typeof raw === 'string') {
    const pct = validatePorcentajeAumento(raw)
    return Object.fromEntries(CLASES_PRODUCTO.map((clase) => [clase, pct]))
  }

  if (typeof raw !== 'object') {
    throw new Error('Aumentos por clase inválidos')
  }

  for (const clase of CLASES_PRODUCTO) {
    if (raw[clase] != null && raw[clase] !== '') {
      map[clase] = validatePorcentajeAumento(raw[clase])
    }
  }

  return map
}

/**
 * Lista clientes (excluye admins del listado editable).
 */
export async function listarClientes() {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const [{ data, error }, { data: pendientes, error: pendientesError }] = await Promise.all([
    admin
      .from('clientes')
      .select(
        'id, nombre, email, porcentaje_aumento, aumentos_por_clase, primer_login, activo, creado_en, datos_fiscales',
      )
      .eq('es_admin', false)
      .order('nombre'),
    admin.from('ordenes').select('cliente_id').eq('status', 'pendiente'),
  ])

  if (error) throw new Error('No se pudieron cargar los clientes')
  if (pendientesError) throw new Error('No se pudieron verificar las órdenes pendientes')

  const conPendientes = new Set((pendientes ?? []).map((o) => o.cliente_id))

  return (data ?? []).map((c) => ({
    ...c,
    aumentos_por_clase: normalizarAumentosPorClase(c),
    tiene_ordenes_pendientes: conPendientes.has(c.id),
  }))
}

/**
 * Crea usuario en Auth + fila en clientes.
 */
export async function crearCliente({
  nombre,
  email,
  password,
  aumentos_por_clase,
  porcentaje_aumento,
}) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const cleanNombre = sanitizeText(nombre, 200)
  const cleanEmail = sanitizeText(email, 254).toLowerCase()
  const cleanPassword = validatePassword(password)
  const cleanAumentos = validateAumentosPorClase(
    aumentos_por_clase ?? porcentaje_aumento ?? 0,
  )
  const cleanAumentoLegado = sanitizePorcentaje(cleanAumentos.Reactivo)

  if (!cleanNombre) throw new Error('El nombre es requerido')
  if (!isValidEmail(cleanEmail)) throw new Error('Formato de correo inválido')

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: cleanPassword,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message?.includes('already been registered')) {
      throw new Error('Ese correo ya está registrado')
    }
    throw new Error('No se pudo crear el usuario')
  }

  const { error: insertError } = await admin.from('clientes').insert({
    id: authData.user.id,
    nombre: cleanNombre,
    email: cleanEmail,
    es_admin: false,
    nivel: 1,
    porcentaje_aumento: cleanAumentoLegado,
    aumentos_por_clase: cleanAumentos,
    primer_login: true,
    activo: true,
  })

  if (insertError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    throw new Error('No se pudo registrar el perfil del cliente')
  }

  return { id: authData.user.id }
}

/**
 * Actualiza nombre y/o aumentos de precio del cliente.
 */
export async function actualizarCliente(
  clienteId,
  { nombre, aumentos_por_clase, porcentaje_aumento },
) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data: perfil, error: lookupError } = await admin
    .from('clientes')
    .select('id, es_admin')
    .eq('id', clienteId)
    .single()

  if (lookupError || !perfil) {
    throw new Error('Cliente no encontrado')
  }

  if (perfil.es_admin) {
    throw new Error(ERRORES_ADMIN_PRINCIPAL.esAdmin)
  }

  const updates = {}

  if (nombre != null) {
    const cleanNombre = sanitizeText(nombre, 200)
    if (!cleanNombre) throw new Error('El nombre es requerido')
    updates.nombre = cleanNombre
  }

  if (aumentos_por_clase != null) {
    const cleanAumentos = validateAumentosPorClase(aumentos_por_clase)
    updates.aumentos_por_clase = cleanAumentos
    updates.porcentaje_aumento = sanitizePorcentaje(cleanAumentos.Reactivo)
  } else if (porcentaje_aumento != null) {
    // Compat: un solo % se replica a todas las clases
    const cleanAumentos = validateAumentosPorClase(porcentaje_aumento)
    updates.aumentos_por_clase = cleanAumentos
    updates.porcentaje_aumento = sanitizePorcentaje(cleanAumentos.Reactivo)
  }

  if (!Object.keys(updates).length) {
    throw new Error('No hay cambios para guardar')
  }

  const { error } = await admin
    .from('clientes')
    .update(updates)
    .eq('id', clienteId)
    .eq('es_admin', false)

  if (error) throw new Error('No se pudo actualizar el cliente')
}

/**
 * Elimina cliente de forma permanente (Auth + perfil).
 * Solo si no tiene órdenes: el historial no debe romperse.
 */
export async function eliminarCliente(clienteId) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data: perfil, error: lookupError } = await admin
    .from('clientes')
    .select('id, es_admin, email, nombre')
    .eq('id', clienteId)
    .single()

  if (lookupError || !perfil) {
    throw new Error('Cliente no encontrado')
  }

  if (perfil.es_admin) {
    throw new Error(ERRORES_ADMIN_PRINCIPAL.esAdmin)
  }

  const { count: ordenesCount, error: ordenesError } = await admin
    .from('ordenes')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)

  if (ordenesError) {
    throw new Error('No se pudo verificar el historial de órdenes')
  }

  if ((ordenesCount ?? 0) > 0) {
    throw new Error(
      'No se puede eliminar: el cliente tiene órdenes registradas. Desactívelo en su lugar.',
    )
  }

  // Notificaciones huérfanas (sin órdenes asociadas, por si existieran)
  await admin.from('notificaciones').delete().eq('cliente_id', clienteId)

  const { error: deletePerfilError } = await admin
    .from('clientes')
    .delete()
    .eq('id', clienteId)
    .eq('es_admin', false)

  if (deletePerfilError) {
    throw new Error('No se pudo eliminar el perfil del cliente')
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(clienteId)
  if (deleteAuthError) {
    throw new Error(
      'Se eliminó el perfil, pero no la cuenta de acceso. Intente de nuevo o contacte soporte.',
    )
  }

  return { id: clienteId, email: perfil.email, nombre: perfil.nombre }
}

/**
 * Desactiva cliente (soft delete — conserva historial de órdenes).
 */
export async function desactivarCliente(clienteId) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data: perfil, error: lookupError } = await admin
    .from('clientes')
    .select('id, es_admin')
    .eq('id', clienteId)
    .single()

  if (lookupError || !perfil) {
    throw new Error('Cliente no encontrado')
  }

  if (perfil.es_admin) {
    throw new Error(ERRORES_ADMIN_PRINCIPAL.esAdmin)
  }

  const { error } = await admin
    .from('clientes')
    .update({ activo: false })
    .eq('id', clienteId)
    .eq('es_admin', false)

  if (error) throw new Error('No se pudo desactivar el cliente')
}

/**
 * Reactiva un cliente desactivado.
 */
export async function reactivarCliente(clienteId) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data: perfil, error: lookupError } = await admin
    .from('clientes')
    .select('id, es_admin')
    .eq('id', clienteId)
    .single()

  if (lookupError || !perfil) {
    throw new Error('Cliente no encontrado')
  }

  if (perfil.es_admin) {
    throw new Error(ERRORES_ADMIN_PRINCIPAL.esAdmin)
  }

  const { error } = await admin
    .from('clientes')
    .update({ activo: true })
    .eq('id', clienteId)
    .eq('es_admin', false)

  if (error) throw new Error('No se pudo reactivar el cliente')
}

/**
 * Restablece contraseña de un cliente.
 */
export async function restablecerPasswordCliente(clienteId, password) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data: perfil, error: lookupError } = await admin
    .from('clientes')
    .select('id, es_admin')
    .eq('id', clienteId)
    .single()

  if (lookupError || !perfil) {
    throw new Error('Cliente no encontrado')
  }

  if (perfil.es_admin) {
    throw new Error(ERRORES_ADMIN_PRINCIPAL.esAdmin)
  }

  const cleanPassword = validatePassword(password)

  const { error } = await admin.auth.admin.updateUserById(clienteId, {
    password: cleanPassword,
  })

  if (error) throw new Error('No se pudo restablecer la contraseña')
}

function validatePassword(password) {
  const pwd = String(password ?? '')
  if (pwd.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres')
  return pwd
}
