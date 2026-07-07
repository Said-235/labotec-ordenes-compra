import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fetchCategoriasDesdeBd, mapCategorias, nombreCategoria } from './categorias'
import { ORDER_STATUS, SIGNED_URL_EXPIRY } from './constants'
import { esEnvioIgualFiscal, getDireccionEnvio } from './datosCliente'
import { getOrdenPdfPath } from './ordenes'
import { formatMXN, getTotalesOrdenDesglose, esPrecioDobleSinReactivo, precioHabitualLinea } from './pricing'

function formatFecha(date = new Date()) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)
}

function addLines(doc, lines, x, startY, lineHeight = 5) {
  let y = startY
  for (const line of lines) {
    if (line) {
      doc.text(line, x, y)
      y += lineHeight
    }
  }
  return y
}

function addWrappedLine(doc, label, value, x, y, maxWidth = 180) {
  const text = `${label}: ${value || '—'}`
  const wrapped = doc.splitTextToSize(text, maxWidth)
  doc.text(wrapped, x, y)
  return y + wrapped.length * 5
}

/**
 * Genera el PDF de una orden de compra.
 * @returns {Blob}
 */
export function generateOrdenPDF({ orden, detalles, cliente, categoriaMap }) {
  const doc = new jsPDF()
  const fiscal = cliente.datos_fiscales ?? {}
  const statusLabel = ORDER_STATUS[orden.status] ?? orden.status

  doc.setFontSize(18)
  doc.setTextColor(0, 137, 123)
  doc.text('Labotec — Orden de Compra', 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  let y = addLines(
    doc,
    [
      `Categoría: ${nombreCategoria(orden.categoria, categoriaMap)}`,
      `Número de orden: ${orden.id}`,
      `Fecha de orden: ${formatFecha(new Date(orden.creado_en ?? Date.now()))}`,
      `Estado: ${statusLabel}`,
      orden.payment_confirmed_at
        ? `Pago confirmado: ${formatFecha(new Date(orden.payment_confirmed_at))}`
        : null,
    ],
    14,
    30,
  )

  y += 4
  doc.setFontSize(11)
  doc.setTextColor(0, 0, 0)
  doc.text('Datos de contacto', 14, y)
  doc.setFontSize(9)
  y = addLines(
    doc,
    [
      `Nombre: ${cliente.nombre ?? '—'}`,
      `Correo: ${cliente.email ?? '—'}`,
      `Teléfono: ${fiscal.telefono ?? '—'}`,
    ],
    14,
    y + 7,
  )

  y += 4
  doc.setFontSize(11)
  doc.text('Datos fiscales', 14, y)
  doc.setFontSize(9)
  y += 7
  y = addWrappedLine(doc, 'Razón social', fiscal.razon_social, 14, y)
  y = addWrappedLine(doc, 'RFC', fiscal.rfc, 14, y)
  y = addWrappedLine(doc, 'Dirección fiscal', fiscal.direccion_fiscal, 14, y)
  y = addWrappedLine(doc, 'Correo de facturación', fiscal.correo_facturacion, 14, y)

  y += 4
  doc.setFontSize(11)
  doc.text('Datos de envío', 14, y)
  doc.setFontSize(9)
  y += 7
  if (esEnvioIgualFiscal(fiscal)) {
    y = addWrappedLine(doc, 'Dirección de envío', fiscal.direccion_fiscal, 14, y)
    doc.setTextColor(100, 100, 100)
    y = addWrappedLine(doc, 'Nota', 'Igual a la dirección fiscal', 14, y)
    doc.setTextColor(0, 0, 0)
  } else {
    y = addWrappedLine(doc, 'Dirección de envío', getDireccionEnvio(fiscal), 14, y)
  }

  const descuentoAplicado = Number(orden.descuento_aplicado ?? 0)

  const tableBody = detalles.map((d) => {
    const precioDoble = esPrecioDobleSinReactivo(d, descuentoAplicado)
    const condicion = precioDoble
      ? `×2 sin Reactivo (hab. ${formatMXN(precioHabitualLinea(d, descuentoAplicado))})`
      : '—'

    return [
      d.codigo,
      d.descripcion,
      d.clase,
      String(d.cantidad),
      formatMXN(d.precio_unitario),
      condicion,
      formatMXN(d.subtotal),
    ]
  })

  const hayPrecioDoble = detalles.some((d) => esPrecioDobleSinReactivo(d, descuentoAplicado))

  autoTable(doc, {
    startY: y + 4,
    head: [['Código', 'Descripción', 'Clase', 'Cant.', 'P. Unit.', 'Condición', 'Subtotal']],
    body: tableBody,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [38, 166, 154] },
    columnStyles: {
      5: { cellWidth: 38, fontSize: 7 },
    },
  })

  let finalY = doc.lastAutoTable.finalY + 6

  if (hayPrecioDoble) {
    doc.setFontSize(7)
    doc.setTextColor(120, 80, 0)
    const notaPrecioDoble =
      'Los productos con condición ×2 sin Reactivo se cobraron al doble de su tarifa habitual por no incluir el Reactivo del mismo grupo.'
    const notaWrapped = doc.splitTextToSize(notaPrecioDoble, 180)
    doc.text(notaWrapped, 14, finalY)
    finalY += notaWrapped.length * 4 + 4
    doc.setTextColor(0, 0, 0)
  }

  finalY += 4
  const totales = getTotalesOrdenDesglose(orden)

  doc.setFontSize(10)
  doc.text(`Subtotal: ${formatMXN(totales.subtotal)}`, 140, finalY, { align: 'right' })
  let totalY = finalY + 6
  if (totales.iva > 0) {
    doc.text(`IVA (16%): ${formatMXN(totales.iva)}`, 140, totalY, { align: 'right' })
    totalY += 6
  }
  if (totales.envio > 0) {
    doc.text(`Gastos de envío: ${formatMXN(totales.envio)}`, 140, totalY, { align: 'right' })
    totalY += 6
  }
  doc.setFontSize(12)
  doc.setFont(undefined, 'bold')
  doc.text(`Total: ${formatMXN(totales.total)}`, 140, totalY + 2, { align: 'right' })

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

/**
 * Genera PDF, reemplaza el archivo anterior en Storage y retorna URL firmada.
 */
export async function generateAndUploadOrdenPDF({
  orden,
  detalles,
  cliente,
  supabaseClient,
  categoriaMap,
}) {
  const blob = generateOrdenPDF({ orden, detalles, cliente, categoriaMap })
  const path = getOrdenPdfPath(cliente.id, orden.id, orden.categoria)

  await supabaseClient.storage.from('documentos').remove([path])
  // Ignorar si el archivo aún no existía (primera generación)

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
 * Regenera el PDF de una orden con su estado y datos actuales.
 */
export async function regenerarPdfOrden(ordenId, supabaseClient) {
  const { data: orden, error: ordenError } = await supabaseClient
    .from('ordenes')
    .select(`
      id,
      categoria,
      status,
      subtotal,
      total,
      descuento_aplicado,
      creado_en,
      payment_confirmed_at,
      clientes (
        id,
        nombre,
        email,
        datos_fiscales
      ),
      detalle_orden (
        cantidad,
        precio_base_unitario,
        precio_unitario,
        subtotal,
        productos (
          codigo,
          descripcion,
          clase
        )
      )
    `)
    .eq('id', ordenId)
    .single()

  if (ordenError || !orden?.clientes) {
    throw new Error('No se pudo cargar la orden para regenerar el PDF')
  }

  const cliente = {
    id: orden.clientes.id,
    nombre: orden.clientes.nombre,
    email: orden.clientes.email,
    datos_fiscales: orden.clientes.datos_fiscales,
  }

  const detalles = (orden.detalle_orden ?? []).map((d) => ({
    codigo: d.productos?.codigo ?? '—',
    descripcion: d.productos?.descripcion ?? '—',
    clase: d.productos?.clase ?? '—',
    cantidad: d.cantidad,
    precio_base_unitario: d.precio_base_unitario,
    precio_unitario: d.precio_unitario,
    subtotal: d.subtotal,
  }))

  const categoriasRows = await fetchCategoriasDesdeBd(supabaseClient, { soloActivas: false })
  const categoriaMap = mapCategorias(categoriasRows)

  const { signedUrl } = await generateAndUploadOrdenPDF({
    orden,
    detalles,
    cliente,
    supabaseClient,
    categoriaMap,
  })

  const { error: updateError } = await supabaseClient
    .from('ordenes')
    .update({ pdf_url: signedUrl })
    .eq('id', ordenId)

  if (updateError) {
    throw new Error('No se pudo actualizar la URL del PDF')
  }

  return { signedUrl }
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
