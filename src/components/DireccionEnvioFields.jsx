export default function DireccionEnvioFields({ form, fieldErrors, onEnvioIgualChange, onDireccionEnvioChange }) {
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-800">Dirección de envío</p>

      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={form.envio_igual_fiscal}
          onChange={onEnvioIgualChange}
          className="mt-0.5 rounded border-gray-300 text-labotec-teal focus:ring-labotec-teal/30"
        />
        <span className="text-sm text-gray-700">
          Mi dirección de envío es la misma que la fiscal
        </span>
      </label>

      {!form.envio_igual_fiscal && (
        <div>
          <label htmlFor="direccion_envio" className="mb-1 block text-sm font-medium text-gray-700">
            Dirección de envío
          </label>
          <textarea
            id="direccion_envio"
            name="direccion_envio"
            rows={3}
            value={form.direccion_envio}
            onChange={onDireccionEnvioChange}
            placeholder="Calle, número, colonia, CP, ciudad, estado…"
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-labotec-teal/30 ${
              fieldErrors.direccion_envio
                ? 'border-red-400'
                : 'border-gray-300 focus:border-labotec-teal'
            }`}
          />
          {fieldErrors.direccion_envio && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.direccion_envio}</p>
          )}
        </div>
      )}
    </div>
  )
}
