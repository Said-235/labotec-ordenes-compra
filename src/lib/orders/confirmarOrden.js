import { supabase } from '../supabaseClient'
import { CATEGORIA_KEYS, MAX_CANTIDAD_CARRITO } from '../constants'
import {
  mensajeViolacionesReactivo,
  validarRestriccionReactivo,
} from '../cartValidation'
import { calcularPrecioUnitario } from '../pricing'
import { generateAndUploadOrdenPDF } from '../pdfGenerator'

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
    .select('id, nombre, email, nivel, datos_fiscales, activo, primer_login')
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

  const { data: descuentoRow, error: descuentoError } = await supabase
    .from('descuentos_nivel')
    .select('porcentaje_descuento')
    .eq('nivel', cliente.nivel)
    .single()

  if (descuentoError) {
    throw new Error('No se pudo obtener el descuento del cliente')
  }

  const descuentoAplicado = Number(descuentoRow.porcentaje_descuento ?? 0)

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
    .select('id, codigo, descripcion, clase, categoria, precio_base, activo')
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

  const lineas = itemsSanitized.map(({ producto_id, cantidad }) => {
    const producto = productoMap[producto_id]
    const precioBase = Number(producto.precio_base)
    const precioUnitario = calcularPrecioUnitario(precioBase, descuentoAplicado)
    const subtotal = Math.round(precioUnitario * cantidad * 100) / 100

    return {
      producto_id,
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      clase: producto.clase,
      categoria: producto.categoria,
      cantidad,
      precio_base_unitario: precioBase,
      precio_unitario: precioUnitario,
      subtotal,
    }
  })

  for (const linea of lineas) {
    if (!CATEGORIA_KEYS.includes(linea.categoria)) {
      throw new Error('Categoría de producto inválida')
    }
  }

  const violaciones = validarRestriccionReactivo(lineas)
  if (violaciones.length) {
    throw new Error(mensajeViolacionesReactivo(violaciones))
  }

  const porCategoria = groupByCategoria(lineas)
  const ordenesCreadas = []

  for (const [categoria, lineasCategoria] of Object.entries(porCategoria)) {
    const subtotalOrden = lineasCategoria.reduce((sum, l) => sum + l.subtotal, 0)
    const subtotalRedondeado = Math.round(subtotalOrden * 100) / 100

    const { data: orden, error: ordenError } = await supabase
      .from('ordenes')
      .insert({
        cliente_id: cliente.id,
        categoria,
        status: 'pendiente',
        nivel_cliente: cliente.nivel,
        descuento_aplicado: descuentoAplicado,
        subtotal: subtotalRedondeado,
        total: subtotalRedondeado,
      })
      .select('*')
      .single()

    if (ordenError || !orden) {
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
      precio_unitario: l.precio_unitario,
      subtotal: l.subtotal,
    }))

    try {
      const { signedUrl } = await generateAndUploadOrdenPDF({
        orden,
        detalles: detallesPdf,
        cliente,
        supabaseClient: supabase,
      })

      await supabase
        .from('ordenes')
        .update({ pdf_url: signedUrl })
        .eq('id', orden.id)

      ordenesCreadas.push({ ...orden, pdf_url: signedUrl })
    } catch {
      ordenesCreadas.push(orden)
    }
  }

  return ordenesCreadas
}
