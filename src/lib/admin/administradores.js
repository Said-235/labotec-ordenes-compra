import { assertAdminSession, getSupabaseAdmin } from '../supabaseAdmin'
import { isValidEmail, sanitizeText } from '../validation'
import {
  assertPuedeDesactivarAdmin,
  assertPuedeEditarAdmin,
  assertPuedeRestablecerPasswordAdmin,
  obtenerIdAdminPrincipal,
} from './adminPrincipal'

function validatePassword(password) {
  const pwd = String(password ?? '')
  if (pwd.length < 12) {
    throw new Error('La contraseña debe tener al menos 12 caracteres')
  }
  if (!/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/\d/.test(pwd)) {
    throw new Error('La contraseña debe incluir mayúsculas, minúsculas y números')
  }
  return pwd
}

/**
 * Lista administradores del sistema.
 */
export async function listarAdministradores() {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('clientes')
    .select('id, nombre, email, activo, creado_en, admin_principal')
    .eq('es_admin', true)
    .order('admin_principal', { ascending: false })
    .order('nombre')

  if (error) throw new Error('No se pudieron cargar los administradores')
  return data ?? []
}

/**
 * Crea un nuevo administrador (Auth + clientes con es_admin=true).
 */
export async function crearAdministrador({ nombre, email, password }) {
  const { user: adminActual } = await assertAdminSession()
  const admin = getSupabaseAdmin()

  const cleanNombre = sanitizeText(nombre, 200)
  const cleanEmail = sanitizeText(email, 254).toLowerCase()
  const cleanPassword = validatePassword(password)

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
    throw new Error('No se pudo crear el administrador')
  }

  const { error: insertError } = await admin.from('clientes').insert({
    id: authData.user.id,
    nombre: cleanNombre,
    email: cleanEmail,
    es_admin: true,
    admin_principal: false,
    nivel: 1,
    primer_login: false,
    activo: true,
  })

  if (insertError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    throw new Error('No se pudo registrar el perfil del administrador')
  }

  return { id: authData.user.id, creadoPor: adminActual.id }
}

/**
 * Desactiva un administrador (no puede desactivarse a sí mismo ni al principal).
 */
export async function desactivarAdministrador(adminId, adminActualId) {
  await assertAdminSession()

  if (adminId === adminActualId) {
    throw new Error('No puede desactivar su propia cuenta')
  }

  const admin = getSupabaseAdmin()
  const adminPrincipalId = await obtenerIdAdminPrincipal(admin)
  assertPuedeDesactivarAdmin(adminId, adminPrincipalId)

  const { data: activos, error: countError } = await admin
    .from('clientes')
    .select('id')
    .eq('es_admin', true)
    .eq('activo', true)

  if (countError) throw new Error('No se pudo verificar administradores activos')

  if ((activos?.length ?? 0) <= 1) {
    throw new Error('Debe haber al menos un administrador activo')
  }

  const { error } = await admin
    .from('clientes')
    .update({ activo: false })
    .eq('id', adminId)
    .eq('es_admin', true)
    .eq('admin_principal', false)

  if (error) throw new Error('No se pudo desactivar el administrador')
}

/**
 * Reactiva un administrador desactivado (excepto el principal, que no puede desactivarse).
 */
export async function reactivarAdministrador(adminId) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { error } = await admin
    .from('clientes')
    .update({ activo: true })
    .eq('id', adminId)
    .eq('es_admin', true)

  if (error) throw new Error('No se pudo reactivar el administrador')
}

/**
 * Restablece contraseña de un administrador.
 */
export async function restablecerPasswordAdministrador(adminId, password) {
  const { user: adminActual } = await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data: perfil } = await admin
    .from('clientes')
    .select('id')
    .eq('id', adminId)
    .eq('es_admin', true)
    .single()

  if (!perfil) throw new Error('Administrador no encontrado')

  const adminPrincipalId = await obtenerIdAdminPrincipal(admin)
  assertPuedeRestablecerPasswordAdmin(adminActual.id, adminId, adminPrincipalId)

  const cleanPassword = validatePassword(password)

  const { error } = await admin.auth.admin.updateUserById(adminId, {
    password: cleanPassword,
  })

  if (error) throw new Error('No se pudo restablecer la contraseña')
}

/**
 * Actualiza nombre de un administrador.
 */
export async function actualizarAdministrador(adminId, { nombre }) {
  const { user: adminActual } = await assertAdminSession()
  const admin = getSupabaseAdmin()

  const adminPrincipalId = await obtenerIdAdminPrincipal(admin)
  assertPuedeEditarAdmin(adminActual.id, adminId, adminPrincipalId)

  const cleanNombre = sanitizeText(nombre, 200)
  if (!cleanNombre) throw new Error('El nombre es requerido')

  const { error } = await admin
    .from('clientes')
    .update({ nombre: cleanNombre })
    .eq('id', adminId)
    .eq('es_admin', true)

  if (error) throw new Error('No se pudo actualizar el administrador')
}
