import {
  esPrecioDobleSinReactivo,
  formatMXN,
  precioHabitualLinea,
} from '../lib/pricing'
import OrdenTotalesResumen from './OrdenTotalesResumen'

export default function DetalleOrdenTabla({ orden }) {
  const aumentos = orden.aumentos_aplicados ?? orden.descuento_aplicado ?? 0
  const lineas = orden.detalle_orden ?? []

  if (!lineas.length) return null

  const hayPrecioDoble = lineas.some((d) => esPrecioDobleSinReactivo(d, aumentos))

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
          {lineas.map((d) => {
            const precioDoble = esPrecioDobleSinReactivo(d, aumentos)
            const precioNormal = precioHabitualLinea(d, aumentos)

            return (
              <tr key={d.id} className="border-t border-gray-100 align-top">
                <td className="py-1.5 pr-3 font-mono">{d.productos?.codigo}</td>
                <td className="py-1.5 pr-3">
                  <p>{d.productos?.descripcion}</p>
                  {precioDoble && (
                    <p className="mt-1 text-[11px] text-amber-700">
                      Precio ×2 sin Reactivo del mismo grupo
                      <span className="ml-1 text-gray-400 line-through">
                        ({formatMXN(precioNormal)})
                      </span>
                    </p>
                  )}
                </td>
                <td className="py-1.5 pr-3">{d.cantidad}</td>
                <td className="py-1.5 pr-3 text-right">{formatMXN(d.precio_unitario)}</td>
                <td className="py-1.5 text-right">{formatMXN(d.subtotal)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {hayPrecioDoble && (
        <p className="mt-2 text-[11px] text-amber-700">
          Los productos marcados como ×2 sin Reactivo se cobraron al doble de su tarifa habitual
          por no incluir el Reactivo correspondiente en la orden.
        </p>
      )}

      <OrdenTotalesResumen orden={orden} />
    </div>
  )
}
