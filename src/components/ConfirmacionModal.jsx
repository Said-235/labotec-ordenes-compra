export default function ConfirmacionModal({
  titulo,
  mensaje,
  onConfirmar,
  onCancelar,
  confirmarTexto = 'Confirmar y agregar',
  cancelarTexto = 'Cancelar',
  confirmando = false,
  confirmandoTexto = 'Procesando…',
}) {
  if (!mensaje) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        role="alertdialog"
        aria-labelledby="confirmacion-titulo"
        aria-describedby="confirmacion-mensaje"
      >
        <h2 id="confirmacion-titulo" className="text-lg font-semibold text-gray-900">
          {titulo}
        </h2>
        <p id="confirmacion-mensaje" className="mt-3 text-sm text-gray-600 whitespace-pre-line">
          {mensaje}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancelar}
            disabled={confirmando}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {cancelarTexto}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={confirmando}
            className="flex-1 rounded-lg bg-labotec-teal py-2.5 text-sm font-semibold text-white hover:bg-labotec-teal-dark disabled:opacity-60"
          >
            {confirmando ? confirmandoTexto : confirmarTexto}
          </button>
        </div>
      </div>
    </div>
  )
}
