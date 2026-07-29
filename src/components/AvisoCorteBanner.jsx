import { getResumenAvisoCorte } from '../lib/cortePedidos'

/**
 * Banner informativo durante la ventana 25 → 5.
 */
export default function AvisoCorteBanner() {
  const resumen = getResumenAvisoCorte()
  if (!resumen) return null

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <p className="font-medium">Aviso de procesamiento</p>
      <p className="mt-1 text-amber-900/90">{resumen}</p>
    </div>
  )
}
