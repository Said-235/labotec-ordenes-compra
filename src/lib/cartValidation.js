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
  const clave = getClaveGrupoFromItem(producto)
  if (!clave) return false

  return itemsActuales.some(
    (item) => item.clase === 'Reactivo' && getClaveGrupoFromItem(item) === clave,
  )
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

/**
 * Valida si un producto puede agregarse al carrito (frontend).
 */
export function puedeAgregarAlCarrito(producto, itemsActuales, { confirmarPrecioDoble = false } = {}) {
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

  if (tieneReactivoMismoGrupo(producto, itemsActuales)) {
    return { ok: true }
  }

  if (!confirmarPrecioDoble) {
    return { ok: false, requiresConfirmacion: true }
  }

  return { ok: true, precioDoble: true }
}

export function mensajeConfirmacionPrecioDoble(producto, precioNormal, precioDoble) {
  const grupo = normalizeGrupoPrueba(producto.grupo_prueba) || '—'

  return [
    `Puede agregar "${producto.codigo}" (${producto.clase}) sin incluir un Reactivo del grupo "${grupo}" en su carrito.`,
    '',
    `En ese caso, el precio unitario será el doble de su tarifa habitual (×${MULTIPLICADOR_PRECIO_SIN_REACTIVO}):`,
    `• Precio habitual: ${precioNormal}`,
    `• Precio sin Reactivo: ${precioDoble}`,
    '',
    'Si agrega después el Reactivo correspondiente en el mismo carrito, al confirmar la orden se aplicará el precio habitual.',
    '',
    '¿Desea agregar este producto bajo estas condiciones?',
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
