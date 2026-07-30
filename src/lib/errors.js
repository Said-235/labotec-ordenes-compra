const DEFAULT_FALLBACK =
  'Ocurrió un error inesperado. Inténtelo de nuevo o contacte al administrador.'

/** Mensajes lanzados explícitamente en la aplicación (texto completo). */
const EXACT_USER_MESSAGES = new Set([
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
  'La descripción es requerida',
  'Clase inválida',
  'Categoría inválida',
  'Precio base inválido',
  'Ya existe un producto con ese código en la misma categoría',
  'Calibrador y Control requieren un grupo de prueba',
  'Seleccione al menos un producto',
  'No se pudieron guardar los cambios',
  'El nombre de contacto es requerido',
  'No puede desactivar su propia cuenta',
  'Debe haber al menos un administrador activo',
  'La contraseña debe tener al menos 12 caracteres',
  'La contraseña debe incluir mayúsculas, minúsculas y números',
  'La contraseña debe incluir mayúsculas',
  'La contraseña debe tener al menos 8 caracteres',
  'No se pudo crear el administrador',
  'Administrador no encontrado',
  'No puede modificar la contraseña del administrador principal',
  'No se puede desactivar al administrador principal',
  'No puede modificar los datos del administrador principal',
  'Use la sección Administradores para cuentas de administración',
  'Solo puede cancelar órdenes pendientes de pago',
  'No se pudo cancelar la orden',
  'No se pudo verificar el comprobante de pago',
  'La dirección de envío es requerida',
  'No se pudo procesar ningún producto',
  'El archivo no contiene filas válidas',
  'El archivo no contiene filas válidas para procesar',
  'El carrito está vacío',
  'Complete sus datos fiscales antes de confirmar una orden',
  'No se pudo obtener el aumento del cliente',
  'Cantidad inválida en el carrito',
  'No se pudieron validar los productos',
  'Algunos productos del carrito ya no existen',
  'Categoría de producto inválida',
  'No se pudo crear la orden',
  'No se pudo registrar el detalle de la orden',
  'Seleccione un archivo',
  'El archivo supera el límite de 10 MB',
  'Esta orden ya tiene un comprobante validado',
  'No se pudo subir el comprobante',
  'No se pudo registrar el comprobante',
  'No se pudo abrir el comprobante',
  'No se pudo cargar su perfil de usuario',
  'No se pudieron guardar los datos fiscales',
  'Seleccione un archivo ODS o XLSX',
  'Formato no soportado. Use archivos ODS o XLSX',
  'El archivo no contiene hojas de cálculo',
  'No se encontraron las columnas Codigo, Descripcion, Clase y Costo',
  'Registro de carga no encontrado',
  'No se pudo eliminar el producto',
  'No se pudo verificar el historial de órdenes',
  'No se pudieron eliminar los comprobantes del cliente',
  'No se pudo eliminar el detalle de órdenes del cliente',
  'No se pudieron eliminar las órdenes del cliente',
  'No se pudo verificar el administrador principal',
  'No hay cambios para guardar',
  'No se pudo crear el producto',
  'No se pudo actualizar el producto',
  'Cliente no encontrado',
  'No se pudo desactivar el cliente',
  'No se pudo desactivar el cliente: la base de datos rechaza el cambio de estado (revise triggers en la tabla clientes).',
  'No se pudo reactivar el cliente',
  'Conflicto al insertar producto (código duplicado)',
  'Indique el motivo del rechazo (mínimo 5 caracteres)',
  'El sistema no está configurado correctamente. Contacte al administrador.',
])

/** Mensajes compuestos o con datos dinámicos (prefijo reconocible). */
const USER_MESSAGE_PREFIXES = [
  'Restricción Reactivo → Calibrador/Control:',
  'No se puede eliminar:',
  'No puede cancelar esta orden:',
  'Productos no disponibles:',
  'No se pudo procesar ningún producto del archivo.',
  'Para agregar "',
  'No puede quitar este Reactivo:',
  'El Calibrador',
  'El Control',
  'Ningún producto pudo eliminarse:',
  'Esta carga no tiene productos registrados',
  'Está en "',
  'No se pudo mover de "',
  'El producto ',
  'Reactivo, Calibrador y Control requieren grupo de prueba',
]

const TECHNICAL_PATTERNS = [
  /supabase/i,
  /postgres/i,
  /row-level security/i,
  /\brls\b/i,
  /\bjwt\b/i,
  /failed to fetch/i,
  /networkerror/i,
  /network request failed/i,
  /authretryablefetcherror/i,
  /vite_/i,
  /\.env/i,
  /sql editor/i,
  /check constraint/i,
  /violates/i,
  /pgrst/i,
  /\b235\d{2}\b/,
  /json object requested/i,
  /invalid api key/i,
  /service_role/i,
]

function isTechnicalMessage(message) {
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(message))
}

function mapAuthError(message) {
  if (message.includes('Invalid login credentials')) {
    return 'Correo o contraseña incorrectos'
  }
  if (message.includes('Email not confirmed')) {
    return 'Confirme su correo electrónico antes de iniciar sesión'
  }
  if (message.includes('Too many requests')) {
    return 'Demasiados intentos. Espere un momento e inténtelo de nuevo'
  }
  if (message.includes('User already registered')) {
    return 'Ese correo ya está registrado'
  }
  return null
}

function mapNetworkError(message) {
  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Network request failed') ||
    message.includes('AuthRetryableFetchError') ||
    message.includes('Load failed')
  ) {
    return 'No se pudo conectar con el servidor. Verifique su conexión a internet e inténtelo de nuevo.'
  }
  return null
}

function isUserFacingMessage(message) {
  if (EXACT_USER_MESSAGES.has(message)) return true
  return USER_MESSAGE_PREFIXES.some((prefix) => message.startsWith(prefix))
}

/**
 * Convierte errores internos en mensajes seguros para el cliente.
 * Nunca expone stack traces, códigos de base de datos ni detalles técnicos.
 */
export function getSafeErrorMessage(error, fallback = DEFAULT_FALLBACK) {
  if (!error) return fallback

  const message = (error.message || String(error)).trim()
  if (!message) return fallback

  if (import.meta.env.DEV) {
    console.error('[app error]', error)
  }

  const authMessage = mapAuthError(message)
  if (authMessage) return authMessage

  const networkMessage = mapNetworkError(message)
  if (networkMessage) return networkMessage

  if (isTechnicalMessage(message)) return fallback

  if (isUserFacingMessage(message)) return message

  return fallback
}

/**
 * Sanitiza mensajes de error por fila (p. ej. carga ODS) antes de mostrarlos.
 */
export function sanitizeRowErrorMessage(message, fallback = 'No se pudo procesar este producto') {
  const text = String(message ?? '').trim()
  if (!text) return fallback
  if (isTechnicalMessage(text)) return fallback
  if (isUserFacingMessage(text)) return text
  return fallback
}
