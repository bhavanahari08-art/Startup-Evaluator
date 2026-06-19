import { motion } from 'framer-motion'

/**
 * Circular score gauge for feasibility percentage.
 */
export default function ScoreGauge({ score = 0, label = '', size = 120 }) {
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const dash = (score / 100) * circumference

  const color =
    score >= 65 ? '#10b981'
    : score >= 40 ? '#f59e0b'
    : '#FF6B6B'

  const textColor =
    score >= 65 ? 'text-emerald-400'
    : score >= 40 ? 'text-yellow-400'
    : 'text-coral-500'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
          {/* Track */}
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          {/* Fill */}
          <motion.circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - dash }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={`text-xl font-bold tabular-nums ${textColor}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score.toFixed(1)}%
          </motion.span>
        </div>
      </div>
      {label && <p className={`text-sm font-semibold ${textColor}`}>{label}</p>}
    </div>
  )
}
