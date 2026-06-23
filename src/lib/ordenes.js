import { supabase } from './supabaseClient'
import { SIGNED_URL_EXPIRY } from './constants'

/**
 * Ruta canónica del PDF de una orden en Storage.
 */
export function getOrdenPdfPath(clienteId, ordenId, categoria) {
  return `${clienteId}/${ordenId}/orden_${categoria}.pdf`
}

/**
 * Obtiene URL firmada del PDF de una orden.
 */
export async function getOrdenPdfUrl(orden, clienteId) {
  const path = getOrdenPdfPath(clienteId, orden.id, orden.categoria)

  const { data, error } = await supabase.storage
    .from('documentos')
    .createSignedUrl(path, SIGNED_URL_EXPIRY)

  if (error || !data?.signedUrl) return orden.pdf_url ?? null
  return data.signedUrl
}

/**
 * Obtiene las órdenes del cliente autenticado con detalle y comprobantes.
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
      subtotal,
      total,
      pdf_url,
      creado_en,
      payment_confirmed_at,
      comprobantes (
        id,
        url_archivo,
        validado,
        validado_en,
        notas_admin,
        creado_en
      ),
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
