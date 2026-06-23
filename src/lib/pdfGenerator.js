import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { CATEGORIAS } from './constants'
import { formatMXN } from './pricing'

function formatFecha(date = new Date()) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)
}

/**
 * Genera el PDF de una orden de compra.
 * @returns {Blob}
 */
export function generateOrdenPDF({ orden, detalles, cliente }) {
  const doc = new jsPDF()
  const fiscal = cliente.datos_fiscales ?? {}

  doc.setFontSize(18)
  doc.setTextColor(0, 137, 123)
  doc.text('Labotec — Orden de Compra', 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`Categoría: ${CATEGORIAS[orden.categoria] ?? orden.categoria}`, 14, 30)
  doc.text(`Número de orden: ${orden.id}`, 14, 36)
  doc.text(`Fecha: ${formatFecha(new Date(orden.creado_en ?? Date.now()))}`, 14, 42)
  doc.text(`Estado: ${orden.status}`, 14, 48)

  doc.setFontSize(11)
  doc.setTextColor(0, 0, 0)
  doc.text('Datos fiscales', 14, 58)
  doc.setFontSize(9)
  doc.text(`Razón social: ${fiscal.razon_social ?? '—'}`, 14, 65)
  doc.text(`RFC: ${fiscal.rfc ?? '—'}`, 14, 71)
  doc.text(`Dirección: ${fiscal.direccion_fiscal ?? '—'}`, 14, 77)

  const tableBody = detalles.map((d) => [
    d.codigo,
    d.descripcion,
    d.clase,
    String(d.cantidad),
    formatMXN(d.precio_unitario),
    formatMXN(d.subtotal),
  ])

  autoTable(doc, {
    startY: 85,
    head: [['Código', 'Descripción', 'Clase', 'Cant.', 'P. Unit.', 'Subtotal']],
    body: tableBody,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [38, 166, 154] },
  })

  const finalY = doc.lastAutoTable.finalY + 10

  doc.setFontSize(10)
  doc.text(`Subtotal: ${formatMXN(orden.subtotal)}`, 140, finalY, { align: 'right' })
  doc.text(
    `Descuento aplicado: ${Number(orden.descuento_aplicado).toFixed(2)}%`,
    140,
    finalY + 6,
    { align: 'right' },
  )
  doc.setFontSize(12)
  doc.setFont(undefined, 'bold')
  doc.text(`Total: ${formatMXN(orden.total)}`, 140, finalY + 14, { align: 'right' })

  doc.setFont(undefined, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(
    'Este documento no es una factura fiscal.',
    14,
    doc.internal.pageSize.height - 10,
  )

  return doc.output('blob')
}

const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7 // 7 días

/**
 * Genera PDF, lo sube a Storage y retorna URL firmada.
 */
export async function generateAndUploadOrdenPDF({
  orden,
  detalles,
  cliente,
  supabaseClient,
}) {
  const blob = generateOrdenPDF({ orden, detalles, cliente })
  const fileName = `orden_${orden.categoria}.pdf`
  const path = `${cliente.id}/${orden.id}/${fileName}`

  const { error: uploadError } = await supabaseClient.storage
    .from('documentos')
    .upload(path, blob, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    throw new Error('No se pudo subir el PDF de la orden')
  }

  const { data: signedData, error: signedError } = await supabaseClient.storage
    .from('documentos')
    .createSignedUrl(path, SIGNED_URL_EXPIRY)

  if (signedError || !signedData?.signedUrl) {
    throw new Error('No se pudo generar la URL del PDF')
  }

  return {
    path,
    signedUrl: signedData.signedUrl,
  }
}

/**
 * Descarga un PDF ya generado (blob local).
 */
export function downloadOrdenPDF(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
