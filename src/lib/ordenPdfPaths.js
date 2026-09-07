/**
 * Rutas de PDFs en el bucket `documentos` (sin dependencias de cliente/PDF).
 */

export function getOrdenPdfPath(clienteId, ordenId, categoria) {
  return `${clienteId}/${ordenId}/orden_${categoria}.pdf`
}

export function getOrdenGeneralPdfPath(ordenGeneralId) {
  return `ordenes-generales/${ordenGeneralId}/orden_general.pdf`
}
