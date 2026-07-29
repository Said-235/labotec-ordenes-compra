import { assertAdminSession, getSupabaseAdmin } from '../adminContext.js'
import {
  TIPOS_NOTIFICACION,
  crearNotificacionComprobante,
} from './notificaciones.js'
import { sanitizeText } from '../../lib/validation.js'

/**
 * Lista todas las órdenes (admin) con datos del cliente y comprobantes.
 */
export async function obtenerTodasOrdenes({ status } = {}) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  let query = admin
    .from('ordenes')
    .select(`
      id,
      categoria,
      status,
      nivel_cliente,
      descuento_aplicado,
      aumentos_aplicados,
      subtotal,
      total,
      pdf_url,
      creado_en,
      payment_confirmed_at,
      clientes (
        id,
        nombre,
        email,
        datos_fiscales
      ),
      comprobantes (
        id,
        url_archivo,
        validado,
        validado_en,
        rechazado,
        rechazado_en,
        notas_admin,
        creado_en
      ),
      detalle_orden (
        cantidad,
        precio_unitario,
        subtotal,
        productos (codigo, descripcion, clase)
      )
    `)
    .order('creado_en', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) throw new Error('No se pudieron cargar las órdenes')
  return data ?? []
}

/**
 * Valida un comprobante y marca la orden como pagada.
 */
export async function validarComprobante(comprobanteId, notasAdmin = '') {
  const { user } = await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data: comprobante, error: compError } = await admin
    .from('comprobantes')
    .select('id, orden_id, validado, rechazado')
    .eq('id', comprobanteId)
    .single()

  if (compError || !comprobante) {
    throw new Error('Comprobante no encontrado')
  }

  if (comprobante.validado) {
    throw new Error('El comprobante ya fue validado')
  }

  if (comprobante.rechazado) {
    throw new Error('Este comprobante ya fue rechazado')
  }

  const { data: orden, error: ordenError } = await admin
    .from('ordenes')
    .select('id, status, cliente_id, categoria')
    .eq('id', comprobante.orden_id)
    .single()

  if (ordenError || !orden) {
    throw new Error('Orden no encontrada')
  }

  if (orden.status !== 'pendiente') {
    throw new Error('La orden no está pendiente de pago')
  }

  const notas = sanitizeText(notasAdmin, 500) || null
  const now = new Date().toISOString()

  const { error: updateCompError } = await admin
    .from('comprobantes')
    .update({
      validado: true,
      validado_por: user.id,
      validado_en: now,
      notas_admin: notas,
    })
    .eq('id', comprobanteId)

  if (updateCompError) {
    throw new Error('No se pudo validar el comprobante')
  }

  const { error: updateOrdenError } = await admin
    .from('ordenes')
    .update({
      status: 'pagada',
      payment_method: 'manual',
      payment_confirmed_at: now,
    })
    .eq('id', comprobante.orden_id)

  if (updateOrdenError) {
    await admin
      .from('comprobantes')
      .update({ validado: false, validado_por: null, validado_en: null })
      .eq('id', comprobanteId)
    throw new Error('No se pudo marcar la orden como pagada')
  }

  try {
    const { regenerarPdfOrden } = await import('../../lib/pdfGenerator.js')
    await regenerarPdfOrden(comprobante.orden_id, admin)
  } catch {
    // La orden queda pagada aunque falle la regeneración del PDF
  }

  await crearNotificacionComprobante(admin, {
    clienteId: orden.cliente_id,
    ordenId: orden.id,
    comprobanteId: comprobante.id,
    categoria: orden.categoria,
    tipo: TIPOS_NOTIFICACION.comprobante_aprobado,
    notasAdmin: notas,
  })

  return { ordenId: comprobante.orden_id }
}

/**
 * Rechaza un comprobante. La orden permanece pendiente; el cliente puede ver el motivo y subir otro.
 */
export async function rechazarComprobante(comprobanteId, motivoRechazo) {
  const { user } = await assertAdminSession()
  const admin = getSupabaseAdmin()

  const motivo = sanitizeText(motivoRechazo, 500)
  if (!motivo || motivo.length < 5) {
    throw new Error('Indique el motivo del rechazo (mínimo 5 caracteres)')
  }

  const { data: comprobante, error: compError } = await admin
    .from('comprobantes')
    .select('id, orden_id, validado, rechazado')
    .eq('id', comprobanteId)
    .single()

  if (compError || !comprobante) {
    throw new Error('Comprobante no encontrado')
  }

  if (comprobante.validado) {
    throw new Error('No se puede rechazar un comprobante ya validado')
  }

  if (comprobante.rechazado) {
    throw new Error('Este comprobante ya fue rechazado')
  }

  const { data: orden, error: ordenError } = await admin
    .from('ordenes')
    .select('id, status, cliente_id, categoria')
    .eq('id', comprobante.orden_id)
    .single()

  if (ordenError || !orden) {
    throw new Error('Orden no encontrada')
  }

  if (orden.status !== 'pendiente') {
    throw new Error('La orden no está pendiente de pago')
  }

  const now = new Date().toISOString()

  const { error: updateError } = await admin
    .from('comprobantes')
    .update({
      rechazado: true,
      rechazado_en: now,
      rechazado_por: user.id,
      notas_admin: motivo,
    })
    .eq('id', comprobanteId)

  if (updateError) {
    throw new Error('No se pudo rechazar el comprobante')
  }

  await crearNotificacionComprobante(admin, {
    clienteId: orden.cliente_id,
    ordenId: orden.id,
    comprobanteId: comprobante.id,
    categoria: orden.categoria,
    tipo: TIPOS_NOTIFICACION.comprobante_rechazado,
    notasAdmin: motivo,
  })

  return { ordenId: comprobante.orden_id }
}

/**
 * URL firmada del comprobante (admin).
 */
export async function getComprobanteAdminUrl(path) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data, error } = await admin.storage
    .from('documentos')
    .createSignedUrl(sanitizeText(path, 500), 3600)

  if (error || !data?.signedUrl) {
    throw new Error('No se pudo abrir el comprobante')
  }

  return data.signedUrl
}

/**
 * URL firmada del PDF de orden (admin).
 */
export async function getOrdenPdfAdminUrl(clienteId, ordenId, categoria) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const path = `${clienteId}/${ordenId}/orden_${categoria}.pdf`
  const { data, error } = await admin.storage
    .from('documentos')
    .createSignedUrl(path, 3600)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
