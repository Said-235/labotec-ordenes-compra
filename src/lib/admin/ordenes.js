import { callAdmin } from '../adminApi'

export async function obtenerTodasOrdenes(filters) {
  return callAdmin('ordenes.list', filters ?? {})
}

export async function marcarOrdenPagada(ordenId, notasAdmin = '') {
  return callAdmin('ordenes.marcarPagada', { ordenId, notasAdmin })
}

export async function getOrdenPdfAdminUrl(clienteId, ordenId, categoria) {
  return callAdmin('ordenes.pdfUrl', { clienteId, ordenId, categoria })
}
