import { formatMXN, getTotalesOrdenDesglose } from '../lib/pricing'

export default function OrdenTotalesResumen({ orden }) {
  const totales = getTotalesOrdenDesglose(orden)

  return (
    <div className="mt-4 flex flex-col items-end gap-1 border-t border-gray-100 pt-3 text-sm">
      <div className="flex w-full max-w-xs justify-between gap-6 text-gray-600">
        <span>Subtotal</span>
        <span>{formatMXN(totales.subtotal)}</span>
      </div>
      {totales.iva > 0 && (
        <div className="flex w-full max-w-xs justify-between gap-6 text-gray-600">
          <span>IVA (16%)</span>
          <span>{formatMXN(totales.iva)}</span>
        </div>
      )}
      {totales.envio > 0 && (
        <div className="flex w-full max-w-xs justify-between gap-6 text-gray-600">
          <span>Gastos de envío</span>
          <span>{formatMXN(totales.envio)}</span>
        </div>
      )}
      <div className="flex w-full max-w-xs justify-between gap-6 border-t border-gray-200 pt-2 font-semibold text-gray-900">
        <span>Total</span>
        <span>{formatMXN(totales.total)}</span>
      </div>
    </div>
  )
}
