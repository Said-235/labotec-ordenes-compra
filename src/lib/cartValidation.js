/**
 * Prefijo de prueba: caracteres antes del último guion.
 * Ej: 02G22-25 → 02G22
 */
export function getPrefijoPrueba(codigo) {
  const normalized = String(codigo ?? '').trim()
  const lastDash = normalized.lastIndexOf('-')
  if (lastDash <= 0) return normalized
  return normalized.slice(0, lastDash)
}

/**
 * Valida la regla Reactivo → Calibrador/Control en un conjunto de ítems.
 * Retorna lista de violaciones (vacía = válido).
 */
export function validarRestriccionReactivo(items) {
  const prefijosReactivo = new Set(
    items
      .filter((item) => item.clase === 'Reactivo')
      .map((item) => getPrefijoPrueba(item.codigo)),
  )

  const violaciones = []

  for (const item of items) {
    if (item.clase !== 'Calibrador' && item.clase !== 'Control') continue

    const prefijo = getPrefijoPrueba(item.codigo)
    if (!prefijosReactivo.has(prefijo)) {
      violaciones.push({
        codigo: item.codigo,
        clase: item.clase,
        prefijo,
      })
    }
  }

  return violaciones
}

/**
 * Valida si un producto puede agregarse al carrito (frontend).
 */
export function puedeAgregarAlCarrito(producto, itemsActuales) {
  if (producto.clase !== 'Calibrador' && producto.clase !== 'Control') {
    return { ok: true }
  }

  const prefijo = getPrefijoPrueba(producto.codigo)
  const tieneReactivo = itemsActuales.some(
    (item) =>
      item.clase === 'Reactivo' && getPrefijoPrueba(item.codigo) === prefijo,
  )

  if (!tieneReactivo) {
    return {
      ok: false,
      message: `Para agregar "${producto.codigo}" (${producto.clase}) debe incluir primero un Reactivo con prefijo "${prefijo}" en el carrito.`,
    }
  }

  return { ok: true }
}

/**
 * Verifica si se puede eliminar un Reactivo sin dejar Calibradores/Controles huérfanos.
 */
export function puedeEliminarDelCarrito(item, itemsActuales) {
  if (item.clase !== 'Reactivo') return { ok: true }

  const prefijo = getPrefijoPrueba(item.codigo)
  const dependientes = itemsActuales.filter(
    (i) =>
      i.producto_id !== item.producto_id &&
      (i.clase === 'Calibrador' || i.clase === 'Control') &&
      getPrefijoPrueba(i.codigo) === prefijo,
  )

  if (dependientes.length > 0) {
    const codigos = dependientes.map((d) => d.codigo).join(', ')
    return {
      ok: false,
      message: `No puede quitar este Reactivo: el carrito contiene ${codigos} que dependen del prefijo "${prefijo}".`,
    }
  }

  return { ok: true }
}

export function mensajeViolacionesReactivo(violaciones) {
  if (!violaciones.length) return ''
  const lineas = violaciones.map(
    (v) => `• ${v.codigo} (${v.clase}) requiere un Reactivo con prefijo "${v.prefijo}"`,
  )
  return `Restricción Reactivo → Calibrador/Control:\n${lineas.join('\n')}`
}
