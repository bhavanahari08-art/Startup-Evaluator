/**
 * A labeled range slider for numeric feature inputs.
 */
export default function FeatureSlider({ label, name, value, onChange, min = 0, max = 100, description = '' }) {
  const pct = ((value - min) / (max - min)) * 100

  const color =
    pct >= 65 ? '#10b981'
    : pct >= 35 ? '#f59e0b'
    : '#FF6B6B'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-300">{label}</label>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>{value}</span>
      </div>
      {description && <p className="text-[11px] text-slate-500">{description}</p>}
      <input
        type="range"
        name={name}
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
        }}
        aria-label={label}
      />
    </div>
  )
}
