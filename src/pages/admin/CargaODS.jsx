import { useEffect, useRef, useState } from 'react'
import { CATEGORIAS, CATEGORIA_KEYS } from '../../lib/constants'
import { getSafeErrorMessage } from '../../lib/errors'
import { procesarCargaODS, obtenerLogCargas, eliminarProductosPorCarga } from '../../lib/admin/cargaOds'

function formatFecha(iso) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export default function CargaODS() {
  const fileRef = useRef(null)
  const [categoria, setCategoria] = useState(CATEGORIA_KEYS[0])
  const [archivo, setArchivo] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState(null)
  const [logs, setLogs] = useState([])
  const [cargandoLogs, setCargandoLogs] = useState(true)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function cargarLogs() {
      try {
        const data = await obtenerLogCargas()
        setLogs(data)
      } catch {
        setLogs([])
      } finally {
        setCargandoLogs(false)
      }
    }

    cargarLogs()
  }, [resultado])

  function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null
    setArchivo(file)
    setError('')
    setResultado(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setResultado(null)

    if (!archivo) {
      setError('Seleccione un archivo ODS o XLSX')
      return
    }

    setProcesando(true)

    try {
      const res = await procesarCargaODS(archivo, categoria)
      setResultado(res)
      setArchivo(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo procesar el archivo'))
    } finally {
      setProcesando(false)
    }
  }

  async function handleEliminarCarga() {
    if (!confirmarEliminar) return
    setEliminando(true)
    setError('')

    try {
      const res = await eliminarProductosPorCarga(confirmarEliminar.id)
      let msg = `Carga "${res.nombreArchivo}": ${res.eliminados} producto(s) eliminado(s)`
      if (res.enOrdenes > 0) {
        msg += `. ${res.enOrdenes} no se eliminaron (en órdenes existentes)`
      }
      setSuccess(msg)
      setTimeout(() => setSuccess(''), 6000)
      setConfirmarEliminar(null)
      setResultado(null)
      setArchivo(null)
      if (fileRef.current) fileRef.current.value = ''
      const data = await obtenerLogCargas()
      setLogs(data)
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo eliminar la carga'))
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Carga masiva ODS</h1>
      <p className="mt-1 text-sm text-gray-500">
        Importe productos desde archivos ODS o XLSX por categoría
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="categoria" className="mb-1 block text-sm font-medium text-gray-700">
              Categoría
            </label>
            <select
              id="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-labotec-teal focus:outline-none focus:ring-2 focus:ring-labotec-teal/30"
            >
              {CATEGORIA_KEYS.map((key) => (
                <option key={key} value={key}>
                  {CATEGORIAS[key]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="archivo" className="mb-1 block text-sm font-medium text-gray-700">
              Archivo
            </label>
            <input
              ref={fileRef}
              id="archivo"
              type="file"
              accept=".ods,.xlsx,.xls"
              onClick={(event) => {
                event.target.value = ''
              }}
              onChange={handleFileChange}
              className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-labotec-teal file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-labotec-teal-dark"
            />
            <p className="mt-1 text-xs text-gray-400">
              Columnas: Codigo, Descripcion, Clase, Costo — opcional: Grupo (misma columna que los datos) — máx. 10 MB.
              El mismo código puede existir en distintas categorías (cada carga lo registra en la categoría seleccionada).
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {success}
          </div>
        )}

        {resultado && (
          <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
            <p className="font-medium">Carga completada</p>
            {resultado.advertenciaLog && (
              <p className="mt-2 rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">
                {resultado.advertenciaLog}
              </p>
            )}
            <ul className="mt-2 space-y-1">
              <li>Filas procesadas: {resultado.totalFilas}</li>
              <li>Insertados: {resultado.insertados}</li>
              <li>Actualizados: {resultado.actualizados}</li>
              {resultado.reubicados > 0 && (
                <li>Reubicados de otra categoría: {resultado.reubicados}</li>
              )}
              <li>Errores: {resultado.errores}</li>
            </ul>
            {resultado.detalleErrores?.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer font-medium">Ver detalle de errores</summary>
                <ul className="mt-2 max-h-40 overflow-y-auto space-y-1 text-xs">
                  {resultado.detalleErrores.map((e, i) => (
                    <li key={i}>
                      {e.fila ? `Fila ${e.fila}` : 'BD'} — {e.codigo}: {e.mensaje}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={procesando || !archivo}
          className="mt-5 rounded-lg bg-labotec-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-labotec-teal-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {procesando ? 'Procesando…' : 'Procesar archivo'}
        </button>
      </form>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">Historial de cargas</h2>

        {cargandoLogs ? (
          <p className="mt-3 text-sm text-gray-500">Cargando…</p>
        ) : logs.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Sin registros de carga</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Archivo</th>
                  <th className="px-4 py-3">Filas</th>
                  <th className="px-4 py-3">Ins.</th>
                  <th className="px-4 py-3">Act.</th>
                  <th className="px-4 py-3">Err.</th>
                  <th className="px-4 py-3">Prod.</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const countProd = Array.isArray(log.producto_ids) ? log.producto_ids.length : 0
                  return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">{formatFecha(log.creado_en)}</td>
                    <td className="px-4 py-3">{CATEGORIAS[log.categoria] ?? log.categoria}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{log.nombre_archivo}</td>
                    <td className="px-4 py-3">{log.total_filas}</td>
                    <td className="px-4 py-3 text-green-700">{log.insertados}</td>
                    <td className="px-4 py-3 text-blue-700">{log.actualizados}</td>
                    <td className="px-4 py-3 text-red-600">{log.errores}</td>
                    <td className="px-4 py-3 text-gray-600">{countProd || '—'}</td>
                    <td className="px-4 py-3">
                      {countProd > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmarEliminar({
                              id: log.id,
                              nombre: log.nombre_archivo,
                              count: countProd,
                            })
                          }
                          className="text-xs text-red-700 hover:underline"
                        >
                          Eliminar carga
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirmarEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Eliminar productos de carga ODS</h2>
            <p className="mt-3 text-sm text-gray-600">
              ¿Eliminar los {confirmarEliminar.count} producto(s) de la carga{' '}
              <strong>{confirmarEliminar.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
            <p className="mt-2 text-xs text-amber-700">
              Los productos que aparezcan en órdenes existentes no se eliminarán.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={eliminando}
                onClick={() => setConfirmarEliminar(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={eliminando}
                onClick={handleEliminarCarga}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {eliminando ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
