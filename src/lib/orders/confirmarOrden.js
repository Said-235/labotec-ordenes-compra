import { supabase } from '../supabaseClient'
import { MAX_CANTIDAD_CARRITO } from '../constants'
import {
  fetchCategoriasDesdeBd,
  keysCategorias,
  mapCategorias,
} from '../categorias'
import {
  mensajeViolacionesReactivo,
  validarRestriccionReactivo,
} from '../cartValidation'
import {
  expandirLineasConCoberturaReactivo,
  calcularTotalesOrden,
  normalizarAumentosPorClase,
  sanitizePorcentaje,
} from '../pricing'

function sanitizeCantidad(cantidad) {
  const qty = Math.floor(Number(cantidad) || 0)
  if (qty < 1 || qty > MAX_CANTIDAD_CARRITO) return null
  return qty
}

function groupByCategoria(items) {
  return items.reduce((groups, item) => {
    const cat = item.categoria
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
    return groups
  }, {})
}

/**
 * Confirma el carrito: valida reglas de negocio, calcula precios desde BD,
 * crea una orden por categoría y genera PDFs.
 */
export async function confirmarOrden(cartItems) {
  if (!cartItems?.length) {
    throw new Error('El carrito está vacío')
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Sesión no válida')
  }

  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select(
      'id, nombre, email, nivel, porcentaje_aumento, aumentos_por_clase, aplica_regla_calibrador_control, datos_fiscales, activo, primer_login',
    )
    .eq('id', user.id)
    .single()

  if (clienteError || !cliente) {
    throw new Error('Perfil de usuario no encontrado')
  }

  if (!cliente.activo) {
    throw new Error('Cuenta desactivada')
  }

  if (cliente.primer_login) {
    throw new Error('Complete sus datos fiscales antes de confirmar una orden')
  }

  const aumentosAplicados = normalizarAumentosPorClase(cliente)
  // Legado: descuento_aplicado sigue siendo numérico (usamos Reactivo como referencia)
  const aumentoAplicado = sanitizePorcentaje(aumentosAplicados.Reactivo)
  // Snapshot legado: la BD aún exige nivel 1–3 (ya no afecta el precio)
  const nivelSnapshot = [1, 2, 3].includes(Number(cliente.nivel)) ? Number(cliente.nivel) : 1
  const aplicaReglaCalibradorControl = cliente.aplica_regla_calibrador_control !== false

  const categoriasRows = await fetchCategoriasDesdeBd(supabase, { soloActivas: true })
  const categoriaKeys = keysCategorias(categoriasRows)
  const categoriaMap = mapCategorias(categoriasRows)

  const itemsSanitized = cartItems.map((item) => {
    const cantidad = sanitizeCantidad(item.cantidad)
    if (!cantidad || !item.producto_id) {
      throw new Error('Cantidad inválida en el carrito')
    }
    return { producto_id: item.producto_id, cantidad }
  })

  const productoIds = [...new Set(itemsSanitized.map((i) => i.producto_id))]

  const { data: productos, error: productosError } = await supabase
    .from('productos')
    .select('id, codigo, descripcion, clase, categoria, precio_base, activo, grupo_prueba')
    .in('id', productoIds)

  if (productosError || !productos?.length) {
    throw new Error('No se pudieron validar los productos')
  }

  if (productos.length !== productoIds.length) {
    throw new Error('Algunos productos del carrito ya no existen')
  }

  const inactivos = productos.filter((p) => !p.activo)
  if (inactivos.length) {
    throw new Error(`Productos no disponibles: ${inactivos.map((p) => p.codigo).join(', ')}`)
  }

  const productoMap = Object.fromEntries(productos.map((p) => [p.id, p]))

  const lineasInput = itemsSanitized.map(({ producto_id, cantidad }) => ({
    producto: productoMap[producto_id],
    cantidad,
  }))
  const lineasExpandidas = expandirLineasConCoberturaReactivo(
    lineasInput,
    aumentosAplicados,
    { aplicaReglaCalibradorControl },
  )

  const lineas = lineasExpandidas.map((linea) => ({
    producto_id: linea.producto.id,
    codigo: linea.producto.codigo,
    descripcion: linea.producto.descripcion,
    clase: linea.producto.clase,
    categoria: linea.producto.categoria,
    grupo_prueba: linea.producto.grupo_prueba ?? null,
    cantidad: linea.cantidad,
    precio_base_unitario: linea.precio_base_unitario,
    precio_unitario: linea.precio_unitario,
    subtotal: linea.subtotal,
  }))

  for (const linea of lineas) {
    if (!categoriaKeys.includes(linea.categoria)) {
      throw new Error('Categoría de producto inválida')
    }
  }

  const violaciones = validarRestriccionReactivo(lineas)
  if (violaciones.length) {
    throw new Error(mensajeViolacionesReactivo(violaciones))
  }

  const porCategoria = groupByCategoria(lineas)
  const categoriasOrdenadas = categoriaKeys.filter((cat) => porCategoria[cat])
  const ordenesCreadas = []

  for (let i = 0; i < categoriasOrdenadas.length; i++) {
    const categoria = categoriasOrdenadas[i]
    const lineasCategoria = porCategoria[categoria]
    const subtotalOrden = lineasCategoria.reduce((sum, l) => sum + l.subtotal, 0)
    const incluirEnvio = i === 0
    const { subtotal, total } = calcularTotalesOrden(subtotalOrden, { incluirEnvio })

    const { data: orden, error: ordenError } = await supabase
      .from('ordenes')
      .insert({
        cliente_id: cliente.id,
        categoria,
        status: 'pendiente',
        nivel_cliente: nivelSnapshot,
        descuento_aplicado: aumentoAplicado,
        aumentos_aplicados: aumentosAplicados,
        subtotal,
        total,
      })
      .select('*')
      .single()

    if (ordenError || !orden) {
      const detalle = ordenError?.message ?? ordenError?.details ?? ''
      if (detalle.includes('ordenes_categoria_check') || detalle.includes('categoria_check')) {
        throw new Error(
          'La categoría de la orden no está permitida en la base de datos. Ejecute la migración SQL de categorías.',
        )
      }
      if (detalle.includes('nivel')) {
        throw new Error('No se pudo crear la orden por una restricción de nivel de cliente')
      }
      throw new Error('No se pudo crear la orden')
    }

    const detalleRows = lineasCategoria.map((l) => ({
      orden_id: orden.id,
      producto_id: l.producto_id,
      cantidad: l.cantidad,
      precio_base_unitario: l.precio_base_unitario,
      precio_unitario: l.precio_unitario,
      subtotal: l.subtotal,
    }))

    const { error: detalleError } = await supabase
      .from('detalle_orden')
      .insert(detalleRows)

    if (detalleError) {
      await supabase.from('ordenes').update({ status: 'cancelada' }).eq('id', orden.id)
      throw new Error('No se pudo registrar el detalle de la orden')
    }

    const detallesPdf = lineasCategoria.map((l) => ({
      codigo: l.codigo,
      descripcion: l.descripcion,
      clase: l.clase,
      cantidad: l.cantidad,
      precio_base_unitario: l.precio_base_unitario,
      precio_unitario: l.precio_unitario,
      subtotal: l.subtotal,
    }))

    try {
      const { generateAndUploadOrdenPDF } = await import('../pdfGenerator')
      const { path, signedUrl } = await generateAndUploadOrdenPDF({
        orden,
        detalles: detallesPdf,
        cliente,
        supabaseClient: supabase,
        categoriaMap,
      })

      await supabase
        .from('ordenes')
        .update({ pdf_url: path })
        .eq('id', orden.id)

      ordenesCreadas.push({ ...orden, pdf_url: path, pdf_signed_url: signedUrl })
    } catch {
      ordenesCreadas.push(orden)
    }
  }

  return ordenesCreadas
}
