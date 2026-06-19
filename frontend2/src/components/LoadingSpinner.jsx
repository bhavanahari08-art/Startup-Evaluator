import { motion } from 'framer-motion'

export default function LoadingSpinner({ size = 'md', label = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        className={`${sizes[size]} rounded-full border-2 border-white/10 border-t-brand-500`}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      />
      {label && <p className="text-sm text-slate-400 animate-pulse">{label}</p>}
    </div>
  )
}

export function SkeletonBlock({ className = '' }) {
  return <div className={`shimmer rounded-xl ${className}`} />
}

export function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1117]/80 backdrop-blur-sm">
      <LoadingSpinner size="lg" label={label} />
    </div>
  )
}
