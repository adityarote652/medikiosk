/**
 * WaveVisualizer - Animated voice/audio wave bars shown during speech recording.
 */
export default function WaveVisualizer() {
  return (
    <div className="flex items-end gap-px h-8" aria-hidden="true">
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="wave-bar" />
      ))}
    </div>
  )
}
