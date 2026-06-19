import { motion } from 'framer-motion'

/**
 * Horizontal bar showing a fairness metric from 0 to 1.
 * Closer to 0 = fairer (green), farther from 0 = biased (red).
 */
export default function FairnessBar({ label, value, ideal = 0, max = 1 }) {
  const abs = Math.abs(value)
  const pct = Math.min((abs / max) * 100, 100)

  const color =
    abs <= 0.05 ? '#10b981'
    : abs <= 0.15 ? '#f59e0b'
    : '#FF6B6B'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="font-bold tabular-nums" style={{ color }}>
          {value.toFixed(4)}
          <span className="text-slate-500 font-normal ml-1">(ideal: {ideal})</span>
        </span>
      </div>
      <div className="fairness-bar-wrap">
        <motion.div
          className="fairness-bar-fill"
          style={{ background: color, boxShadow: `0 0 6px ${color}60` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
