import { handleAdminRequest } from '../../src/server/dispatchAdmin.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Netlify Function: API admin (mismas acciones que el middleware de Vite).
 */
export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Método no permitido' }),
    }
  }

  let parsed = {}
  try {
    parsed = event.body ? JSON.parse(event.body) : {}
  } catch {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'JSON inválido' }),
    }
  }

  const result = await handleAdminRequest({
    authHeader: event.headers.authorization || event.headers.Authorization,
    action: parsed.action,
    payload: parsed.payload,
  })

  return {
    statusCode: result.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(result.body),
  }
}
