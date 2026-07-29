import { supabase } from './supabaseClient.js'
import { getSafeErrorMessage } from './errors.js'

/** Ruta de la Function en Netlify (y middleware Vite en local). */
const ADMIN_API_URL = '/.netlify/functions/admin'

/**
 * Llama a la API admin del servidor (Netlify Function / middleware Vite).
 * Nunca usa service role en el navegador.
 */
export async function callAdmin(action, payload = {}) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session?.access_token) {
    throw new Error('Sesión no válida')
  }

  const response = await fetch(ADMIN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, payload }),
  })

  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    throw new Error(
      getSafeErrorMessage(
        { message: body?.error },
        body?.error || 'No se pudo completar la operación de administración',
      ),
    )
  }

  return body?.data
}
