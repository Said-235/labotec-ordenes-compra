import { callAdmin } from '../adminApi'

export {
  ERRORES_ADMIN_PRINCIPAL,
  puedeRestablecerPasswordAdmin,
  puedeDesactivarAdmin,
  puedeEditarNombreAdmin,
} from './adminPrincipal'

export async function listarAdministradores() {
  return callAdmin('administradores.list')
}

export async function crearAdministrador(data) {
  return callAdmin('administradores.create', data)
}

export async function desactivarAdministrador(adminId, adminActualId) {
  return callAdmin('administradores.deactivate', { adminId, adminActualId })
}

export async function reactivarAdministrador(adminId) {
  return callAdmin('administradores.reactivate', { adminId })
}

export async function restablecerPasswordAdministrador(adminId, password) {
  return callAdmin('administradores.resetPassword', { adminId, password })
}

export async function actualizarAdministrador(adminId, data) {
  return callAdmin('administradores.update', { adminId, ...data })
}
