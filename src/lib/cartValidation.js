import { sanitizeText } from './validation.js'
import { MULTIPLICADOR_PRECIO_SIN_REACTIVO } from './constants.js'

export const CLASES_REQUIEREN_REACTIVO = ['Calibrador', 'Control']

/**
 * Normaliza el grupo de prueba para comparación.
 * Ej: "TSH", " glucosa " → "glucosa"
 */
export function normalizeGrupoPrueba(value) {
  const grupo = sanitizeText(value, 100)
  return grupo ? grupo.toLowerCase() : ''
}

/**
 * Clave única de agrupación: categoría + grupo de prueba.
 * Reactivo y Calibrador/Control deben compartir la misma clave.
 */
export function getClaveGrupo(categoria, grupoPrueba) {
  const grupo = normalizeGrupoPrueba(grupoPrueba)
  if (!grupo || !categoria) return null
  return `${categoria}::${grupo}`
}

export function getClaveGrupoFromItem(item) {
  return getClaveGrupo(item.categoria, item.grupo_prueba)
}

export function etiquetaGrupo(item) {
  const grupo = normalizeGrupoPrueba(item.grupo_prueba)
  if (!grupo) return null
  return `${grupo} (${item.categoria})`
}

export function tieneReactivoMismoGrupo(producto, itemsActuales) {
  return cantidadReactivoMismoGrupo(producto, itemsActuales) > 0
}

/**
 * Suma de unidades de Reactivo del mismo grupo (categoría + grupo_prueba).
 */
export function cantidadReactivoMismoGrupo(producto, itemsActuales) {
  const clave = getClaveGrupoFromItem(producto)
  if (!clave) return 0

  return itemsActuales.reduce((sum, item) => {
    if (item.clase !== 'Reactivo') return sum
    if (getClaveGrupoFromItem(item) !== clave) return sum
    return sum + (Number(item.cantidad) || 0)
  }, 0)
}

/**
 * Suma de unidades de la misma clase (Calibrador o Control) del mismo grupo.
 * @param {{ excluirProductoId?: string }} [opciones]
 */
export function cantidadClaseMismoGrupo(producto, itemsActuales, { excluirProductoId } = {}) {
  const clave = getClaveGrupoFromItem(producto)
  if (!clave) return 0

  return itemsActuales.reduce((sum, item) => {
    if (item.clase !== producto.clase) return sum
    if (getClaveGrupoFromItem(item) !== clave) return sum
    if (excluirProductoId && item.producto_id === excluirProductoId) return sum
    return sum + (Number(item.cantidad) || 0)
  }, 0)
}

/**
 * Valida que Calibrador/Control tengan grupo de prueba configurado.
 */
export function validarRestriccionReactivo(items) {
  const violaciones = []

  for (const item of items) {
    if (!CLASES_REQUIEREN_REACTIVO.includes(item.clase)) continue

    const clave = getClaveGrupoFromItem(item)
    if (!clave) {
      violaciones.push({
        codigo: item.codigo,
        clase: item.clase,
        sinGrupo: true,
      })
    }
  }

  return violaciones
}

function resultadoExcedeReactivo(qtyReactivo, totalClaseTrasAgregar, confirmarPrecioDoble) {
  if (totalClaseTrasAgregar <= qtyReactivo) {
    return { ok: true }
  }

  if (!confirmarPrecioDoble) {
    return {
      ok: false,
      requiresConfirmacion: true,
      qtyReactivo,
      totalClaseTrasAgregar,
    }
  }

  return {
    ok: true,
    precioDoble: true,
    qtyReactivo,
    totalClaseTrasAgregar,
  }
}

/**
 * Valida si un producto puede agregarse al carrito (frontend).
 * Calibrador/Control: hasta N unidades al precio habitual si hay N Reactivos del mismo grupo;
 * el exceso requiere confirmación de precio ×2.
 */
export function puedeAgregarAlCarrito(
  producto,
  itemsActuales,
  { confirmarPrecioDoble = false, cantidad = 1 } = {},
) {
  if (!CLASES_REQUIEREN_REACTIVO.includes(producto.clase)) {
    return { ok: true }
  }

  const clave = getClaveGrupoFromItem(producto)

  if (!clave) {
    return {
      ok: false,
      message: `El ${producto.clase} "${producto.codigo}" no tiene grupo de prueba asignado. Contacte al administrador para configurarlo.`,
    }
  }

  const qty = Math.max(1, Math.floor(Number(cantidad) || 1))
  const productoId = producto.id ?? producto.producto_id
  const existing = itemsActuales.find((i) => i.producto_id === productoId)
  const qtyTrasAgregar =
    (existing?.cantidad || 0) + qty +
    cantidadClaseMismoGrupo(producto, itemsActuales, { excluirProductoId: productoId })

  const qtyReactivo = cantidadReactivoMismoGrupo(producto, itemsActuales)

  return resultadoExcedeReactivo(qtyReactivo, qtyTrasAgregar, confirmarPrecioDoble)
}

/**
 * Valida un cambio de cantidad en el carrito para Calibrador/Control.
 * Reducir cantidad siempre se permite; aumentar por encima del Reactivo pide confirmación.
 */
export function puedeActualizarCantidad(
  item,
  nuevaCantidad,
  itemsActuales,
  { confirmarPrecioDoble = false } = {},
) {
  if (!CLASES_REQUIEREN_REACTIVO.includes(item.clase)) {
    return { ok: true }
  }

  const clave = getClaveGrupoFromItem(item)
  if (!clave) {
    return {
      ok: false,
      message: `El ${item.clase} "${item.codigo}" no tiene grupo de prueba asignado. Contacte al administrador para configurarlo.`,
    }
  }

  const qty = Math.floor(Number(nuevaCantidad) || 0)
  if (qty <= 0) return { ok: true }

  const otrasMismaClase = cantidadClaseMismoGrupo(item, itemsActuales, {
    excluirProductoId: item.producto_id,
  })
  const totalClaseTrasAgregar = otrasMismaClase + qty
  const qtyReactivo = cantidadReactivoMismoGrupo(item, itemsActuales)

  if (totalClaseTrasAgregar <= qtyReactivo) {
    return { ok: true }
  }

  // Ya estaba en exceso o se reduce: no volver a pedir confirmación
  if (qty <= (item.cantidad || 0)) {
    return { ok: true, precioDoble: true, qtyReactivo, totalClaseTrasAgregar }
  }

  return resultadoExcedeReactivo(qtyReactivo, totalClaseTrasAgregar, confirmarPrecioDoble)
}

export function mensajeConfirmacionPrecioDoble(
  producto,
  precioNormal,
  precioDoble,
  { qtyReactivo = 0, totalClaseTrasAgregar } = {},
) {
  const grupo = normalizeGrupoPrueba(producto.grupo_prueba) || '—'
  const totalClase =
    totalClaseTrasAgregar != null ? totalClaseTrasAgregar : qtyReactivo + 1

  if (qtyReactivo <= 0) {
    return [
      `Puede agregar "${producto.codigo}" (${producto.clase}) sin incluir un Reactivo del grupo "${grupo}" en su carrito.`,
      '',
      `En ese caso, el precio unitario será el doble de su tarifa habitual (×${MULTIPLICADOR_PRECIO_SIN_REACTIVO}):`,
      `• Precio habitual: ${precioNormal}`,
      `• Precio sin Reactivo: ${precioDoble}`,
      '',
      'Si agrega después el Reactivo correspondiente en el mismo carrito (en cantidad igual o mayor), al confirmar la orden se aplicará el precio habitual en las unidades cubiertas.',
      '',
      '¿Desea agregar este producto bajo estas condiciones?',
    ].join('\n')
  }

  return [
    `En su carrito hay ${qtyReactivo} Reactivo(s) del grupo "${grupo}".`,
    `Al agregar "${producto.codigo}" tendría ${totalClase} unidad(es) de ${producto.clase} del mismo grupo.`,
    '',
    `Solo ${qtyReactivo} unidad(es) de ${producto.clase} se cobran a tarifa habitual. El resto se cobra al doble (×${MULTIPLICADOR_PRECIO_SIN_REACTIVO}):`,
    `• Precio habitual: ${precioNormal}`,
    `• Precio por unidad en exceso: ${precioDoble}`,
    '',
    `Si aumenta la cantidad de Reactivo del mismo grupo hasta igualar o superar la de ${producto.clase}, esas unidades volverán al precio habitual al confirmar la orden.`,
    '',
    '¿Desea continuar bajo estas condiciones?',
  ].join('\n')
}

/**
 * Verifica si se puede eliminar un ítem del carrito.
 */
export function puedeEliminarDelCarrito() {
  return { ok: true }
}

export function mensajeViolacionesReactivo(violaciones) {
  if (!violaciones.length) return ''

  const lineas = violaciones.map((v) => {
    if (v.sinGrupo) {
      return `• ${v.codigo} (${v.clase}) no tiene grupo de prueba configurado`
    }
    return `• ${v.codigo} (${v.clase})`
  })

  return `Revise la configuración de estos productos:\n${lineas.join('\n')}`
}
