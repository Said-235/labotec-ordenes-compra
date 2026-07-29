import { AsyncLocalStorage } from 'node:async_hooks'

const storage = new AsyncLocalStorage()

export function runWithAdminContext(ctx, fn) {
  return storage.run(ctx, fn)
}

export function getSupabaseAdmin() {
  const ctx = storage.getStore()
  if (!ctx?.admin) {
    throw new Error('Contexto admin no disponible')
  }
  return ctx.admin
}

export async function assertAdminSession() {
  const ctx = storage.getStore()
  if (!ctx?.user || !ctx?.admin) {
    throw new Error('Sesión no válida')
  }
  return { user: ctx.user, cliente: { es_admin: true, activo: true } }
}
