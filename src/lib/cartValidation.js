import { sanitizeText } from './validation'

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

/**
 * Valida la regla Reactivo → Calibrador/Control en un conjunto de ítems.
 */
export function validarRestriccionReactivo(items) {
  const clavesReactivo = new Set(
    items
      .filter((item) => item.clase === 'Reactivo')
      .map((item) => getClaveGrupoFromItem(item))
      .filter(Boolean),
  )

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
      continue
    }

    if (!clavesReactivo.has(clave)) {
      violaciones.push({
        codigo: item.codigo,
        clase: item.clase,
        grupo: normalizeGrupoPrueba(item.grupo_prueba),
        categoria: item.categoria,
      })
    }
  }

  return violaciones
}

/**
 * Valida si un producto puede agregarse al carrito (frontend).
 */
export function puedeAgregarAlCarrito(producto, itemsActuales) {
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

  const tieneReactivo = itemsActuales.some(
    (item) => item.clase === 'Reactivo' && getClaveGrupoFromItem(item) === clave,
  )

  if (!tieneReactivo) {
    const grupo = normalizeGrupoPrueba(producto.grupo_prueba)
    return {
      ok: false,
      message: `Para agregar "${producto.codigo}" (${producto.clase}) debe incluir primero un Reactivo del grupo de prueba "${grupo}" en el carrito.`,
    }
  }

  return { ok: true }
}

/**
 * Verifica si se puede eliminar un Reactivo sin dejar Calibradores/Controles huérfanos.
 */
export function puedeEliminarDelCarrito(item, itemsActuales) {
  if (item.clase !== 'Reactivo') return { ok: true }

  const clave = getClaveGrupoFromItem(item)
  if (!clave) return { ok: true }

  const dependientes = itemsActuales.filter(
    (i) =>
      i.producto_id !== item.producto_id &&
      CLASES_REQUIEREN_REACTIVO.includes(i.clase) &&
      getClaveGrupoFromItem(i) === clave,
  )

  if (dependientes.length > 0) {
    const codigos = dependientes.map((d) => d.codigo).join(', ')
    const grupo = normalizeGrupoPrueba(item.grupo_prueba)
    return {
      ok: false,
      message: `No puede quitar este Reactivo: ${codigos} dependen del grupo de prueba "${grupo}".`,
    }
  }

  return { ok: true }
}

export function mensajeViolacionesReactivo(violaciones) {
  if (!violaciones.length) return ''

  const lineas = violaciones.map((v) => {
    if (v.sinGrupo) {
      return `• ${v.codigo} (${v.clase}) no tiene grupo de prueba configurado`
    }
    return `• ${v.codigo} (${v.clase}) requiere un Reactivo del grupo "${v.grupo}"`
  })

  return `Restricción Reactivo → Calibrador/Control:\n${lineas.join('\n')}`
}
