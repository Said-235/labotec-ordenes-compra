import { callAdmin } from '../adminApi'
import { parseODSFile } from '../odsParser'

export { eliminarProductosPorCarga } from './eliminarProductos'

/**
 * Parsea el archivo en el navegador y persiste vía API admin (service role en servidor).
 */
export async function procesarCargaODS(file, categoria) {
  const categoriaKeys = await callAdmin('categorias.list').then((rows) =>
    (rows ?? []).filter((r) => r.activo).map((r) => r.clave),
  )

  const { validRows, errors, totalFilas } = await parseODSFile(file, categoria, {
    categoriaKeys,
  })

  return callAdmin('cargaOds.procesar', {
    categoria,
    validRows,
    errors,
    totalFilas,
    nombreArchivo: file.name,
  })
}

export async function obtenerLogCargas(limit = 50) {
  return callAdmin('cargaOds.logs', { limit })
}
