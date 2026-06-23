/**
 * Convierte errores internos en mensajes seguros para el cliente.
 * Nunca expone stack traces ni detalles de la base de datos.
 */
export function getSafeErrorMessage(error, fallback = 'Ocurrió un error inesperado') {
  if (!error) return fallback

  const knownMessages = [
    'Sesión no válida',
    'Perfil de usuario no encontrado',
    'Cuenta desactivada',
    'Acceso denegado',
    'Credenciales inválidas',
    'Correo o contraseña incorrectos',
    'Complete todos los campos requeridos',
    'Formato de RFC inválido',
    'Formato de correo inválido',
    'Orden no encontrada',
    'Solo puede subir comprobante a órdenes pendientes',
    'Ya hay un comprobante en revisión para esta orden',
    'Formato no permitido. Use PDF, JPG o PNG',
    'Comprobante no encontrado',
    'El comprobante ya fue validado',
    'La orden no está pendiente de pago',
    'Ese correo ya está registrado',
    'El nombre es requerido',
    'Nivel inválido',
    'Porcentaje inválido (0–99.99)',
  ]

  const message = error.message || String(error)

  if (knownMessages.some((known) => message.includes(known))) {
    return message
  }

  if (message.includes('Invalid login credentials')) {
    return 'Correo o contraseña incorrectos'
  }

  if (message.includes('Email not confirmed')) {
    return 'Confirme su correo electrónico antes de iniciar sesión'
  }

  return fallback
}
