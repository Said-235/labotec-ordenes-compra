import { createClient } from '@supabase/supabase-js'

/**
 * Cliente service role — SOLO para Node (Netlify Functions / Vite middleware).
 * Nunca importar desde código que Vite empaquete para el navegador.
 */
export function createServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el servidor. Configure Netlify Functions env.',
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Valida JWT del usuario y exige admin activo.
 */
export async function requireAdminUser(authHeader) {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    const err = new Error('Sesión no válida')
    err.status = 401
    throw err
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error('Faltan variables Supabase en el servidor')
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token)

  if (userError || !user) {
    const err = new Error('Sesión no válida')
    err.status = 401
    throw err
  }

  const admin = createServiceClient()
  const { data: perfil, error: perfilError } = await admin
    .from('clientes')
    .select('id, es_admin, activo')
    .eq('id', user.id)
    .single()

  if (perfilError || !perfil) {
    const err = new Error('Perfil de usuario no encontrado')
    err.status = 403
    throw err
  }

  if (!perfil.activo) {
    const err = new Error('Cuenta desactivada')
    err.status = 403
    throw err
  }

  if (!perfil.es_admin) {
    const err = new Error('Acceso denegado')
    err.status = 403
    throw err
  }

  return { user, admin }
}
