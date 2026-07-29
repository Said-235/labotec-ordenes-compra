/**
 * Indica si el cliente usa la misma dirección fiscal para envío.
 * Por defecto true para perfiles existentes sin el campo.
 */
export function esEnvioIgualFiscal(datosFiscales = {}) {
  return datosFiscales.envio_igual_fiscal !== false
}

/**
 * Dirección efectiva de envío según preferencia del cliente.
 */
export function getDireccionEnvio(datosFiscales = {}) {
  if (esEnvioIgualFiscal(datosFiscales)) {
    return datosFiscales.direccion_fiscal ?? ''
  }
  return datosFiscales.direccion_envio ?? ''
}
