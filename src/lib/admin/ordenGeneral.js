import { callAdmin } from '../adminApi'

export async function previewOrdenGeneral() {
  return callAdmin('ordenGeneral.preview')
}

export async function generarOrdenGeneral(datosFormato) {
  return callAdmin('ordenGeneral.generar', { datosFormato })
}

export async function listarOrdenesGenerales() {
  return callAdmin('ordenGeneral.list')
}

export async function getOrdenGeneralPdfUrl(ordenGeneralId) {
  return callAdmin('ordenGeneral.pdfUrl', { ordenGeneralId })
}
