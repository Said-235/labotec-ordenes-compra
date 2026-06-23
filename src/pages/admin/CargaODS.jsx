import { useEffect, useRef, useState } from 'react'
import { CATEGORIAS, CATEGORIA_KEYS } from '../../lib/constants'
import { getSafeErrorMessage } from '../../lib/errors'
import { procesarCargaODS, obtenerLogCargas } from '../../lib/admin/cargaOds'

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
              onChange={handleFileChange}
              className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-labotec-teal file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-labotec-teal-dark"
            />
            <p className="mt-1 text-xs text-gray-400">
              Columnas: Codigo, Descripcion, Clase, Costo — máx. 10 MB
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {resultado && (
          <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
            <p className="font-medium">Carga completada</p>
            <ul className="mt-2 space-y-1">
              <li>Filas procesadas: {resultado.totalFilas}</li>
              <li>Insertados: {resultado.insertados}</li>
              <li>Actualizados: {resultado.actualizados}</li>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">{formatFecha(log.creado_en)}</td>
                    <td className="px-4 py-3">{CATEGORIAS[log.categoria] ?? log.categoria}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{log.nombre_archivo}</td>
                    <td className="px-4 py-3">{log.total_filas}</td>
                    <td className="px-4 py-3 text-green-700">{log.insertados}</td>
                    <td className="px-4 py-3 text-blue-700">{log.actualizados}</td>
                    <td className="px-4 py-3 text-red-600">{log.errores}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
