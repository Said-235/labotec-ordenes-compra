import { ORDER_STATUS } from '../lib/constants'

const STATUS_STYLES = {
  pendiente: 'bg-amber-100 text-amber-800',
  pagada: 'bg-green-100 text-green-800',
  cancelada: 'bg-gray-100 text-gray-600',
  vencida: 'bg-red-100 text-red-800',
}

export default function StatusBadge({ status }) {
  const label = ORDER_STATUS[status] ?? status
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  )
}
