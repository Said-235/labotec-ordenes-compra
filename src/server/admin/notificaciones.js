import { nombreCategoria } from '../../lib/categorias.js'
import { sanitizeText } from '../../lib/validation.js'

export const TIPOS_NOTIFICACION = {
  comprobante_aprobado: 'comprobante_aprobado',
  comprobante_rechazado: 'comprobante_rechazado',
}

function etiquetaOrden(ordenId, categoria) {
  const cat = nombreCategoria(categoria)
  const corto = String(ordenId).slice(0, 8).toUpperCase()
  return `${cat} · ${corto}`
}

export function buildNotificacionComprobante({ tipo, categoria, ordenId, notasAdmin }) {
  const ref = etiquetaOrden(ordenId, categoria)
  const notas = sanitizeText(notasAdmin, 500)

  if (tipo === TIPOS_NOTIFICACION.comprobante_aprobado) {
    return {
      titulo: `Pedido aprobado — ${ref}`,
      mensaje: notas
        ? `Administración confirmó su pago. Su orden quedó marcada como pagada. Nota: ${notas}`
        : 'Administración confirmó su pago. Su orden quedó marcada como pagada.',
    }
  }

  return {
    titulo: `Comprobante rechazado — ${ref}`,
    mensaje: notas
      ? `Revise el motivo e intente subir un comprobante corregido. Motivo: ${notas}`
      : 'Su comprobante fue rechazado. Suba un comprobante corregido desde Mis órdenes.',
  }
}

/**
 * Crea notificación para el cliente (service role, al marcar una orden como pagada).
 */
export async function crearNotificacionComprobante(
  admin,
  { clienteId, ordenId, comprobanteId, categoria, tipo, notasAdmin },
) {
  const { titulo, mensaje } = buildNotificacionComprobante({
    tipo,
    categoria,
    ordenId,
    notasAdmin,
  })

  const row = {
    cliente_id: clienteId,
    orden_id: ordenId,
    tipo,
    titulo: sanitizeText(titulo, 200),
    mensaje: sanitizeText(mensaje, 1000) || null,
  }

  if (comprobanteId) {
    row.comprobante_id = comprobanteId
  }

  const { error } = await admin.from('notificaciones').insert(row)

  if (error) {
    console.error('No se pudo crear la notificación del cliente', error.code)
  }
}
