import { assertAdminSession, getSupabaseAdmin } from '../supabaseAdmin'
import { parseODSFile } from '../odsParser'
import { sanitizeText } from '../validation'

/**
 * Procesa carga masiva de productos desde ODS/XLSX.
 * Verifica sesión admin y usa service role para bypass RLS.
 */
export async function procesarCargaODS(file, categoria) {
  const { user } = await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { validRows, errors, totalFilas } = await parseODSFile(file, categoria)

  let insertados = 0
  let actualizados = 0

  for (const row of validRows) {
    const { data: existing, error: lookupError } = await admin
      .from('productos')
      .select('id')
      .eq('codigo', row.codigo)
      .eq('categoria', row.categoria)
      .maybeSingle()

    if (lookupError) {
      errors.push({
        fila: null,
        codigo: row.codigo,
        mensaje: 'Error al consultar producto existente',
      })
      continue
    }

    if (existing) {
      const { error: updateError } = await admin
        .from('productos')
        .update({
          descripcion: row.descripcion,
          precio_base: row.precio_base,
          activo: true,
        })
        .eq('id', existing.id)

      if (updateError) {
        errors.push({
          fila: null,
          codigo: row.codigo,
          mensaje: 'Error al actualizar producto',
        })
      } else {
        actualizados += 1
      }
    } else {
      const { error: insertError } = await admin.from('productos').insert({
        codigo: row.codigo,
        descripcion: row.descripcion,
        clase: row.clase,
        categoria: row.categoria,
        precio_base: row.precio_base,
        activo: true,
      })

      if (insertError) {
        errors.push({
          fila: null,
          codigo: row.codigo,
          mensaje: 'Error al insertar producto',
        })
      } else {
        insertados += 1
      }
    }
  }

  const detalleErrores = errors.slice(0, 100).map((e) => ({
    fila: e.fila,
    codigo: e.codigo,
    mensaje: e.mensaje,
  }))

  const { error: logError } = await admin.from('log_cargas').insert({
    admin_id: user.id,
    categoria,
    nombre_archivo: sanitizeText(file.name, 255),
    total_filas: totalFilas,
    insertados,
    actualizados,
    errores: errors.length,
    detalle_errores: detalleErrores.length ? detalleErrores : null,
  })

  if (logError) {
    throw new Error('La carga se procesó pero no se pudo registrar el log')
  }

  return {
    totalFilas,
    insertados,
    actualizados,
    errores: errors.length,
    detalleErrores,
  }
}

/**
 * Obtiene historial de cargas ODS (solo admin).
 */
export async function obtenerLogCargas(limit = 50) {
  await assertAdminSession()
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('log_cargas')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(limit)

  if (error) throw new Error('No se pudo cargar el historial de cargas')
  return data
}
