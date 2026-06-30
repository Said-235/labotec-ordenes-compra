import { supabase } from './supabaseClient'

/**
 * Lista notificaciones del cliente autenticado (más recientes primero).
 */
export async function listarNotificaciones(limit = 50) {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('id, orden_id, comprobante_id, tipo, titulo, mensaje, leida, creado_en')
    .order('creado_en', { ascending: false })
    .limit(limit)

  if (error) throw new Error('No se pudieron cargar las notificaciones')
  return data ?? []
}

/**
 * Cuenta notificaciones no leídas del cliente autenticado.
 */
export async function contarNotificacionesNoLeidas() {
  const { count, error } = await supabase
    .from('notificaciones')
    .select('id', { count: 'exact', head: true })
    .eq('leida', false)

  if (error) throw new Error('No se pudieron cargar las notificaciones')
  return count ?? 0
}

/**
 * Marca una notificación como leída.
 */
export async function marcarNotificacionLeida(notificacionId) {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('id', notificacionId)

  if (error) throw new Error('No se pudo actualizar la notificación')
}

/**
 * Marca todas las notificaciones del cliente como leídas.
 */
export async function marcarTodasNotificacionesLeidas() {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('leida', false)

  if (error) throw new Error('No se pudieron marcar las notificaciones')
}
