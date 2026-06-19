import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Clock, Trash2, FileText, Plus, Loader2 } from 'lucide-react'
import { reportsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const scoreColor = (score) => {
  if (score == null) return 'text-slate-500'
  if (score >= 65) return 'text-emerald-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-coral-500'
}

// Global helper — call this anywhere after saving a report to refresh all sidebars
export function notifySidebarRefresh() {
  window.dispatchEvent(new CustomEvent('trusteval:report-saved'))
}

export default function Sidebar({ onSelectReport, activeReportId }) {
  const { isAuthenticated } = useAuth()
  const [collapsed, setCollapsed] = useState(true)
  const [history, setHistory]     = useState([])
  const [loading, setLoading]     = useState(false)
  const navigate = useNavigate()

  const fetchHistory = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true)
    try {
      const { data } = await reportsApi.history()
      setHistory(data)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  // Fetch on mount + whenever auth changes
  useEffect(() => { fetchHistory() }, [fetchHistory])

  // Listen for new reports saved from any page — always refresh regardless of collapsed state
  useEffect(() => {
    const handler = () => fetchHistory()
    window.addEventListener('trusteval:report-saved', handler)
    return () => window.removeEventListener('trusteval:report-saved', handler)
  }, [fetchHistory])

  // Re-fetch when sidebar is opened
  const handleToggle = () => {
    setCollapsed(prev => {
      const next = !prev
      if (!next && isAuthenticated) fetchHistory()
      return next
    })
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    try {
      await reportsApi.delete(id)
      setHistory(h => h.filter(r => r.id !== id))
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 44 : 256 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className="relative flex-shrink-0 h-full flex flex-col border-r border-white/5 bg-[#0a0d14]/70 overflow-hidden"
    >
      {/* Toggle */}
      <button
        onClick={handleToggle}
        className="absolute top-3.5 -right-3 z-20 w-6 h-6 rounded-full bg-[#111827] border border-white/10
          flex items-center justify-center text-slate-400 hover:text-white transition-colors shadow-md"
        aria-label={collapsed ? 'Open history' : 'Close history'}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Collapsed — icon only */}
      {collapsed && (
        <div className="flex flex-col items-center pt-4 gap-3">
          <button onClick={handleToggle} className="p-2 rounded-lg text-slate-500 hover:text-slate-300 transition-colors" title="Open history">
            <Clock className="w-4 h-4" />
          </button>
          <button onClick={() => navigate('/startup')} className="p-2 rounded-lg text-slate-500 hover:text-brand-400 transition-colors" title="New analysis">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Expanded content */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            <div className="px-3 pt-4 pb-3 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">History</span>
                </div>
                <button onClick={fetchHistory} className="text-slate-600 hover:text-slate-300 transition-colors" aria-label="Refresh">
                  <Loader2 className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto scroll-area py-2 px-2">
              {!isAuthenticated ? (
                <p className="text-[11px] text-slate-500 text-center px-2 py-4">
                  <Link to="/login" className="text-brand-400 hover:underline">Sign in</Link> to see history
                </p>
              ) : loading ? (
                <div className="space-y-2 pt-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="shimmer h-12 rounded-xl" />)}
                </div>
              ) : history.length === 0 ? (
                <p className="text-[11px] text-slate-600 text-center py-8">No evaluations yet</p>
              ) : (
                <div className="space-y-1">
                  {history.map((r) => (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      onClick={() => onSelectReport?.(r.id)}
                      className={`group flex flex-col gap-0.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-150
                        ${activeReportId === r.id
                          ? 'bg-brand-500/10 border border-brand-500/20'
                          : 'hover:bg-white/4 border border-transparent'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FileText className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          <p className="text-[11px] font-medium text-slate-300 truncate leading-snug">
                            {r.startup_idea?.slice(0, 34) || 'Unnamed'}…
                          </p>
                        </div>
                        <button onClick={(e) => handleDelete(e, r.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-600 hover:text-coral-400 transition-all flex-shrink-0">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between pl-4">
                        {r.domain && <span className="text-[10px] text-slate-600 truncate">{r.domain}</span>}
                        <div className="flex items-center gap-2 ml-auto">
                          {r.feasibility_score != null && r.feasibility_score > 0 && (
                            <span className={`text-[10px] font-bold ${scoreColor(r.feasibility_score)}`}>
                              {r.feasibility_score.toFixed(0)}%
                            </span>
                          )}
                          {(r.feasibility_score == null || r.feasibility_score === 0) && r.feasibility_label && (
                            <span className="text-[9px] font-semibold text-slate-500 truncate max-w-[60px] leading-tight">
                              {r.feasibility_label.split(' ')[0]}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-700">{formatDate(r.created_at)}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-3 border-t border-white/5">
              <button onClick={() => navigate('/startup')}
                className="w-full flex items-center justify-center gap-1.5 text-[11px] text-brand-400 hover:text-brand-300 font-medium transition-colors py-1.5 rounded-lg hover:bg-brand-500/5">
                <Plus className="w-3 h-3" /> New Analysis
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
