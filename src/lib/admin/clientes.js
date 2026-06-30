import { assertAdminSession, getSupabaseAdmin } from '../supabaseAdmin'
import { isValidEmail, sanitizeText } from '../validation'
import {
  ERRORES_ADMIN_PRINCIPAL,
} from './adminPrincipal'

function validateNivel(nivel) {
  const n = Number(nivel)
  if (![1, 2, 3].includes(n)) throw new Error('Nivel inválido')
  return n
}

function validatePassword(password) {
  const pwd = String(password ?? '')
  if (pwd.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres')
  return pwd
}

/**
 * Lista clientes (excluye admins del listado editable).
 */
export async function listarClientes() {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('clientes')
    .select('id, nombre, email, nivel, primer_login, activo, creado_en, datos_fiscales')
    .eq('es_admin', false)
    .order('nombre')

  if (error) throw new Error('No se pudieron cargar los clientes')
  return data ?? []
}

/**
 * Crea usuario en Auth + fila en clientes.
 */
export async function crearCliente({ nombre, email, password, nivel }) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const cleanNombre = sanitizeText(nombre, 200)
  const cleanEmail = sanitizeText(email, 254).toLowerCase()
  const cleanPassword = validatePassword(password)
  const cleanNivel = validateNivel(nivel)

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
    nivel: cleanNivel,
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
 * Actualiza nombre y/o nivel del cliente.
 */
export async function actualizarCliente(clienteId, { nombre, nivel }) {
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

  if (nivel != null) {
    updates.nivel = validateNivel(nivel)
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
 * Desactiva cliente (soft delete — nunca borrar físicamente).
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

/**
 * Obtiene porcentajes de descuento por nivel.
 */
export async function obtenerDescuentosNivel() {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('descuentos_nivel')
    .select('id, nivel, porcentaje_descuento')
    .order('nivel')

  if (error) throw new Error('No se pudieron cargar los descuentos')
  return data ?? []
}

/**
 * Actualiza porcentaje de descuento de un nivel.
 */
export async function actualizarDescuentoNivel(nivel, porcentaje) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const cleanNivel = validateNivel(nivel)
  const pct = Number(porcentaje)

  if (!Number.isFinite(pct) || pct < 0 || pct >= 100) {
    throw new Error('Porcentaje inválido (0–99.99)')
  }

  const { error } = await admin
    .from('descuentos_nivel')
    .update({ porcentaje_descuento: Math.round(pct * 100) / 100 })
    .eq('nivel', cleanNivel)

  if (error) throw new Error('No se pudo actualizar el descuento')
}
