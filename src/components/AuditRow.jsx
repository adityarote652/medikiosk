/**
 * AuditRow - Single audit log entry row.
 */
export default function AuditRow({ entry }) {
  const color = {
    info:      'text-blue-600',
    success:   'text-emerald-600',
    warning:   'text-amber-600',
    error:     'text-rose-600',
    emergency: 'text-rose-700 font-bold',
  }[entry.level] ?? 'text-blue-600'

  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
      <span className="text-xs font-mono text-slate-400 flex-shrink-0 pt-0.5 w-20 tabular-nums">{entry.time}</span>
      <span className={`text-xs flex-shrink-0 pt-0.5 w-20 ${color}`}>[{entry.level?.toUpperCase()}]</span>
      <span className="text-xs text-slate-700 leading-relaxed break-words min-w-0">{entry.message}</span>
    </div>
  )
}
