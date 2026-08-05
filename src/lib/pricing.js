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
 * Cantidad de Reactivo por clave de grupo (categoría::grupo_prueba).
 * @param {Array<{clase?: string, categoria?: string, grupo_prueba?: string, cantidad?: number}>} items
 * @returns {Map<string, number>}
 */
export function cantidadesReactivoPorGrupo(items) {
  const map = new Map()
  for (const item of items) {
    if (item.clase !== 'Reactivo') continue
    const clave = getClaveGrupoFromItem(item)
    if (!clave) continue
    map.set(clave, (map.get(clave) || 0) + (Number(item.cantidad) || 0))
  }
  return map
}

/**
 * Precio unitario de una línea según clase y cobertura de Reactivo.
 * @param {object} producto
 * @param {object|number} aumentosFuente — mapa por clase, perfil cliente, o % legado
 * @param {Set|Map} coberturaReactivo — Set de claves (legado) o Map clave→cantidad Reactivo
 * @param {{ unidadesCubiertas?: number, cantidad?: number }} [opciones]
 *   Si se pasan unidadesCubiertas/cantidad, el ×2 aplica solo al exceso.
 */
export function calcularPrecioLinea(
  producto,
  aumentosFuente,
  coberturaReactivo,
  { unidadesCubiertas, cantidad } = {},
) {
  const precioBase = Number(producto.precio_base ?? producto.precio_base_unitario)
  const aumento = resolverAumento(aumentosFuente, producto.clase)
  const precioNormal = calcularPrecioUnitario(precioBase, aumento)

  if (!CLASES_REQUIEREN_REACTIVO.includes(producto.clase)) {
    return precioNormal
  }

  const clave = getClaveGrupoFromItem(producto)
  if (!clave) return precioNormal

  const precioDoble =
    Math.round(precioNormal * MULTIPLICADOR_PRECIO_SIN_REACTIVO * 100) / 100

  // Asignación explícita por unidades (preferida)
  if (unidadesCubiertas != null && cantidad != null && cantidad > 0) {
    const cubiertas = Math.max(0, Math.min(Number(unidadesCubiertas) || 0, cantidad))
    const exceso = cantidad - cubiertas
    if (exceso <= 0) return precioNormal
    const subtotal = cubiertas * precioNormal + exceso * precioDoble
    return Math.round((subtotal / cantidad) * 100) / 100
  }

  // Legado: Set de claves con Reactivo presente
  if (coberturaReactivo instanceof Set) {
    if (!coberturaReactivo.has(clave)) return precioDoble
    return precioNormal
  }

  // Map cantidad Reactivo: sin unidades → todo o nada por presencia
  if (coberturaReactivo instanceof Map) {
    if ((coberturaReactivo.get(clave) || 0) <= 0) return precioDoble
    return precioNormal
  }

  return precioNormal
}

/**
 * Calcula precio unitario y subtotal de cada línea aplicando ×2 solo a las
 * unidades de Calibrador/Control que exceden la cantidad de Reactivo del grupo.
 * Calibrador y Control se cubren de forma independiente con la misma cantidad de Reactivo.
 *
 * @param {Array<{producto: object, cantidad: number}>} lineas
 * @param {object|number} aumentosFuente
 * @param {{ aplicaReglaCalibradorControl?: boolean }} [opciones]
 * @returns {Array<{precioNormal: number, precioDoble: number, subtotal: number, unidadesCubiertas: number, unidadesExceso: number}>}
 */
export function calcularPreciosConCoberturaReactivo(
  lineas,
  aumentosFuente,
  { aplicaReglaCalibradorControl = true } = {},
) {
  const qtyReactivo = cantidadesReactivoPorGrupo(
    lineas.map(({ producto, cantidad }) => ({ ...producto, cantidad })),
  )
  const coberturaRestante = new Map()

  return lineas.map(({ producto, cantidad }) => {
    const qty = Math.max(0, Math.floor(Number(cantidad) || 0))
    const precioBase = Number(producto.precio_base ?? producto.precio_base_unitario)
    const aumento = resolverAumento(aumentosFuente, producto.clase)
    const precioNormal = calcularPrecioUnitario(precioBase, aumento)
    const precioDoble =
      Math.round(precioNormal * MULTIPLICADOR_PRECIO_SIN_REACTIVO * 100) / 100

    if (
      !aplicaReglaCalibradorControl ||
      !CLASES_REQUIEREN_REACTIVO.includes(producto.clase) ||
      qty <= 0
    ) {
      const subtotal = Math.round(precioNormal * qty * 100) / 100
      return {
        precioNormal,
        precioDoble,
        subtotal,
        unidadesCubiertas: qty,
        unidadesExceso: 0,
      }
    }

    const clave = getClaveGrupoFromItem(producto)
    if (!clave) {
      const subtotal = Math.round(precioNormal * qty * 100) / 100
      return {
        precioNormal,
        precioDoble,
        subtotal,
        unidadesCubiertas: qty,
        unidadesExceso: 0,
      }
    }

    const covKey = `${clave}::${producto.clase}`
    if (!coberturaRestante.has(covKey)) {
      coberturaRestante.set(covKey, qtyReactivo.get(clave) || 0)
    }

    const disponible = coberturaRestante.get(covKey)
    const cubiertas = Math.min(qty, disponible)
    const exceso = qty - cubiertas
    coberturaRestante.set(covKey, disponible - cubiertas)

    const subtotal =
      Math.round((cubiertas * precioNormal + exceso * precioDoble) * 100) / 100

    return {
      precioNormal,
      precioDoble,
      subtotal,
      unidadesCubiertas: cubiertas,
      unidadesExceso: exceso,
    }
  })
}

/**
 * Expande cada ítem del carrito en una o dos líneas de cobro:
 * unidades a precio habitual y, si aplica, unidades a precio ×2.
 * Evita guardar un precio unitario promediado.
 *
 * @param {Array<{producto: object, cantidad: number}>} lineas
 * @param {object|number} aumentosFuente
 * @param {{ aplicaReglaCalibradorControl?: boolean }} [opciones]
 * @returns {Array<{producto: object, cantidad: number, precio_base_unitario: number, precio_unitario: number, subtotal: number, esPrecioDoble: boolean}>}
 */
export function expandirLineasConCoberturaReactivo(
  lineas,
  aumentosFuente,
  opciones = {},
) {
  const precios = calcularPreciosConCoberturaReactivo(lineas, aumentosFuente, opciones)
  const resultado = []

  for (let i = 0; i < lineas.length; i++) {
    const { producto } = lineas[i]
    const p = precios[i]
    const precioBase = Number(producto.precio_base ?? producto.precio_base_unitario)

    if (p.unidadesCubiertas > 0) {
      resultado.push({
        producto,
        cantidad: p.unidadesCubiertas,
        precio_base_unitario: precioBase,
        precio_unitario: p.precioNormal,
        subtotal: Math.round(p.unidadesCubiertas * p.precioNormal * 100) / 100,
        esPrecioDoble: false,
      })
    }

    if (p.unidadesExceso > 0) {
      resultado.push({
        producto,
        cantidad: p.unidadesExceso,
        precio_base_unitario: precioBase,
        precio_unitario: p.precioDoble,
        subtotal: Math.round(p.unidadesExceso * p.precioDoble * 100) / 100,
        esPrecioDoble: true,
      })
    }
  }

  return resultado
}

/**
 * Desglosa una línea ya guardada en segmentos habitual / ×2 para mostrar
 * sin promediar (incluye órdenes antiguas con precio unitario mezclado).
 */
export function desglosePrecioLinea(detalle, aumentosFuente) {
  const cantidad = Math.max(0, Math.floor(Number(detalle.cantidad) || 0))
  const precioUnitario = Number(detalle.precio_unitario)
  const subtotalGuardado = Number(detalle.subtotal)
  const precioNormal = precioHabitualLinea(detalle, aumentosFuente)
  const precioDoble =
    Math.round(precioNormal * MULTIPLICADOR_PRECIO_SIN_REACTIVO * 100) / 100

  if (cantidad <= 0 || !Number.isFinite(precioUnitario)) {
    return [
      {
        cantidad,
        precioUnitario: Number.isFinite(precioUnitario) ? precioUnitario : 0,
        subtotal: Number.isFinite(subtotalGuardado) ? subtotalGuardado : 0,
        esDoble: false,
      },
    ]
  }

  if (Math.abs(precioUnitario - precioNormal) < 0.02) {
    return [
      {
        cantidad,
        precioUnitario: precioNormal,
        subtotal:
          Number.isFinite(subtotalGuardado)
            ? subtotalGuardado
            : Math.round(precioNormal * cantidad * 100) / 100,
        esDoble: false,
      },
    ]
  }

  if (
    precioDoble > precioNormal + 0.01 &&
    Math.abs(precioUnitario - precioDoble) < 0.02
  ) {
    return [
      {
        cantidad,
        precioUnitario: precioDoble,
        subtotal:
          Number.isFinite(subtotalGuardado)
            ? subtotalGuardado
            : Math.round(precioDoble * cantidad * 100) / 100,
        esDoble: true,
      },
    ]
  }

  // Línea mezclada (promedio): recuperar unidades cubiertas desde el subtotal
  if (
    precioDoble > precioNormal + 0.01 &&
    Number.isFinite(subtotalGuardado) &&
    precioUnitario > precioNormal + 0.01 &&
    precioUnitario < precioDoble - 0.01
  ) {
    const cubiertas = Math.round(
      (subtotalGuardado - cantidad * precioDoble) / (precioNormal - precioDoble),
    )
    const unidadesCubiertas = Math.max(0, Math.min(cantidad, cubiertas))
    const unidadesExceso = cantidad - unidadesCubiertas
    const partes = []

    if (unidadesCubiertas > 0) {
      partes.push({
        cantidad: unidadesCubiertas,
        precioUnitario: precioNormal,
        subtotal: Math.round(unidadesCubiertas * precioNormal * 100) / 100,
        esDoble: false,
      })
    }
    if (unidadesExceso > 0) {
      partes.push({
        cantidad: unidadesExceso,
        precioUnitario: precioDoble,
        subtotal: Math.round(unidadesExceso * precioDoble * 100) / 100,
        esDoble: true,
      })
    }
    if (partes.length) return partes
  }

  return [
    {
      cantidad,
      precioUnitario,
      subtotal:
        Number.isFinite(subtotalGuardado)
          ? subtotalGuardado
          : Math.round(precioUnitario * cantidad * 100) / 100,
      esDoble: esPrecioDobleSinReactivo(detalle, aumentosFuente),
    },
  ]
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
 * Indica si una línea se cobró (total o parcialmente) al doble por Reactivo insuficiente.
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

  // Total o parcial: cualquier cobro por encima de la tarifa habitual
  return (
    precioDobleEsperado > precioNormal + 0.01 &&
    precioUnitario > precioNormal + 0.01 &&
    precioUnitario <= precioDobleEsperado + 0.02
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
