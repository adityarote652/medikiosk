/**
 * TriageBadge - Color-coded triage level pill.
 * Accepts level: 'EMERGENCY' | 'URGENT' | 'ROUTINE'
 */
export default function TriageBadge({ level }) {
  const cfg = {
    EMERGENCY: 'bg-rose-600 text-white',
    URGENT:    'bg-amber-500 text-white',
    ROUTINE:   'bg-emerald-600 text-white',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cfg[level] || cfg.ROUTINE}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
      {level}
    </span>
  )
}
