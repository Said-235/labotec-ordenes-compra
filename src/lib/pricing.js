import { COSTO_ENVIO, IVA_RATE, MULTIPLICADOR_PRECIO_SIN_REACTIVO } from './constants'
import { CLASES_REQUIEREN_REACTIVO, getClaveGrupoFromItem } from './cartValidation'

/**
 * Calcula precio unitario con descuento por nivel.
 * precio_unitario = precio_base * (1 - porcentaje_descuento / 100)
 */
export function calcularPrecioUnitario(precioBase, porcentajeDescuento) {
  const base = Number(precioBase)
  const descuento = Number(porcentajeDescuento)

  if (!Number.isFinite(base) || base < 0) return 0
  if (!Number.isFinite(descuento) || descuento < 0 || descuento >= 100) {
    return Math.round(base * 100) / 100
  }

  const precio = base * (1 - descuento / 100)
  return Math.round(precio * 100) / 100
}

/**
 * Precio unitario de una línea según clase y presencia de Reactivo en el carrito.
 */
export function calcularPrecioLinea(producto, porcentajeDescuento, clavesReactivoEnCarrito) {
  const precioBase = Number(producto.precio_base ?? producto.precio_base_unitario)
  let precioUnitario = calcularPrecioUnitario(precioBase, porcentajeDescuento)

  if (CLASES_REQUIEREN_REACTIVO.includes(producto.clase)) {
    const clave = getClaveGrupoFromItem(producto)
    if (clave && !clavesReactivoEnCarrito.has(clave)) {
      precioUnitario =
        Math.round(precioUnitario * MULTIPLICADOR_PRECIO_SIN_REACTIVO * 100) / 100
    }
  }

  return precioUnitario
}

export function clavesReactivoEnItems(items) {
  return new Set(
    items
      .filter((item) => item.clase === 'Reactivo')
      .map((item) => getClaveGrupoFromItem(item))
      .filter(Boolean),
  )
}

/**
 * Indica si una línea se cobró al doble por no incluir Reactivo del mismo grupo.
 */
export function esPrecioDobleSinReactivo(detalle, descuentoAplicado) {
  const clase = detalle.clase ?? detalle.productos?.clase
  if (!CLASES_REQUIEREN_REACTIVO.includes(clase)) return false

  const precioBase = Number(detalle.precio_base_unitario)
  const precioUnitario = Number(detalle.precio_unitario)
  if (!Number.isFinite(precioBase) || !Number.isFinite(precioUnitario)) return false

  const precioNormal = calcularPrecioUnitario(precioBase, descuentoAplicado)
  const precioDobleEsperado =
    Math.round(precioNormal * MULTIPLICADOR_PRECIO_SIN_REACTIVO * 100) / 100

  return (
    precioDobleEsperado > precioNormal + 0.01 &&
    Math.abs(precioUnitario - precioDobleEsperado) < 0.02
  )
}

export function precioHabitualLinea(detalle, descuentoAplicado) {
  return calcularPrecioUnitario(detalle.precio_base_unitario, descuentoAplicado)
}

/**
 * Calcula subtotal, IVA (16%), gastos de envío y total de una orden.
 * @param {object} [opciones]
 * @param {boolean} [opciones.incluirEnvio=true] — un solo cargo de envío por compra
 */
export function calcularTotalesOrden(subtotalProductos, { incluirEnvio = true } = {}) {
  const subtotal = Math.round(Number(subtotalProductos) * 100) / 100
  const iva = Math.round(subtotal * IVA_RATE * 100) / 100
  const envio = incluirEnvio ? COSTO_ENVIO : 0
  const total = Math.round((subtotal + iva + envio) * 100) / 100
  return { subtotal, iva, envio, total }
}

/**
 * Desglose de totales para mostrar en PDF/UI.
 * Órdenes anteriores (sin IVA ni envío) conservan su total histórico.
 */
export function getTotalesOrdenDesglose(orden) {
  const subtotal = Number(orden.subtotal)
  const total = Number(orden.total)

  const conEnvio = calcularTotalesOrden(subtotal, { incluirEnvio: true })
  if (Math.abs(total - conEnvio.total) < 0.01) {
    return conEnvio
  }

  const sinEnvio = calcularTotalesOrden(subtotal, { incluirEnvio: false })
  if (Math.abs(total - sinEnvio.total) < 0.01) {
    return sinEnvio
  }

  return { subtotal, iva: 0, envio: 0, total }
}

export function formatMXN(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(Number(amount) || 0)
}
