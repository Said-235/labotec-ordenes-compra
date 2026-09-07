import { assertAdminSession, getSupabaseAdmin } from '../adminContext.js'
import { CATEGORIA_KEYS, SIGNED_URL_EXPIRY } from '../../lib/constants.js'
import { fetchCategoriasDesdeBd, mapCategorias, nombreCategoria } from '../../lib/categorias.js'
import {
  generateOrdenGeneralPDF,
  getOrdenGeneralPdfPath,
} from '../../lib/pdfGenerator.js'
import { calcularTotalesOrden } from '../../lib/pricing.js'
import { isValidEmail, sanitizeText, validateDatosFiscales } from '../../lib/validation.js'

const CATEGORIAS_ORDEN_GENERAL = CATEGORIA_KEYS

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100 || 0
}

/**
 * Órdenes de cliente elegibles para incluir en una orden general.
 */
async function fetchOrdenesElegibles(admin) {
  const { data, error } = await admin
    .from('ordenes')
    .select(`
      id,
      categoria,
      status,
      payment_confirmed_at,
      creado_en,
      detalle_orden (
        cantidad,
        producto_id,
        productos (id, codigo, descripcion, clase, categoria, precio_base)
      )
    `)
    .eq('status', 'pagada')
    .in('categoria', CATEGORIAS_ORDEN_GENERAL)
    .is('incluido_en_orden_general_id', null)
    .order('payment_confirmed_at', { ascending: false })

  if (error) {
    console.error('[ordenGeneral.elegibles]', error.code, error.message)
    if (/incluido_en_orden_general|ordenes_generales/i.test(error.message ?? '')) {
      throw new Error(
        'Falta aplicar la migración de órdenes generales en la base de datos. Ejecute el SQL de supabase/migrations/20260806_ordenes_generales.sql',
      )
    }
    throw new Error('No se pudieron cargar las órdenes pagadas')
  }

  return data ?? []
}

/**
 * Agrega cantidades por producto (fallback codigo+categoria) y calcula importes a precio base.
 */
export function agregarLineasDesdeOrdenes(ordenes) {
  const map = new Map()

  for (const orden of ordenes) {
    for (const detalle of orden.detalle_orden ?? []) {
      const producto = detalle.productos ?? {}
      const productoId = detalle.producto_id ?? producto.id ?? null
      const codigo = producto.codigo ?? '—'
      const categoria = producto.categoria ?? orden.categoria
      const key = productoId ? `id:${productoId}` : `code:${codigo}|${categoria}`
      const precioBase = roundMoney(producto.precio_base)
      const cantidad = Number(detalle.cantidad) || 0

      const existing = map.get(key)
      if (existing) {
        existing.cantidad += cantidad
        existing.subtotal = roundMoney(existing.precio_base_unitario * existing.cantidad)
      } else {
        map.set(key, {
          producto_id: productoId,
          codigo,
          descripcion: producto.descripcion ?? '—',
          clase: producto.clase ?? '—',
          categoria,
          cantidad,
          precio_base_unitario: precioBase,
          subtotal: roundMoney(precioBase * cantidad),
        })
      }
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      String(a.categoria).localeCompare(String(b.categoria)) ||
      String(a.codigo).localeCompare(String(b.codigo)),
  )
}

/**
 * Desglose por categoría y por clase a partir de líneas agregadas.
 */
export function desglosarLineasOrdenGeneral(lineas, categoriaMap = {}) {
  const porCategoriaMap = new Map()
  const porClaseMap = new Map()

  for (const linea of lineas) {
    const catKey = linea.categoria || '—'
    const claseKey = linea.clase || '—'

    const cat = porCategoriaMap.get(catKey) || {
      categoria: catKey,
      nombre: nombreCategoria(catKey, categoriaMap),
      lineas: 0,
      unidades: 0,
      subtotal: 0,
    }
    cat.lineas += 1
    cat.unidades += Number(linea.cantidad) || 0
    cat.subtotal = roundMoney(cat.subtotal + (Number(linea.subtotal) || 0))
    porCategoriaMap.set(catKey, cat)

    const clase = porClaseMap.get(claseKey) || {
      clase: claseKey,
      lineas: 0,
      unidades: 0,
      subtotal: 0,
    }
    clase.lineas += 1
    clase.unidades += Number(linea.cantidad) || 0
    clase.subtotal = roundMoney(clase.subtotal + (Number(linea.subtotal) || 0))
    porClaseMap.set(claseKey, clase)
  }

  const porCategoria = [...porCategoriaMap.values()]
    .map((row) => {
      const totales = calcularTotalesOrden(row.subtotal, { incluirEnvio: false })
      return {
        ...row,
        iva: totales.iva,
        total: totales.total,
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const porClase = [...porClaseMap.values()]
    .map((row) => {
      const totales = calcularTotalesOrden(row.subtotal, { incluirEnvio: false })
      return {
        ...row,
        iva: totales.iva,
        total: totales.total,
      }
    })
    .sort((a, b) => a.clase.localeCompare(b.clase))

  return { porCategoria, porClase }
}

function resumenDesdeOrdenes(ordenes, categoriaMap = {}) {
  const lineas = agregarLineasDesdeOrdenes(ordenes)
  let ultimaCompraConfirmada = null

  for (const orden of ordenes) {
    if (!orden.payment_confirmed_at) continue
    if (
      !ultimaCompraConfirmada ||
      new Date(orden.payment_confirmed_at) > new Date(ultimaCompraConfirmada)
    ) {
      ultimaCompraConfirmada = orden.payment_confirmed_at
    }
  }

  const totalUnidades = lineas.reduce((sum, l) => sum + l.cantidad, 0)
  const subtotal = roundMoney(lineas.reduce((sum, l) => sum + (Number(l.subtotal) || 0), 0))
  const totales = calcularTotalesOrden(subtotal, { incluirEnvio: false })
  const desglose = desglosarLineasOrdenGeneral(lineas, categoriaMap)

  return {
    ordenes,
    ordenIds: ordenes.map((o) => o.id),
    lineas,
    ultimaCompraConfirmada,
    totalOrdenes: ordenes.length,
    totalLineas: lineas.length,
    totalUnidades,
    subtotal: totales.subtotal,
    iva: totales.iva,
    total: totales.total,
    desglosePorCategoria: desglose.porCategoria,
    desglosePorClase: desglose.porClase,
  }
}

/**
 * Vista previa de lo que entraría en la próxima orden general.
 */
export async function previewOrdenGeneral() {
  await assertAdminSession()
  const admin = getSupabaseAdmin()
  const [ordenes, categoriasRows] = await Promise.all([
    fetchOrdenesElegibles(admin),
    fetchCategoriasDesdeBd(admin, { soloActivas: false }),
  ])
  const categoriaMap = mapCategorias(categoriasRows)
  const resumen = resumenDesdeOrdenes(ordenes, categoriaMap)

  return {
    ultimaCompraConfirmada: resumen.ultimaCompraConfirmada,
    totalOrdenes: resumen.totalOrdenes,
    totalLineas: resumen.totalLineas,
    totalUnidades: resumen.totalUnidades,
    ordenIds: resumen.ordenIds,
    lineas: resumen.lineas,
    subtotal: resumen.subtotal,
    iva: resumen.iva,
    total: resumen.total,
    desglosePorCategoria: resumen.desglosePorCategoria,
    desglosePorClase: resumen.desglosePorClase,
    categorias: CATEGORIAS_ORDEN_GENERAL,
  }
}

function validarDatosFormato(datosFormato = {}) {
  const nombre = sanitizeText(datosFormato.nombre, 200)
  const email = sanitizeText(datosFormato.email, 254).toLowerCase()
  const folio = sanitizeText(datosFormato.folio, 80) || null

  const errors = {}
  if (!nombre) errors.nombre = 'El nombre de contacto es requerido'
  if (!email) {
    errors.email = 'El correo es requerido'
  } else if (!isValidEmail(email)) {
    errors.email = 'Formato de correo inválido'
  }

  const { errors: fiscalErrors, sanitized } = validateDatosFiscales(datosFormato)

  return {
    errors: { ...errors, ...fiscalErrors },
    sanitized: {
      folio,
      nombre,
      email,
      ...sanitized,
    },
  }
}

/**
 * Genera la orden general: persiste, marca órdenes, sube PDF.
 */
export async function generarOrdenGeneral({ datosFormato } = {}) {
  const { user } = await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { errors, sanitized } = validarDatosFormato(datosFormato)
  if (Object.keys(errors).length > 0) {
    const first = Object.values(errors)[0]
    const err = new Error(first || 'Datos del formato incompletos')
    err.status = 400
    throw err
  }

  const ordenes = await fetchOrdenesElegibles(admin)
  if (ordenes.length === 0) {
    throw new Error('No hay órdenes pagadas pendientes de incluir en una orden general')
  }

  const categoriasRows = await fetchCategoriasDesdeBd(admin, { soloActivas: false })
  const categoriaMap = mapCategorias(categoriasRows)
  const resumen = resumenDesdeOrdenes(ordenes, categoriaMap)
  const ahora = new Date().toISOString()

  const { data: ordenGeneral, error: insertError } = await admin
    .from('ordenes_generales')
    .insert({
      folio: sanitized.folio,
      nombre: sanitized.nombre,
      email: sanitized.email,
      telefono: sanitized.telefono,
      razon_social: sanitized.razon_social,
      rfc: sanitized.rfc,
      direccion_fiscal: sanitized.direccion_fiscal,
      correo_facturacion: sanitized.correo_facturacion,
      envio_igual_fiscal: sanitized.envio_igual_fiscal,
      direccion_envio: sanitized.direccion_envio || null,
      ultima_compra_confirmada_en: resumen.ultimaCompraConfirmada,
      total_ordenes: resumen.totalOrdenes,
      total_lineas: resumen.totalLineas,
      total_unidades: resumen.totalUnidades,
      subtotal: resumen.subtotal,
      iva: resumen.iva,
      total: resumen.total,
      creado_por: user.id,
      creado_en: ahora,
    })
    .select('id, folio, creado_en')
    .single()

  if (insertError || !ordenGeneral) {
    console.error('[ordenGeneral.generar.insert]', insertError?.code, insertError?.message)
    if (/ordenes_generales|incluido_en_orden_general/i.test(insertError?.message ?? '')) {
      throw new Error(
        'Falta aplicar la migración de órdenes generales en la base de datos. Ejecute el SQL de supabase/migrations/20260806_ordenes_generales.sql',
      )
    }
    if (/subtotal|iva|precio_base_unitario/i.test(insertError?.message ?? '')) {
      throw new Error(
        'Falta aplicar la migración de totales de órdenes generales. Ejecute el SQL de supabase/migrations/20260806_ordenes_generales_totales.sql',
      )
    }
    throw new Error('No se pudo crear la orden general')
  }

  const detalleRows = resumen.lineas.map((l) => ({
    orden_general_id: ordenGeneral.id,
    producto_id: l.producto_id,
    codigo: l.codigo,
    descripcion: l.descripcion,
    clase: l.clase,
    categoria: l.categoria,
    cantidad: l.cantidad,
    precio_base_unitario: l.precio_base_unitario,
    subtotal: l.subtotal,
  }))

  const { error: detalleError } = await admin.from('ordenes_generales_detalle').insert(detalleRows)

  if (detalleError) {
    console.error('[ordenGeneral.generar.detalle]', detalleError.code, detalleError.message)
    await admin.from('ordenes_generales').delete().eq('id', ordenGeneral.id)
    if (/precio_base_unitario|subtotal/i.test(detalleError.message ?? '')) {
      throw new Error(
        'Falta aplicar la migración de totales de órdenes generales. Ejecute el SQL de supabase/migrations/20260806_ordenes_generales_totales.sql',
      )
    }
    throw new Error('No se pudo guardar el detalle de la orden general')
  }

  const { error: markError } = await admin
    .from('ordenes')
    .update({ incluido_en_orden_general_id: ordenGeneral.id })
    .in('id', resumen.ordenIds)
    .is('incluido_en_orden_general_id', null)

  if (markError) {
    console.error('[ordenGeneral.generar.mark]', markError.code, markError.message)
    await admin.from('ordenes_generales').delete().eq('id', ordenGeneral.id)
    throw new Error('No se pudieron asociar las órdenes de cliente a la orden general')
  }

  const meta = {
    folio: sanitized.folio,
    creado_en: ordenGeneral.creado_en ?? ahora,
    ultima_compra_confirmada_en: resumen.ultimaCompraConfirmada,
    total_ordenes: resumen.totalOrdenes,
    nombre: sanitized.nombre,
    email: sanitized.email,
    telefono: sanitized.telefono,
    razon_social: sanitized.razon_social,
    rfc: sanitized.rfc,
    direccion_fiscal: sanitized.direccion_fiscal,
    correo_facturacion: sanitized.correo_facturacion,
    envio_igual_fiscal: sanitized.envio_igual_fiscal,
    direccion_envio: sanitized.direccion_envio,
    subtotal: resumen.subtotal,
    iva: resumen.iva,
    total: resumen.total,
    desglosePorCategoria: resumen.desglosePorCategoria,
    desglosePorClase: resumen.desglosePorClase,
  }

  const blob = generateOrdenGeneralPDF({
    meta,
    detalles: resumen.lineas,
    categoriaMap,
  })

  const path = getOrdenGeneralPdfPath(ordenGeneral.id)

  const { error: uploadError } = await admin.storage.from('documentos').upload(path, blob, {
    contentType: 'application/pdf',
    upsert: true,
  })

  if (uploadError) {
    console.error('[ordenGeneral.generar.upload]', uploadError.message)
    throw new Error('Se creó la orden general pero no se pudo subir el PDF')
  }

  await admin.from('ordenes_generales').update({ pdf_url: path }).eq('id', ordenGeneral.id)

  const { data: signedData, error: signedError } = await admin.storage
    .from('documentos')
    .createSignedUrl(path, SIGNED_URL_EXPIRY)

  if (signedError || !signedData?.signedUrl) {
    throw new Error('Se creó la orden general pero no se pudo firmar la URL del PDF')
  }

  return {
    id: ordenGeneral.id,
    folio: ordenGeneral.folio,
    creado_en: ordenGeneral.creado_en ?? ahora,
    ultimaCompraConfirmada: resumen.ultimaCompraConfirmada,
    totalOrdenes: resumen.totalOrdenes,
    totalLineas: resumen.totalLineas,
    totalUnidades: resumen.totalUnidades,
    subtotal: resumen.subtotal,
    iva: resumen.iva,
    total: resumen.total,
    pdfUrl: signedData.signedUrl,
    pdfPath: path,
  }
}

/**
 * Historial de órdenes generales generadas.
 */
export async function listarOrdenesGenerales() {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('ordenes_generales')
    .select(
      `
      id,
      folio,
      nombre,
      email,
      razon_social,
      rfc,
      ultima_compra_confirmada_en,
      total_ordenes,
      total_lineas,
      total_unidades,
      subtotal,
      iva,
      total,
      pdf_url,
      creado_en
    `,
    )
    .order('creado_en', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[ordenGeneral.list]', error.code, error.message)
    if (/ordenes_generales/i.test(error.message ?? '')) {
      throw new Error(
        'Falta aplicar la migración de órdenes generales en la base de datos. Ejecute el SQL de supabase/migrations/20260806_ordenes_generales.sql',
      )
    }
    throw new Error('No se pudieron cargar las órdenes generales')
  }

  return data ?? []
}

/**
 * URL firmada del PDF de una orden general.
 */
export async function getOrdenGeneralPdfUrl(ordenGeneralId) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const id = sanitizeText(ordenGeneralId, 80)
  if (!id) throw new Error('Orden general no válida')

  const { data: row, error } = await admin
    .from('ordenes_generales')
    .select('id, pdf_url')
    .eq('id', id)
    .single()

  if (error || !row) {
    throw new Error('Orden general no encontrada')
  }

  const path = row.pdf_url || getOrdenGeneralPdfPath(row.id)
  const { data: signedData, error: signedError } = await admin.storage
    .from('documentos')
    .createSignedUrl(path, SIGNED_URL_EXPIRY)

  if (signedError || !signedData?.signedUrl) {
    throw new Error('No se pudo abrir el PDF de la orden general')
  }

  return signedData.signedUrl
}
