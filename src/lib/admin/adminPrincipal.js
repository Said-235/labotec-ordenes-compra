/**
 * Helpers de UI para administrador principal (sin service role).
 */

export const ERRORES_ADMIN_PRINCIPAL = {
  password: 'No puede modificar la contraseña del administrador principal',
  desactivar: 'No se puede desactivar al administrador principal',
  editar: 'No puede modificar los datos del administrador principal',
  esAdmin: 'Use la sección Administradores para cuentas de administración',
}

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
