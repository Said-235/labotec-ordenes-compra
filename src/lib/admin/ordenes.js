import { callAdmin } from '../adminApi'

export async function obtenerTodasOrdenes(filters) {
  return callAdmin('ordenes.list', filters ?? {})
}

export async function validarComprobante(comprobanteId, notasAdmin = '') {
  return callAdmin('ordenes.validarComprobante', { comprobanteId, notasAdmin })
}

export async function rechazarComprobante(comprobanteId, motivoRechazo) {
  return callAdmin('ordenes.rechazarComprobante', { comprobanteId, motivoRechazo })
}

export async function getComprobanteAdminUrl(path) {
  return callAdmin('ordenes.comprobanteUrl', { path })
}

export async function getOrdenPdfAdminUrl(clienteId, ordenId, categoria) {
  return callAdmin('ordenes.pdfUrl', { clienteId, ordenId, categoria })
}
