export const CATEGORIAS = {
  banco_sangre: 'Banco de sangre',
  inmuno: 'Inmuno',
  quimica_clinica: 'Química clínica',
}

export const CATEGORIA_KEYS = Object.keys(CATEGORIAS)

export const CLASES_PRODUCTO = [
  'Reactivo',
  'Calibrador',
  'Control',
  'Consumible',
  'MCC',
]

export const NIVELES_CLIENTE = {
  1: 'Estándar',
  2: 'Preferente',
  3: 'Premium',
}

export const MULTIPLICADOR_PRECIO_SIN_REACTIVO = 2

export const IVA_RATE = 0.16
export const COSTO_ENVIO = 1000

export const MAX_CANTIDAD_CARRITO = 99

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export const ALLOWED_ODS_EXTENSIONS = ['.ods', '.xlsx', '.xls']

export const ORDER_STATUS = {
  pendiente: 'Pendiente',
  pagada: 'Pagada',
  cancelada: 'Cancelada',
  vencida: 'Vencida',
}

export const ALLOWED_COMPROBANTE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
]

export const ALLOWED_COMPROBANTE_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png']

export const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7
