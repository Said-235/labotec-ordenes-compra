import { assertAdminSession, getSupabaseAdmin } from '../supabaseAdmin'
import { eliminarProductosPorCarga, productoEnOrdenes } from './eliminarProductos'

export { eliminarProductosPorCarga }
import { nombreCategoria } from '../categorias'
import { listarCategorias, obtenerClavesCategoriasActivas } from './categorias'
import { mapCategorias } from '../categorias'
import {
  deriveGrupoFromCodigo,
  mensajeGrupoPruebaFaltante,
  normalizeCodigo,
  requiereGrupoPrueba,
  resolveGrupoPrueba,
} from '../grupoPrueba'
import { parseODSFile } from '../odsParser'
import { sanitizeRowErrorMessage } from '../errors'
import { sanitizeText } from '../validation'

function variantesCodigo(codigo) {
  const normalizado = normalizeCodigo(codigo)
  const limpio = sanitizeText(codigo, 50)
  return [...new Set([normalizado, limpio].filter(Boolean))]
}

function buildPayload(row, fallbackGrupo = null) {
  let grupo_prueba =
    resolveGrupoPrueba({
      codigo: row.codigo,
      clase: row.clase,
      grupo_prueba: row.grupo_prueba ?? null,
    }) ??
    fallbackGrupo ??
    null

  if (requiereGrupoPrueba(row.clase) && !grupo_prueba) {
    grupo_prueba = deriveGrupoFromCodigo(row.codigo)
  }

  return {
    descripcion: row.descripcion,
    precio_base: row.precio_base,
    clase: row.clase,
    activo: true,
    grupo_prueba,
  }
}

function validarPayload(row, payload) {
  if (requiereGrupoPrueba(row.clase) && !payload.grupo_prueba) {
    return mensajeGrupoPruebaFaltante(row.codigo, row.clase)
  }
  return null
}

function mensajeErrorDb(error, row, categoria, categoriaMap) {
  if (error?.code === '23514') {
    const detalle = error?.message ?? ''
    const catLabel = nombreCategoria(categoria, categoriaMap)

    if (detalle.includes('productos_categoria_check') || detalle.includes('_categoria_check')) {
      return `La categoría "${catLabel}" no está habilitada en el sistema`
    }

    if (requiereGrupoPrueba(row.clase)) {
      return mensajeGrupoPruebaFaltante(row.codigo, row.clase)
    }

    return 'Los datos del producto no cumplen las reglas del sistema (revise clase, categoría y grupo de prueba)'
  }
  if (error?.code === '23505') return null
  return 'No se pudo guardar el producto'
}

function deduplicarFilas(validRows) {
  const porCodigo = new Map()
  for (const row of validRows) {
    porCodigo.set(row.codigo, row)
  }
  return [...porCodigo.values()]
}

function resumirErrores(errors, max = 5) {
  if (!errors.length) return ''
  return errors
    .slice(0, max)
    .map((e) => `${e.codigo}: ${sanitizeRowErrorMessage(e.mensaje)}`)
    .join(' · ')
}

async function buscarEnCategoria(admin, codigo, categoria) {
  for (const term of variantesCodigo(codigo)) {
    const { data, error } = await admin
      .from('productos')
      .select('id, categoria, grupo_prueba, codigo')
      .eq('codigo', term)
      .eq('categoria', categoria)
      .limit(1)

    if (error) {
      return { error: 'No se pudo verificar si el producto ya existe' }
    }

    if (data?.[0]) {
      return { data: data[0] }
    }
  }

  return { data: null }
}

async function listarEnOtrasCategorias(admin, codigo, categoria) {
  const terminos = variantesCodigo(codigo)
  const { data, error } = await admin
    .from('productos')
    .select('id, categoria, grupo_prueba, codigo')
    .in('codigo', terminos)
    .neq('categoria', categoria)

  if (error) {
    return { error: 'No se pudo verificar el producto en otras categorías' }
  }

  return { data: data ?? [] }
}

async function actualizarProducto(admin, id, payload, codigoNormalizado = null) {
  const updateData = codigoNormalizado ? { ...payload, codigo: codigoNormalizado } : payload
  const { error } = await admin.from('productos').update(updateData).eq('id', id)
  return { ok: !error, error }
}

async function insertarProducto(admin, row, payload) {
  return admin
    .from('productos')
    .insert({
      codigo: normalizeCodigo(row.codigo) || row.codigo,
      categoria: row.categoria,
      ...payload,
    })
    .select('id')
    .single()
}

/**
 * Mueve un producto de otra categoría a la categoría del ODS (p. ej. carga en categoría equivocada).
 */
async function reubicarDesdeOtraCategoria(admin, row, otros, categoriaMap) {
  if (otros.length !== 1) {
    return {
      ok: false,
      codigo: row.codigo,
      mensaje:
        otros.length > 1
          ? 'El código existe en varias categorías; elimínelo o edítelo manualmente'
          : 'Conflicto al insertar producto (código duplicado)',
    }
  }

  const [otro] = otros
  const catLabel = nombreCategoria(otro.categoria, categoriaMap)

  try {
    if (await productoEnOrdenes(admin, otro.id)) {
      return {
        ok: false,
        codigo: row.codigo,
        mensaje: `Está en "${catLabel}" y aparece en órdenes; no se puede mover. Desactívelo en Productos si ya no aplica.`,
      }
    }
  } catch {
    return {
      ok: false,
      codigo: row.codigo,
      mensaje: 'No se pudo verificar si el producto tiene órdenes asociadas',
    }
  }

  const payloadMover = buildPayload(row, otro.grupo_prueba)
  const validacion = validarPayload(row, payloadMover)
  if (validacion) {
    return { ok: false, codigo: row.codigo, mensaje: validacion }
  }

  const { error: moveError } = await admin
    .from('productos')
    .update({
      categoria: row.categoria,
      codigo: normalizeCodigo(row.codigo) || row.codigo,
      ...payloadMover,
    })
    .eq('id', otro.id)

  if (moveError) {
    return {
      ok: false,
      codigo: row.codigo,
      mensaje:
        mensajeErrorDb(moveError, row, row.categoria, categoriaMap) ??
        `No se pudo mover de "${catLabel}" a la categoría indicada`,
    }
  }

  return { ok: true, id: otro.id, accion: 'reubicado' }
}

/**
 * Inserta copia en la categoría destino cuando el código ya existe en otra categoría.
 * Si la BD solo permite un código global, reubica como último recurso.
 */
async function insertarCopiaDesdeOtraCategoria(admin, row, otros, categoriaMap) {
  if (!otros.length) {
    return {
      ok: false,
      codigo: row.codigo,
      mensaje: 'Conflicto al insertar producto (código duplicado)',
    }
  }

  const fallbackGrupo = otros.find((p) => p.grupo_prueba)?.grupo_prueba ?? null
  const payloadCopia = buildPayload(row, fallbackGrupo)
  const validacion = validarPayload(row, payloadCopia)
  if (validacion) {
    return { ok: false, codigo: row.codigo, mensaje: validacion }
  }

  const { data: inserted, error: copyError } = await insertarProducto(admin, row, payloadCopia)
  if (!copyError) {
    return { ok: true, id: inserted.id, accion: 'insertado' }
  }

  if (copyError.code === '23505' && otros.length === 1) {
    return reubicarDesdeOtraCategoria(admin, row, otros, categoriaMap)
  }

  return {
    ok: false,
    codigo: row.codigo,
    mensaje: mensajeErrorDb(copyError, row, row.categoria, categoriaMap) ?? 'No se pudo registrar el producto en esta categoría',
  }
}

/**
 * Guarda o actualiza un producto ODS.
 * Mismo código en otra categoría → inserta fila nueva si la BD lo permite;
 * si no, reubica el producto a la categoría del ODS.
 */
async function guardarProductoDesdeOds(admin, row, categoriaMap) {
  const codigoNormalizado = normalizeCodigo(row.codigo) || row.codigo
  const fila = { ...row, codigo: codigoNormalizado }

  const payload = buildPayload(fila)
  const errorValidacion = validarPayload(fila, payload)
  if (errorValidacion) {
    return { ok: false, codigo: fila.codigo, mensaje: errorValidacion }
  }

  const { data: enCategoria, error: lookupError } = await buscarEnCategoria(
    admin,
    fila.codigo,
    fila.categoria,
  )

  if (lookupError) {
    return { ok: false, codigo: fila.codigo, mensaje: lookupError }
  }

  if (enCategoria) {
    const payloadActualizar = buildPayload(fila, enCategoria.grupo_prueba)
    const validacion = validarPayload(fila, payloadActualizar)
    if (validacion) {
      return { ok: false, codigo: fila.codigo, mensaje: validacion }
    }

    const codigoDb = enCategoria.codigo !== codigoNormalizado ? codigoNormalizado : null
    const { ok, error } = await actualizarProducto(
      admin,
      enCategoria.id,
      payloadActualizar,
      codigoDb,
    )
    if (!ok) {
      return {
        ok: false,
        codigo: fila.codigo,
        mensaje: mensajeErrorDb(error, fila, fila.categoria, categoriaMap) ?? 'No se pudo actualizar el producto',
      }
    }
    return { ok: true, id: enCategoria.id, accion: 'actualizado' }
  }

  const { data: inserted, error: insertError } = await insertarProducto(admin, fila, payload)

  if (!insertError) {
    return { ok: true, id: inserted.id, accion: 'insertado' }
  }

  if (insertError.code === '23505') {
    const { data: retryEnCategoria, error: retryLookupError } = await buscarEnCategoria(
      admin,
      fila.codigo,
      fila.categoria,
    )

    if (!retryLookupError && retryEnCategoria) {
      const payloadRetry = buildPayload(fila, retryEnCategoria.grupo_prueba)
      const validacionRetry = validarPayload(fila, payloadRetry)
      if (validacionRetry) {
        return { ok: false, codigo: fila.codigo, mensaje: validacionRetry }
      }

      const codigoDb = retryEnCategoria.codigo !== codigoNormalizado ? codigoNormalizado : null
      const { ok, error } = await actualizarProducto(
        admin,
        retryEnCategoria.id,
        payloadRetry,
        codigoDb,
      )
      if (!ok) {
        return {
          ok: false,
          codigo: fila.codigo,
          mensaje: mensajeErrorDb(error, fila, fila.categoria, categoriaMap) ?? 'No se pudo actualizar el producto existente',
        }
      }
      return { ok: true, id: retryEnCategoria.id, accion: 'actualizado' }
    }

    const { data: otros, error: otrosError } = await listarEnOtrasCategorias(
      admin,
      fila.codigo,
      fila.categoria,
    )

    if (!otrosError && otros?.length) {
      return insertarCopiaDesdeOtraCategoria(admin, fila, otros, categoriaMap)
    }
  }

  return {
    ok: false,
    codigo: fila.codigo,
    mensaje: mensajeErrorDb(insertError, fila, fila.categoria, categoriaMap) ?? 'No se pudo registrar el producto',
  }
}

/**
 * Procesa carga masiva de productos desde ODS/XLSX.
 * Verifica sesión admin y usa service role para bypass RLS.
 */
export async function procesarCargaODS(file, categoria) {
  const { user } = await assertAdminSession()
  const admin = getSupabaseAdmin()

  const categoriaKeys = await obtenerClavesCategoriasActivas()
  const categoriasRows = await listarCategorias()
  const categoriaMap = mapCategorias(categoriasRows)
  const { validRows, errors, totalFilas } = await parseODSFile(file, categoria, { categoriaKeys })
  const filasUnicas = deduplicarFilas(validRows)

  if (!filasUnicas.length && !errors.length) {
    throw new Error('El archivo no contiene filas válidas para procesar')
  }

  let insertados = 0
  let actualizados = 0
  let reubicados = 0
  const productoIdsAfectados = []

  for (const row of filasUnicas) {
    const resultado = await guardarProductoDesdeOds(admin, row, categoriaMap)

    if (!resultado.ok) {
      errors.push({
        fila: null,
        codigo: resultado.codigo,
        mensaje: resultado.mensaje,
      })
      continue
    }

    if (resultado.accion === 'insertado') insertados += 1
    else if (resultado.accion === 'reubicado') reubicados += 1
    else actualizados += 1

    productoIdsAfectados.push(resultado.id)
  }

  const idsUnicos = [...new Set(productoIdsAfectados)]

  if (!idsUnicos.length) {
    const resumen = resumirErrores(errors)
    throw new Error(
      resumen
        ? `No se pudo procesar ningún producto del archivo. ${resumen}`
        : 'No se pudo procesar ningún producto del archivo. Revise el detalle de errores.',
    )
  }

  const detalleErrores = errors.slice(0, 100).map((e) => ({
    fila: e.fila,
    codigo: e.codigo,
    mensaje: sanitizeRowErrorMessage(e.mensaje),
  }))

  const { error: logError } = await admin.from('log_cargas').insert({
    admin_id: user.id,
    categoria,
    nombre_archivo: sanitizeText(file.name, 255),
    total_filas: totalFilas,
    insertados,
    actualizados: actualizados + reubicados,
    errores: errors.length,
    detalle_errores: detalleErrores.length ? detalleErrores : null,
    producto_ids: idsUnicos,
  })

  const baseResult = {
    totalFilas,
    insertados,
    actualizados,
    reubicados,
    errores: errors.length,
    detalleErrores,
  }

  if (logError) {
    return {
      ...baseResult,
      advertenciaLog:
        'Los productos se cargaron correctamente, pero no se pudo registrar el historial. Verifique la columna producto_ids en log_cargas.',
    }
  }

  return baseResult
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
