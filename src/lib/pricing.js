import {
  CLASES_PRODUCTO,
  COSTO_ENVIO,
  IVA_RATE,
  MULTIPLICADOR_PRECIO_SIN_REACTIVO,
} from './constants.js'
import { CLASES_REQUIEREN_REACTIVO, getClaveGrupoFromItem } from './cartValidation.js'

/**
 * Mapa vacío de aumentos (todas las clases en 0).
 */
export function aumentosPorClaseVacios() {
  return Object.fromEntries(CLASES_PRODUCTO.map((clase) => [clase, 0]))
}

/**
 * Normaliza un mapa de aumentos (o un % legado) a { Clase: number }.
 * Acepta: objeto aumentos_por_clase, número único, o perfil de cliente.
 */
export function normalizarAumentosPorClase(fuente) {
  const base = aumentosPorClaseVacios()

  if (fuente == null) return base

  if (typeof fuente === 'number' || typeof fuente === 'string') {
    const pct = sanitizePorcentaje(fuente)
    return Object.fromEntries(CLASES_PRODUCTO.map((clase) => [clase, pct]))
  }

  const map =
    fuente.aumentos_por_clase && typeof fuente.aumentos_por_clase === 'object'
      ? fuente.aumentos_por_clase
      : fuente.aumentos_aplicados && typeof fuente.aumentos_aplicados === 'object'
        ? fuente.aumentos_aplicados
        : fuente

  const legado =
    fuente.porcentaje_aumento != null
      ? sanitizePorcentaje(fuente.porcentaje_aumento)
      : fuente.descuento_aplicado != null
        ? sanitizePorcentaje(fuente.descuento_aplicado)
        : 0

  for (const clase of CLASES_PRODUCTO) {
    if (map && map[clase] != null && map[clase] !== '') {
      base[clase] = sanitizePorcentaje(map[clase])
    } else {
      base[clase] = legado
    }
  }

  return base
}

export function sanitizePorcentaje(porcentaje) {
  const pct = Number(porcentaje)
  if (!Number.isFinite(pct) || pct < 0) return 0
  if (pct > 999.99) return 999.99
  return Math.round(pct * 100) / 100
}

/**
 * Resuelve el % de aumento para una clase de producto.
 */
export function resolverAumento(fuente, clase) {
  const map = normalizarAumentosPorClase(fuente)
  if (clase && map[clase] != null) return map[clase]
  return map.Reactivo ?? 0
}

/**
 * Calcula precio unitario con aumento.
 * precio_unitario = precio_base * (1 + porcentaje_aumento / 100)
 */
export function calcularPrecioUnitario(precioBase, porcentajeAumento) {
  const base = Number(precioBase)
  const aumento = Number(porcentajeAumento)

  if (!Number.isFinite(base) || base < 0) return 0
  if (!Number.isFinite(aumento) || aumento < 0) {
    return Math.round(base * 100) / 100
  }

  const precio = base * (1 + aumento / 100)
  return Math.round(precio * 100) / 100
}

/**
 * Precio unitario de una línea según clase y presencia de Reactivo en el carrito.
 * @param {object} producto
 * @param {object|number} aumentosFuente — mapa por clase, perfil cliente, o % legado
 * @param {Set} clavesReactivoEnCarrito
 */
export function calcularPrecioLinea(producto, aumentosFuente, clavesReactivoEnCarrito) {
  const precioBase = Number(producto.precio_base ?? producto.precio_base_unitario)
  const aumento = resolverAumento(aumentosFuente, producto.clase)
  let precioUnitario = calcularPrecioUnitario(precioBase, aumento)

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
 * @param {object} detalle
 * @param {object|number} aumentosFuente — mapa snapshot de la orden, o % legado
 */
export function esPrecioDobleSinReactivo(detalle, aumentosFuente) {
  const clase = detalle.clase ?? detalle.productos?.clase
  if (!CLASES_REQUIEREN_REACTIVO.includes(clase)) return false

  const precioBase = Number(detalle.precio_base_unitario)
  const precioUnitario = Number(detalle.precio_unitario)
  if (!Number.isFinite(precioBase) || !Number.isFinite(precioUnitario)) return false

  const aumento = resolverAumento(aumentosFuente, clase)
  const precioNormal = calcularPrecioUnitario(precioBase, aumento)
  const precioDobleEsperado =
    Math.round(precioNormal * MULTIPLICADOR_PRECIO_SIN_REACTIVO * 100) / 100

  return (
    precioDobleEsperado > precioNormal + 0.01 &&
    Math.abs(precioUnitario - precioDobleEsperado) < 0.02
  )
}

export function precioHabitualLinea(detalle, aumentosFuente) {
  const clase = detalle.clase ?? detalle.productos?.clase
  return calcularPrecioUnitario(
    detalle.precio_base_unitario,
    resolverAumento(aumentosFuente, clase),
  )
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
