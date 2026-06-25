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
    'Este comprobante ya fue rechazado',
    'Indique el motivo del rechazo',
    'No se pudo rechazar el comprobante',
    'No se pudo reemplazar el comprobante rechazado',
    'La orden no está pendiente de pago',
    'Ese correo ya está registrado',
    'El nombre es requerido',
    'Nivel inválido',
    'Porcentaje inválido (0–99.99)',
    'El código es requerido',
    'Clase inválida',
    'Categoría inválida',
    'Precio base inválido',
    'Ya existe un producto con ese código en la misma categoría',
    'Calibrador y Control requieren un grupo de prueba',
    'no tiene grupo de prueba asignado',
    'grupo de prueba',
    'No se puede eliminar',
    'en órdenes existentes',
    'Seleccione al menos un producto',
    'No se pudieron guardar los cambios',
    'El nombre de contacto es requerido',
    'No puede desactivar su propia cuenta',
    'Debe haber al menos un administrador activo',
    'La contraseña debe tener al menos 12 caracteres',
    'La contraseña debe incluir mayúsculas',
    'No se pudo crear el administrador',
    'Administrador no encontrado',
    'Solo puede cancelar órdenes pendientes de pago',
    'No puede cancelar esta orden',
    'No se pudo cancelar la orden',
    'No se pudo verificar el comprobante de pago',
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
