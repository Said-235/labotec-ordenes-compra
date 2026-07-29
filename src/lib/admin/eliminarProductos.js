import { callAdmin } from '../adminApi'

export async function eliminarProducto(productoId) {
  return callAdmin('productos.delete', { productoId })
}

export async function eliminarProductosLote(productoIds) {
  return callAdmin('productos.deleteBatch', { productoIds })
}

export async function eliminarProductosPorCarga(logCargaId) {
  return callAdmin('cargaOds.eliminar', { logCargaId })
}
