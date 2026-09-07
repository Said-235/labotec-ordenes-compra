import { supabase } from './supabaseClient'
import { SIGNED_URL_EXPIRY } from './constants'
import { getOrdenPdfPath } from './ordenPdfPaths'

export { getOrdenPdfPath }

/**
 * Obtiene URL firmada del PDF de una orden.
 */
export async function getOrdenPdfUrl(orden, clienteId) {
  const path = getOrdenPdfPath(clienteId, orden.id, orden.categoria)

  const { data, error } = await supabase.storage
    .from('documentos')
    .createSignedUrl(path, SIGNED_URL_EXPIRY)

  if (error || !data?.signedUrl) {
    // Compatibilidad: órdenes antiguas con URL firmada larga en pdf_url
    if (orden.pdf_url?.startsWith('http')) return orden.pdf_url
    return null
  }
  return data.signedUrl
}

/**
 * Obtiene las órdenes del cliente autenticado con detalle.
 */
export async function obtenerMisOrdenes() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error('Sesión no válida')

  const { data, error } = await supabase
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
      detalle_orden (
        id,
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
    .eq('cliente_id', user.id)
    .order('creado_en', { ascending: false })

  if (error) throw new Error('No se pudieron cargar las órdenes')
  return data ?? []
}

/**
 * Indica si el cliente puede cancelar la orden (solo pendiente).
 */
export function puedeCancelarOrden(orden) {
  return orden.status === 'pendiente'
}

/**
 * Cancela una orden pendiente de pago.
 */
export async function cancelarOrden(ordenId) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error('Sesión no válida')

  const { data: orden, error: ordenError } = await supabase
    .from('ordenes')
    .select('id, status, cliente_id')
    .eq('id', ordenId)
    .eq('cliente_id', user.id)
    .single()

  if (ordenError || !orden) {
    throw new Error('Orden no encontrada')
  }

  if (orden.status !== 'pendiente') {
    throw new Error('Solo puede cancelar órdenes pendientes de pago')
  }

  const { data: actualizada, error: updateError } = await supabase
    .from('ordenes')
    .update({ status: 'cancelada' })
    .eq('id', ordenId)
    .eq('cliente_id', user.id)
    .eq('status', 'pendiente')
    .select('id')
    .maybeSingle()

  if (updateError || !actualizada) {
    throw new Error('No se pudo cancelar la orden')
  }

  return { id: ordenId }
}
