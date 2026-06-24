import { supabase } from './supabaseClient'
import { validatePerfilCliente } from './validation'

/**
 * Actualiza nombre de contacto y datos fiscales del cliente autenticado.
 * RLS impide modificar nivel, es_admin y otros campos sensibles.
 */
export async function actualizarPerfilCliente(data) {
  const { errors, sanitized } = validatePerfilCliente(data)

  if (Object.keys(errors).length > 0) {
    const firstError = Object.values(errors)[0]
    throw new Error(firstError)
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Sesión no válida')
  }

  const { error: updateError } = await supabase
    .from('clientes')
    .update({
      nombre: sanitized.nombre,
      datos_fiscales: sanitized.datos_fiscales,
    })
    .eq('id', user.id)

  if (updateError) {
    throw new Error('No se pudieron guardar los cambios')
  }

  return sanitized
}
