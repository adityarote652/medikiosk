/**
 * TriageBar - Proportional triage distribution bar.
 */
export default function TriageBar({ emergency, urgent, routine, total }) {
  if (!total) return <div className="flex items-center justify-center h-8 bg-slate-100 rounded-lg text-xs text-slate-400">No data yet</div>
  const ep = Math.round((emergency / total) * 100)
  const up = Math.round((urgent   / total) * 100)
  const rp = 100 - ep - up
  return (
    <div>
      <div className="flex rounded-lg overflow-hidden h-7 mb-2">
        {ep > 0 && <div className="bg-rose-600   flex items-center justify-center text-white text-xs font-bold" style={{ width: `${ep}%` }}>{ep}%</div>}
        {up > 0 && <div className="bg-amber-500  flex items-center justify-center text-white text-xs font-bold" style={{ width: `${up}%` }}>{up}%</div>}
        {rp > 0 && <div className="bg-emerald-600 flex items-center justify-center text-white text-xs font-bold" style={{ width: `${rp}%` }}>{rp}%</div>}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-600 inline-block" />{emergency} Emergency ({ep}%)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />{urgent} Urgent ({up}%)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" />{routine} Routine ({rp}%)</span>
      </div>
    </div>
  )
}
