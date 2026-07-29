import { callAdmin } from '../adminApi'

export async function listarClientes() {
  return callAdmin('clientes.list')
}

export async function crearCliente(data) {
  return callAdmin('clientes.create', data)
}

export async function actualizarCliente(clienteId, data) {
  return callAdmin('clientes.update', { clienteId, ...data })
}

export async function desactivarCliente(clienteId) {
  return callAdmin('clientes.deactivate', { clienteId })
}

export async function eliminarCliente(clienteId) {
  return callAdmin('clientes.delete', { clienteId })
}

export async function reactivarCliente(clienteId) {
  return callAdmin('clientes.reactivate', { clienteId })
}

export async function restablecerPasswordCliente(clienteId, password) {
  return callAdmin('clientes.resetPassword', { clienteId, password })
}
