/**
 * StatusPill - Patient workflow status indicator.
 * Accepts status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED'
 */
const STATUS_LABELS = {
  WAITING:     'Waiting',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Completed',
}

export default function StatusPill({ status }) {
  const cfg = {
    WAITING:     'bg-slate-100 text-slate-600',
    IN_PROGRESS: 'bg-blue-100  text-blue-700',
    COMPLETED:   'bg-emerald-100 text-emerald-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg[status] || cfg.WAITING}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
