export default function AlertaModal({ titulo, mensaje, onCerrar }) {
  if (!mensaje) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        role="alertdialog"
        aria-labelledby="alerta-titulo"
        aria-describedby="alerta-mensaje"
      >
        <h2 id="alerta-titulo" className="text-lg font-semibold text-gray-900">
          {titulo}
        </h2>
        <p id="alerta-mensaje" className="mt-3 text-sm text-gray-600 whitespace-pre-line">
          {mensaje}
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="mt-6 w-full rounded-lg bg-labotec-teal py-2.5 text-sm font-semibold text-white hover:bg-labotec-teal-dark"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
