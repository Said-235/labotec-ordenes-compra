/**
 * Reglas de protección del administrador principal (cuenta raíz).
 */

export const ERRORES_ADMIN_PRINCIPAL = {
  password:
    'No puede modificar la contraseña del administrador principal',
  desactivar:
    'No se puede desactivar al administrador principal',
  editar:
    'No puede modificar los datos del administrador principal',
  esAdmin:
    'Use la sección Administradores para cuentas de administración',
}

export async function obtenerIdAdminPrincipal(admin) {
  const { data: marcado, error: marcadoError } = await admin
    .from('clientes')
    .select('id')
    .eq('es_admin', true)
    .eq('admin_principal', true)
    .maybeSingle()

  if (!marcadoError && marcado?.id) {
    return marcado.id
  }

  const { data: masAntiguo, error: antiguoError } = await admin
    .from('clientes')
    .select('id')
    .eq('es_admin', true)
    .order('creado_en', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (antiguoError) {
    throw new Error('No se pudo verificar el administrador principal')
  }

  return masAntiguo?.id ?? null
}

export function esAdminPrincipal(adminId, adminPrincipalId) {
  return Boolean(adminPrincipalId && adminId === adminPrincipalId)
}

export function assertPuedeRestablecerPasswordAdmin(
  adminActualId,
  adminObjetivoId,
  adminPrincipalId,
) {
  if (!esAdminPrincipal(adminObjetivoId, adminPrincipalId)) return
  if (adminActualId === adminPrincipalId) return
  throw new Error(ERRORES_ADMIN_PRINCIPAL.password)
}

export function assertPuedeDesactivarAdmin(adminObjetivoId, adminPrincipalId) {
  if (esAdminPrincipal(adminObjetivoId, adminPrincipalId)) {
    throw new Error(ERRORES_ADMIN_PRINCIPAL.desactivar)
  }
}

export function assertPuedeEditarAdmin(
  adminActualId,
  adminObjetivoId,
  adminPrincipalId,
) {
  if (!esAdminPrincipal(adminObjetivoId, adminPrincipalId)) return
  if (adminActualId === adminPrincipalId) return
  throw new Error(ERRORES_ADMIN_PRINCIPAL.editar)
}

/** Helpers para la UI (la validación real está en el backend). */
export function puedeRestablecerPasswordAdmin(actorId, admin) {
  if (admin.admin_principal && actorId !== admin.id) return false
  return true
}

export function puedeDesactivarAdmin(admin) {
  return !admin.admin_principal
}

export function puedeEditarNombreAdmin(actorId, admin) {
  if (admin.admin_principal && actorId !== admin.id) return false
  return true
}
