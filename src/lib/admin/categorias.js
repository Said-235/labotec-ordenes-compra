import { callAdmin } from '../adminApi'

export async function listarCategorias() {
  return callAdmin('categorias.list')
}

export async function crearCategoria(data) {
  return callAdmin('categorias.create', data)
}

export async function actualizarEstadoCategoria(clave, activo) {
  return callAdmin('categorias.setActive', { clave, activo })
}

export async function obtenerClavesCategoriasActivas() {
  const rows = await listarCategorias()
  return rows.filter((row) => row.activo).map((row) => row.clave)
}
