/** Ventana en la que el proveedor no recibe pedidos: del 25 al 5 inclusive. */
export const DIA_INICIO_VENTANA_CORTE = 25
export const DIA_FIN_VENTANA_CORTE = 5
/** Día del mes en que se concentra el pedido general al proveedor. */
export const DIA_CORTE_PEDIDOS = 24

/**
 * Fecha de referencia. Con ?simularCorte=1 en la URL se simula el día 25
 * para previsualizar el aviso fuera de la ventana real.
 */
function getFechaReferencia(fecha) {
  if (fecha) return fecha

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('simularCorte') === '1') {
        const now = new Date()
        return new Date(now.getFullYear(), now.getMonth(), DIA_INICIO_VENTANA_CORTE)
      }
    } catch {
      // ignore
    }
  }

  return new Date()
}

/**
 * ¿Está la fecha en la ventana del 25 al 5 (fin de mes → inicio del siguiente)?
 */
export function esVentanaMantenimientoCorte(fecha) {
  const dia = getFechaReferencia(fecha).getDate()
  return dia >= DIA_INICIO_VENTANA_CORTE || dia <= DIA_FIN_VENTANA_CORTE
}

/**
 * Próximo corte de pedidos (día 24) aplicable tras la ventana de mantenimiento.
 * - Del 25 al último día del mes → corte = 24 del mes siguiente
 * - Del 1 al 5 → corte = 24 del mes actual
 */
export function getFechaProximoCorte(fecha) {
  const ref = getFechaReferencia(fecha)
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const dia = d.getDate()

  if (dia >= DIA_INICIO_VENTANA_CORTE) {
    return new Date(d.getFullYear(), d.getMonth() + 1, DIA_CORTE_PEDIDOS)
  }

  if (dia <= DIA_FIN_VENTANA_CORTE) {
    return new Date(d.getFullYear(), d.getMonth(), DIA_CORTE_PEDIDOS)
  }

  if (dia <= DIA_CORTE_PEDIDOS) {
    return new Date(d.getFullYear(), d.getMonth(), DIA_CORTE_PEDIDOS)
  }

  return new Date(d.getFullYear(), d.getMonth() + 1, DIA_CORTE_PEDIDOS)
}

export function formatFechaCorte(fecha) {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fecha)
}

/**
 * Texto de aviso para el cliente durante la ventana de mantenimiento.
 */
export function getMensajeAvisoCorte(fecha) {
  if (!esVentanaMantenimientoCorte(fecha)) return null

  return (
    `Por tema de mantenimiento de la página, los pedidos registrados entre el día ${DIA_INICIO_VENTANA_CORTE} ` +
    `y el día ${DIA_FIN_VENTANA_CORTE} se procesan en el siguiente corte de pedidos.\n\n` +
    `Su pedido sí se registrará ahora y quedará programado para ese corte.`
  )
}

export function getResumenAvisoCorte(fecha) {
  if (!esVentanaMantenimientoCorte(fecha)) return null

  return (
    `Mantenimiento de pedidos: del día ${DIA_INICIO_VENTANA_CORTE} al ${DIA_FIN_VENTANA_CORTE} ` +
    `su pedido se procesará en el siguiente corte.`
  )
}
