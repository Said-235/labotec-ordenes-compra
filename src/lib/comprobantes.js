import { supabase } from './supabaseClient'
import {
  ALLOWED_COMPROBANTE_EXTENSIONS,
  ALLOWED_COMPROBANTE_TYPES,
  MAX_FILE_SIZE_BYTES,
} from './constants'
import { sanitizeText } from './validation'

function sanitizeFileName(name) {
  const cleaned = String(name ?? 'archivo')
    .replace(/[/\\]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80)
  return `comprobante_${Date.now()}_${cleaned || 'archivo'}`
}

function validateComprobanteFile(file) {
  if (!file) throw new Error('Seleccione un archivo')

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('El archivo supera el límite de 10 MB')
  }

  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
  if (
    !ALLOWED_COMPROBANTE_TYPES.includes(file.type) &&
    !ALLOWED_COMPROBANTE_EXTENSIONS.includes(ext)
  ) {
    throw new Error('Formato no permitido. Use PDF, JPG o PNG')
  }
}

/**
 * Sube comprobante de pago vinculado a una orden pendiente.
 * Ruta Storage: documentos/{cliente_id}/{orden_id}/{nombre_archivo}
 */
export async function subirComprobante(ordenId, file) {
  validateComprobanteFile(file)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error('Sesión no válida')

  const { data: orden, error: ordenError } = await supabase
    .from('ordenes')
    .select('id, status, cliente_id')
    .eq('id', ordenId)
    .eq('cliente_id', user.id)
    .single()

  if (ordenError || !orden) {
    throw new Error('Orden no encontrada')
  }

  if (orden.status !== 'pendiente') {
    throw new Error('Solo puede subir comprobante a órdenes pendientes')
  }

  const { data: existente } = await supabase
    .from('comprobantes')
    .select('id, validado, rechazado, url_archivo')
    .eq('orden_id', ordenId)
    .maybeSingle()

  if (existente) {
    if (existente.validado) {
      throw new Error('Esta orden ya tiene un comprobante validado')
    }
    if (existente.rechazado) {
      await supabase.storage.from('documentos').remove([existente.url_archivo])
      const { error: deleteError } = await supabase
        .from('comprobantes')
        .delete()
        .eq('id', existente.id)

      if (deleteError) {
        throw new Error('No se pudo reemplazar el comprobante rechazado')
      }
    } else {
      throw new Error('Ya hay un comprobante en revisión para esta orden')
    }
  }

  const fileName = sanitizeFileName(file.name)
  const path = `${user.id}/${ordenId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    throw new Error('No se pudo subir el comprobante')
  }

  const { data: comprobante, error: insertError } = await supabase
    .from('comprobantes')
    .insert({
      orden_id: ordenId,
      url_archivo: path,
    })
    .select('id, url_archivo')
    .single()

  if (insertError) {
    await supabase.storage.from('documentos').remove([path])
    throw new Error('No se pudo registrar el comprobante')
  }

  return comprobante
}

/**
 * URL firmada para que el cliente vea su comprobante.
 */
export async function getComprobanteSignedUrl(path) {
  const { data, error } = await supabase.storage
    .from('documentos')
    .createSignedUrl(sanitizeText(path, 500), 3600)

  if (error || !data?.signedUrl) throw new Error('No se pudo abrir el comprobante')
  return data.signedUrl
}
