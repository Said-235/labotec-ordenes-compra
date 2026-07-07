import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

/**
 * Cliente Supabase con SERVICE ROLE KEY — bypassa RLS.
 *
 * IMPORTANTE: Solo importar desde módulos utilitarios de admin
 * (src/lib/admin/*). Nunca desde componentes de cliente ni páginas
 * accesibles a usuarios no admin sin verificación previa.
 *
 * En producción, migrar operaciones admin a Netlify Functions o
 * Supabase Edge Functions para no exponer la service role key.
 */

let adminClient = null

function createAdminClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'El sistema no está configurado correctamente. Contacte al administrador.',
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createAdminClient()
  }
  return adminClient
}

/**
 * Verifica que el usuario autenticado actual sea admin antes de
 * ejecutar operaciones con service role. Nunca confiar solo en el frontend.
 */
export async function assertAdminSession() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Sesión no válida')
  }

  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select('es_admin, activo')
    .eq('id', user.id)
    .single()

  if (clienteError || !cliente) {
    throw new Error('Perfil de usuario no encontrado')
  }

  if (!cliente.activo) {
    throw new Error('Cuenta desactivada')
  }

  if (!cliente.es_admin) {
    throw new Error('Acceso denegado')
  }

  return { user, cliente }
}
