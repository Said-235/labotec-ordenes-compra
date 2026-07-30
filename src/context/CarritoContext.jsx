import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { MAX_CANTIDAD_CARRITO } from '../lib/constants'
import {
  puedeAgregarAlCarrito,
  puedeActualizarCantidad,
  puedeEliminarDelCarrito,
  validarRestriccionReactivo,
} from '../lib/cartValidation'

export const CarritoContext = createContext(null)

function storageKey(userId) {
  return `labotec_carrito_${userId}`
}

function loadCart(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCart(userId, items) {
  localStorage.setItem(storageKey(userId), JSON.stringify(items))
}

export function CarritoProvider({ children }) {
  const { session, cliente } = useAuth()
  const userId = session?.user?.id
  const [items, setItems] = useState([])

  useEffect(() => {
    if (userId) {
      setItems(loadCart(userId))
    } else {
      setItems([])
    }
  }, [userId])

  useEffect(() => {
    if (userId) {
      saveCart(userId, items)
    }
  }, [userId, items])

  const agregarProducto = useCallback(
    (producto, cantidad = 1, opciones = {}) => {
      if (!userId) return { ok: false, message: 'Sesión no válida' }

      const qty = Math.min(
        MAX_CANTIDAD_CARRITO,
        Math.max(1, Math.floor(Number(cantidad) || 1)),
      )

      const validacion = puedeAgregarAlCarrito(producto, items, {
        ...opciones,
        cantidad: qty,
      })
      if (!validacion.ok) return validacion

      setItems((prev) => {
        const existing = prev.find((i) => i.producto_id === producto.id)
        if (existing) {
          const nuevaCantidad = Math.min(
            MAX_CANTIDAD_CARRITO,
            existing.cantidad + qty,
          )
          return prev.map((i) =>
            i.producto_id === producto.id
              ? { ...i, cantidad: nuevaCantidad }
              : i,
          )
        }

        return [
          ...prev,
          {
            producto_id: producto.id,
            codigo: producto.codigo,
            descripcion: producto.descripcion,
            clase: producto.clase,
            categoria: producto.categoria,
            grupo_prueba: producto.grupo_prueba ?? null,
            cantidad: qty,
          },
        ]
      })

      return { ok: true }
    },
    [userId, items],
  )

  const actualizarCantidad = useCallback(
    (productoId, cantidad, opciones = {}) => {
      const qty = Math.floor(Number(cantidad) || 0)

      if (qty <= 0) {
        setItems((prev) => prev.filter((i) => i.producto_id !== productoId))
        return { ok: true }
      }

      if (qty > MAX_CANTIDAD_CARRITO) {
        return { ok: false, message: `Máximo ${MAX_CANTIDAD_CARRITO} unidades por producto` }
      }

      const item = items.find((i) => i.producto_id === productoId)
      if (!item) return { ok: false, message: 'Producto no encontrado en el carrito' }

      const validacion = puedeActualizarCantidad(item, qty, items, opciones)
      if (!validacion.ok) return validacion

      setItems((prev) =>
        prev.map((i) =>
          i.producto_id === productoId ? { ...i, cantidad: qty } : i,
        ),
      )
      return { ok: true }
    },
    [items],
  )

  const eliminarProducto = useCallback(
    (productoId) => {
      const item = items.find((i) => i.producto_id === productoId)
      if (!item) return { ok: true }

      const validacion = puedeEliminarDelCarrito(item, items)
      if (!validacion.ok) return validacion

      setItems((prev) => prev.filter((i) => i.producto_id !== productoId))
      return { ok: true }
    },
    [items],
  )

  const vaciarCarrito = useCallback(() => {
    setItems([])
    if (userId) localStorage.removeItem(storageKey(userId))
  }, [userId])

  const totalItems = useMemo(
    () => items.reduce((sum, i) => sum + i.cantidad, 0),
    [items],
  )

  const violacionesReactivo = useMemo(
    () => validarRestriccionReactivo(items),
    [items],
  )

  const esValido = violacionesReactivo.length === 0 && items.length > 0

  const value = useMemo(
    () => ({
      items,
      totalItems,
      esValido,
      violacionesReactivo,
      agregarProducto,
      actualizarCantidad,
      eliminarProducto,
      vaciarCarrito,
    }),
    [
      items,
      totalItems,
      esValido,
      violacionesReactivo,
      agregarProducto,
      actualizarCantidad,
      eliminarProducto,
      vaciarCarrito,
    ],
  )

  return (
    <CarritoContext.Provider value={value}>{children}</CarritoContext.Provider>
  )
}

export function useCarritoContext() {
  const ctx = useContext(CarritoContext)
  if (!ctx) {
    throw new Error('useCarrito debe usarse dentro de CarritoProvider')
  }
  return ctx
}
