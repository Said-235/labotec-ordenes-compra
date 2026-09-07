import { assertAdminSession, getSupabaseAdmin } from '../adminContext.js'
import {
  TIPOS_NOTIFICACION,
  crearNotificacionComprobante,
} from './notificaciones.js'
import { sanitizeText } from '../../lib/validation.js'

/**
 * Lista todas las órdenes (admin) con datos del cliente.
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

  if (error) {
    console.error('[ordenes.list]', error.code, error.message, error.details || '', error.hint || '')
    throw new Error('No se pudieron cargar las órdenes')
  }
  return data ?? []
}

/**
 * Marca una orden pendiente como pagada y notifica al cliente.
 */
export async function marcarOrdenPagada(ordenId, notasAdmin = '') {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data: orden, error: ordenError } = await admin
    .from('ordenes')
    .select('id, status, cliente_id, categoria')
    .eq('id', ordenId)
    .single()

  if (ordenError || !orden) {
    throw new Error('Orden no encontrada')
  }

  if (orden.status !== 'pendiente') {
    throw new Error('La orden no está pendiente de pago')
  }

  const notas = sanitizeText(notasAdmin, 500) || null
  const now = new Date().toISOString()

  const { data: ordenActualizada, error: updateOrdenError } = await admin
    .from('ordenes')
    .update({
      status: 'pagada',
      payment_method: 'manual',
      payment_confirmed_at: now,
    })
    .eq('id', ordenId)
    .eq('status', 'pendiente')
    .select('id, status, payment_confirmed_at')
    .single()

  if (updateOrdenError || ordenActualizada?.status !== 'pagada') {
    console.error(
      '[ordenes.marcarOrdenPagada] update orden',
      updateOrdenError?.code,
      updateOrdenError?.message,
      ordenActualizada,
    )
    throw new Error(
      'No se pudo marcar la orden como pagada. Si el problema continúa, ejecute la migración supabase/migrations/20260806_fix_ordenes_pagada_trigger.sql en Supabase.',
    )
  }

  try {
    const { regenerarPdfOrden } = await import('../../lib/pdfGenerator.js')
    await regenerarPdfOrden(ordenId, admin)
  } catch {
    // La orden queda pagada aunque falle la regeneración del PDF
  }

  await crearNotificacionComprobante(admin, {
    clienteId: orden.cliente_id,
    ordenId: orden.id,
    categoria: orden.categoria,
    tipo: TIPOS_NOTIFICACION.comprobante_aprobado,
    notasAdmin: notas,
  })

  return { ordenId }
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
