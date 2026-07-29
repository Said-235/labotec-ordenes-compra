import { callAdmin } from '../adminApi'

export async function listarProductos(filters) {
  return callAdmin('productos.list', filters ?? {})
}

export async function crearProducto(data) {
  return callAdmin('productos.create', data)
}

export async function actualizarProducto(productoId, data) {
  return callAdmin('productos.update', { productoId, data })
}

export async function desactivarProducto(productoId) {
  return callAdmin('productos.deactivate', { productoId })
}

export async function reactivarProducto(productoId) {
  return callAdmin('productos.reactivate', { productoId })
}
