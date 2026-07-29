/**
 * Este módulo ya no expone service role en el navegador.
 * Las operaciones admin van a /api/admin (Netlify Function / middleware Vite).
 */

export function getSupabaseAdmin() {
  throw new Error(
    'La clave de servicio no está disponible en el cliente. Use la API admin del servidor.',
  )
}

export async function assertAdminSession() {
  throw new Error(
    'assertAdminSession no debe usarse en el navegador. Use callAdmin / rutas protegidas.',
  )
}
