import { runWithAdminContext } from './adminContext.js'
import { requireAdminUser } from './supabaseService.js'
import * as clientes from './admin/clientes.js'
import * as administradores from './admin/administradores.js'
import * as productos from './admin/productos.js'
import * as categorias from './admin/categorias.js'
import * as ordenes from './admin/ordenes.js'
import * as eliminarProductos from './admin/eliminarProductos.js'
import * as cargaOds from './admin/cargaOds.js'

const actions = {
  'dashboard.stats': async () => {
    const admin = (await import('./adminContext.js')).getSupabaseAdmin()
    const [clientesCount, productosCount, ordenesPendientes, comprobantesPendientes] =
      await Promise.all([
        admin.from('clientes').select('id', { count: 'exact', head: true }).eq('es_admin', false).eq('activo', true),
        admin.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true),
        admin.from('ordenes').select('id', { count: 'exact', head: true }).eq('status', 'pendiente'),
        admin
          .from('comprobantes')
          .select('id', { count: 'exact', head: true })
          .eq('validado', false)
          .eq('rechazado', false),
      ])

    return {
      clientes: clientesCount.count ?? 0,
      productos: productosCount.count ?? 0,
      ordenesPendientes: ordenesPendientes.count ?? 0,
      comprobantesPendientes: comprobantesPendientes.count ?? 0,
    }
  },

  'clientes.list': () => clientes.listarClientes(),
  'clientes.create': (p) => clientes.crearCliente(p),
  'clientes.update': (p) => {
    const { clienteId, ...rest } = p
    return clientes.actualizarCliente(clienteId, rest)
  },
  'clientes.deactivate': (p) => clientes.desactivarCliente(p.clienteId),
  'clientes.reactivate': (p) => clientes.reactivarCliente(p.clienteId),
  'clientes.delete': (p) => clientes.eliminarCliente(p.clienteId),
  'clientes.resetPassword': (p) => clientes.restablecerPasswordCliente(p.clienteId, p.password),

  'administradores.list': () => administradores.listarAdministradores(),
  'administradores.create': (p) => administradores.crearAdministrador(p),
  'administradores.update': (p) => {
    const { adminId, ...rest } = p
    return administradores.actualizarAdministrador(adminId, rest)
  },
  'administradores.deactivate': (p, ctx) =>
    administradores.desactivarAdministrador(p.adminId, ctx.user.id),
  'administradores.reactivate': (p) => administradores.reactivarAdministrador(p.adminId),
  'administradores.resetPassword': (p) =>
    administradores.restablecerPasswordAdministrador(p.adminId, p.password),

  'productos.list': (p) => productos.listarProductos(p),
  'productos.create': (p) => productos.crearProducto(p),
  'productos.update': (p) => productos.actualizarProducto(p.productoId, p.data ?? p),
  'productos.deactivate': (p) => productos.desactivarProducto(p.productoId),
  'productos.reactivate': (p) => productos.reactivarProducto(p.productoId),
  'productos.delete': (p) => eliminarProductos.eliminarProducto(p.productoId),
  'productos.deleteBatch': (p) => eliminarProductos.eliminarProductosLote(p.productoIds),

  'categorias.list': () => categorias.listarCategorias(),
  'categorias.create': (p) => categorias.crearCategoria(p),
  'categorias.setActive': (p) => categorias.actualizarEstadoCategoria(p.clave, p.activo),

  'ordenes.list': (p) => ordenes.obtenerTodasOrdenes(p),
  'ordenes.validarComprobante': (p) => ordenes.validarComprobante(p.comprobanteId, p.notasAdmin),
  'ordenes.rechazarComprobante': (p) =>
    ordenes.rechazarComprobante(p.comprobanteId, p.motivoRechazo),
  'ordenes.comprobanteUrl': (p) => ordenes.getComprobanteAdminUrl(p.path),
  'ordenes.pdfUrl': (p) => ordenes.getOrdenPdfAdminUrl(p.clienteId, p.ordenId, p.categoria),

  'cargaOds.procesar': (p) => cargaOds.procesarCargaODSFromRows(p),
  'cargaOds.logs': (p) => cargaOds.obtenerLogCargas(p?.limit),
  'cargaOds.eliminar': (p) => eliminarProductos.eliminarProductosPorCarga(p.logCargaId),
}

/**
 * Maneja una petición admin autenticada.
 * @returns {{ status: number, body: object }}
 */
export async function handleAdminRequest({ authHeader, action, payload }) {
  try {
    if (!action || typeof action !== 'string') {
      return { status: 400, body: { error: 'Acción inválida' } }
    }

    const handler = actions[action]
    if (!handler) {
      return { status: 404, body: { error: 'Acción no encontrada' } }
    }

    const ctx = await requireAdminUser(authHeader)

    const data = await runWithAdminContext(ctx, async () => handler(payload ?? {}, ctx))

    return { status: 200, body: { data } }
  } catch (err) {
    const status = err?.status || 400
    const message = err?.message || 'Error en operación de administración'
    console.error('[admin]', action || '(sin acción)', status, message)
    // Nunca filtrar detalles técnicos de Supabase
    const safe =
      /service_role|JWT|supabase|stack|ECONNREFUSED|Faltan SUPABASE/i.test(message)
        ? 'El sistema no está configurado correctamente. Contacte al administrador.'
        : message
    return { status: status >= 400 && status < 600 ? status : 400, body: { error: safe } }
  }
}
