import {
  desglosePrecioLinea,
  formatMXN,
  precioHabitualLinea,
} from '../lib/pricing'
import OrdenTotalesResumen from './OrdenTotalesResumen'

export default function DetalleOrdenTabla({ orden }) {
  const aumentos = orden.aumentos_aplicados ?? orden.descuento_aplicado ?? 0
  const lineas = orden.detalle_orden ?? []

  if (!lineas.length) return null

  const filas = lineas.flatMap((d) =>
    desglosePrecioLinea(d, aumentos).map((segmento, idx) => ({
      key: `${d.id}-${idx}`,
      codigo: d.productos?.codigo,
      descripcion: d.productos?.descripcion,
      precioHabitual: precioHabitualLinea(d, aumentos),
      ...segmento,
    })),
  )

  const hayPrecioDoble = filas.some((f) => f.esDoble)

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="text-gray-500">
            <th className="py-1 pr-3">Código</th>
            <th className="py-1 pr-3">Descripción</th>
            <th className="py-1 pr-3">Cant.</th>
            <th className="py-1 pr-3 text-right">P. unit.</th>
            <th className="py-1 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.key} className="border-t border-gray-100 align-top">
              <td className="py-1.5 pr-3 font-mono">{f.codigo}</td>
              <td className="py-1.5 pr-3">
                <p>{f.descripcion}</p>
                {f.esDoble && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    Precio ×2 por Reactivo insuficiente del mismo grupo
                    <span className="ml-1 text-gray-400 line-through">
                      ({formatMXN(f.precioHabitual)})
                    </span>
                  </p>
                )}
              </td>
              <td className="py-1.5 pr-3">{f.cantidad}</td>
              <td className="py-1.5 pr-3 text-right">{formatMXN(f.precioUnitario)}</td>
              <td className="py-1.5 text-right">{formatMXN(f.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {hayPrecioDoble && (
        <p className="mt-2 text-[11px] text-amber-700">
          Las líneas marcadas como ×2 se cobraron al doble de su tarifa habitual por no incluir
          suficiente Reactivo del mismo grupo. Las unidades cubiertas por Reactivo aparecen en
          una línea aparte a precio habitual.
        </p>
      )}

      <OrdenTotalesResumen orden={orden} />
    </div>
  )
}
