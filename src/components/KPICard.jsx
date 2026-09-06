/**
 * KPICard - Admin dashboard key performance indicator tile.
 */
export default function KPICard({ icon: Icon, label, value, sub, color = 'slate', loading }) {
  const colors = {
    slate:   { bg: 'bg-white',       icon: 'text-slate-600',   border: 'border-slate-200' },
    emerald: { bg: 'bg-emerald-50',  icon: 'text-emerald-600', border: 'border-emerald-200' },
    rose:    { bg: 'bg-rose-50',     icon: 'text-rose-600',    border: 'border-rose-200' },
    amber:   { bg: 'bg-amber-50',    icon: 'text-amber-600',   border: 'border-amber-200' },
    blue:    { bg: 'bg-blue-50',     icon: 'text-blue-600',    border: 'border-blue-200' },
  }
  const c = colors[color] || colors.slate
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4 shadow-clinical`}>
      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-3">
        <Icon className={`w-5 h-5 ${c.icon}`} />
      </div>
      {loading
        ? <div className="h-8 bg-slate-200 rounded animate-pulse mb-1" />
        : <div className="text-2xl font-black text-slate-900 mb-0.5">{value}</div>}
      <div className="text-xs font-semibold text-slate-700 mb-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}
