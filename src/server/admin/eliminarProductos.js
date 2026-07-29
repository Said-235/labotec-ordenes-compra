import { assertAdminSession, getSupabaseAdmin } from '../adminContext.js'

export async function productoEnOrdenes(admin, productoId) {
  const { count, error } = await admin
    .from('detalle_orden')
    .select('id', { count: 'exact', head: true })
    .eq('producto_id', productoId)

  if (error) throw new Error('No se pudo verificar el historial de órdenes')
  return (count ?? 0) > 0
}

async function eliminarUnProducto(admin, productoId) {
  const enOrdenes = await productoEnOrdenes(admin, productoId)
  if (enOrdenes) {
    return { ok: false, productoId, razon: 'en_ordenes' }
  }

  const { data: producto } = await admin
    .from('productos')
    .select('codigo')
    .eq('id', productoId)
    .maybeSingle()

  const { error } = await admin.from('productos').delete().eq('id', productoId)

  if (error) {
    return { ok: false, productoId, codigo: producto?.codigo, razon: 'error_bd' }
  }

  return { ok: true, productoId, codigo: producto?.codigo }
}

function resumirEliminacion(resultados) {
  const eliminados = resultados.filter((r) => r.ok)
  const enOrdenes = resultados.filter((r) => !r.ok && r.razon === 'en_ordenes')
  const errores = resultados.filter((r) => !r.ok && r.razon === 'error_bd')

  return {
    eliminados: eliminados.length,
    enOrdenes: enOrdenes.length,
    errores: errores.length,
    detalleEnOrdenes: enOrdenes,
    detalleErrores: errores,
  }
}

export async function eliminarProducto(productoId) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const resultado = await eliminarUnProducto(admin, productoId)

  if (!resultado.ok) {
    if (resultado.razon === 'en_ordenes') {
      throw new Error(
        'No se puede eliminar: el producto aparece en órdenes existentes. Desactívelo en su lugar.',
      )
    }
    throw new Error('No se pudo eliminar el producto')
  }

  return resultado
}

export async function eliminarProductosLote(productoIds) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const ids = [...new Set(productoIds)].filter(Boolean)

  if (!ids.length) {
    throw new Error('Seleccione al menos un producto')
  }

  const resultados = []
  for (const id of ids) {
    resultados.push(await eliminarUnProducto(admin, id))
  }

  const resumen = resumirEliminacion(resultados)

  if (resumen.eliminados === 0 && resumen.enOrdenes > 0) {
    throw new Error(
      'Ningún producto pudo eliminarse: todos aparecen en órdenes existentes.',
    )
  }

  return resumen
}

export async function eliminarProductosPorCarga(logCargaId) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data: log, error: logError } = await admin
    .from('log_cargas')
    .select('id, nombre_archivo, producto_ids')
    .eq('id', logCargaId)
    .single()

  if (logError || !log) {
    throw new Error('Registro de carga no encontrado')
  }

  const productoIds = Array.isArray(log.producto_ids) ? log.producto_ids : []

  if (!productoIds.length) {
    throw new Error(
      'Esta carga no tiene productos registrados para eliminar. Solo aplica a cargas nuevas.',
    )
  }

  const resultados = []
  for (const id of productoIds) {
    resultados.push(await eliminarUnProducto(admin, id))
  }

  const resumen = resumirEliminacion(resultados)

  await admin
    .from('log_cargas')
    .update({ producto_ids: [] })
    .eq('id', logCargaId)

  return {
    ...resumen,
    nombreArchivo: log.nombre_archivo,
    totalProcesados: productoIds.length,
  }
}
