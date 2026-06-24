const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

export function sanitizeText(value, maxLength = 500) {
  if (value == null) return ''
  return String(value).trim().slice(0, maxLength)
}

export function isValidEmail(email) {
  return EMAIL_REGEX.test(sanitizeText(email, 254).toLowerCase())
}

export function isValidRFC(rfc) {
  const normalized = sanitizeText(rfc, 13).toUpperCase().replace(/\s/g, '')
  return RFC_REGEX.test(normalized)
}

export function normalizeRFC(rfc) {
  return sanitizeText(rfc, 13).toUpperCase().replace(/\s/g, '')
}

export function validateLoginInput(email, password) {
  const errors = {}

  const cleanEmail = sanitizeText(email, 254).toLowerCase()
  const cleanPassword = String(password ?? '')

  if (!cleanEmail) {
    errors.email = 'El correo es requerido'
  } else if (!isValidEmail(cleanEmail)) {
    errors.email = 'Formato de correo inválido'
  }

  if (!cleanPassword) {
    errors.password = 'La contraseña es requerida'
  } else if (cleanPassword.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres'
  }

  return { errors, cleanEmail, cleanPassword }
}

export function validateDatosFiscales(data) {
  const errors = {}
  const sanitized = {
    razon_social: sanitizeText(data.razon_social, 200),
    rfc: normalizeRFC(data.rfc),
    direccion_fiscal: sanitizeText(data.direccion_fiscal, 500),
    telefono: sanitizeText(data.telefono, 20),
    correo_facturacion: sanitizeText(data.correo_facturacion, 254).toLowerCase(),
  }

  if (!sanitized.razon_social) {
    errors.razon_social = 'La razón social es requerida'
  }

  if (!sanitized.rfc) {
    errors.rfc = 'El RFC es requerido'
  } else if (!isValidRFC(sanitized.rfc)) {
    errors.rfc = 'Formato de RFC inválido'
  }

  if (!sanitized.direccion_fiscal) {
    errors.direccion_fiscal = 'La dirección fiscal es requerida'
  }

  if (!sanitized.telefono) {
    errors.telefono = 'El teléfono es requerido'
  } else if (!/^[\d\s+\-()]{7,20}$/.test(sanitized.telefono)) {
    errors.telefono = 'Formato de teléfono inválido'
  }

  if (!sanitized.correo_facturacion) {
    errors.correo_facturacion = 'El correo de facturación es requerido'
  } else if (!isValidEmail(sanitized.correo_facturacion)) {
    errors.correo_facturacion = 'Formato de correo inválido'
  }

  return { errors, sanitized }
}

/**
 * Valida nombre de contacto + datos fiscales para actualización de perfil.
 */
export function validatePerfilCliente(data) {
  const nombre = sanitizeText(data.nombre, 200)
  const errors = {}

  if (!nombre) {
    errors.nombre = 'El nombre de contacto es requerido'
  }

  const { errors: fiscalErrors, sanitized: datosFiscales } = validateDatosFiscales(data)

  return {
    errors: { ...errors, ...fiscalErrors },
    sanitized: {
      nombre,
      datos_fiscales: datosFiscales,
    },
  }
}
