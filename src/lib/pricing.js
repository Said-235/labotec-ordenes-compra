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

export function formatMXN(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(Number(amount) || 0)
}
