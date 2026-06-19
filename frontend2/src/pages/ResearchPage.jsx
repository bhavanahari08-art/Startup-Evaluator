import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, BarChart2, TrendingUp, Lightbulb, AlertTriangle,
  CheckCircle, XCircle, ChevronDown, ChevronRight, Sparkles,
  FileText, Zap, Target, Search, ArrowUpRight, ArrowRight,
  Shield, Microscope, Users, DollarSign
} from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LabelList
} from 'recharts'
import toast from 'react-hot-toast'
import { reportsApi } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'

/* ─── helpers ─────────────────────────────────────────────────── */
const scoreColor = (s) =>
  s >= 70 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444'

const scoreLabel = (s) =>
  s >= 70 ? 'Strong' : s >= 50 ? 'Moderate' : 'Weak'

const FACTOR_ICONS = {
  patent_novelty:     <Shield className="w-4 h-4" />,
  research_support:   <Microscope className="w-4 h-4" />,
  market_demand:      <TrendingUp className="w-4 h-4" />,
  team_experience:    <Users className="w-4 h-4" />,
  competitor_density: <Target className="w-4 h-4" />,
}

/* custom bar tooltip */
const BarTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#12151f] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-white font-semibold mb-0.5">{label}</p>
      <p style={{ color: scoreColor(payload[0].value) }}>
        Score: <strong>{payload[0].value}</strong>/100
      </p>
    </div>
  )
}

/* ─── component ───────────────────────────────────────────────── */
export default function ResearchPage() {
  const { isAuthenticated } = useAuth()
  const [reports, setReports]       = useState([])
  const [loadingList, setLL]        = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [selected, setSelected]     = useState(null)   // full explain data
  const [loading, setLoading]       = useState(false)
  const [activeReport, setActiveReport] = useState(null)
  const [activeTab, setActiveTab]   = useState('overview')

  /* load report list */
  useEffect(() => {
    if (!isAuthenticated) return
    setLL(true)
    reportsApi.history()
      .then(r => setReports(r.data))
      .catch(() => {})
      .finally(() => setLL(false))
  }, [isAuthenticated])

  const loadExplain = async (id, idea) => {
    setLoading(true)
    setSelected(null)
    setShowPicker(false)
    setActiveTab('overview')
    try {
      const { data } = await reportsApi.explain(id)
      setSelected(data)
      toast.success('Analysis loaded!')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load analysis')
    } finally {
      setLoading(false)
    }
  }

  /* derived chart data */
  const barData = (selected?.factors || []).map(f => ({
    name: f.label,
    score: f.score,
    fill: f.key === 'competitor_density'
      ? scoreColor(100 - f.score)   // inverted: low density = good
      : scoreColor(f.score),
  }))

  const radarData = (selected?.factors || []).map(f => ({
    subject: f.label.replace(' ', '\n'),
    value: f.key === 'competitor_density' ? 100 - f.score : f.score,
    fullMark: 100,
  }))

  const tabs = [
    { id: 'overview',  label: 'Overview',       icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { id: 'whatif',    label: 'What-If',         icon: <Zap className="w-3.5 h-3.5" /> },
    { id: 'insights',  label: 'AI Insights',     icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'feasibility', label: 'Feasibility',   icon: <Target className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="flex h-full">
      <Sidebar onSelectReport={setActiveReport} activeReportId={activeReport} />

      <main className="flex-1 overflow-y-auto scroll-area">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

          {/* ── header ── */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-xl bg-brand-500/15 flex items-center justify-center">
                <Brain className="w-4 h-4 text-brand-400" />
              </div>
              <h1 className="text-2xl font-display font-bold text-white">Explainable AI Suite</h1>
            </div>
            <p className="text-sm text-slate-400 ml-11">
              Real factor-by-factor breakdown of your startup's AI evaluation — powered by Gemini AI, not guesswork.
            </p>
          </div>

          {/* ── report picker ── */}
          {isAuthenticated ? (
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-400" />
                  <p className="text-sm font-semibold text-white">Select a Startup Analysis</p>
                </div>
                <button
                  onClick={() => setShowPicker(p => !p)}
                  className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium"
                >
                  {showPicker ? 'Hide' : 'Choose Report'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {selected && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-emerald-400">Analysing real Gemini AI data</p>
                    <p className="text-[11px] text-slate-400 truncate">{selected.startup_idea}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold" style={{ color: scoreColor(selected.overall_score) }}>
                      {selected.overall_score}%
                    </p>
                    <p className="text-[10px] text-slate-500">{selected.feasibility_label}</p>
                  </div>
                </div>
              )}

              <AnimatePresence>
                {showPicker && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="space-y-1.5 max-h-52 overflow-y-auto scroll-area pt-1">
                      {loadingList && (
                        <p className="text-xs text-slate-500 text-center py-4">Loading your reports…</p>
                      )}
                      {!loadingList && reports.length === 0 && (
                        <div className="text-center py-6">
                          <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-xs text-slate-500">No saved analyses yet.</p>
                          <p className="text-[11px] text-slate-600 mt-1">Go to Startup AI and analyse an idea first!</p>
                        </div>
                      )}
                      {reports.map(r => (
                        <button
                          key={r.id}
                          onClick={() => loadExplain(r.id, r.startup_idea)}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl
                            bg-white/3 border border-white/8 hover:bg-brand-500/10 hover:border-brand-500/25
                            transition-all text-left group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-300 truncate group-hover:text-white">
                              {r.startup_idea?.slice(0, 55)}{r.startup_idea?.length > 55 ? '…' : ''}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {r.domain} · {r.feasibility_label}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                            {r.feasibility_score != null && (
                              <span
                                className="text-xs font-bold"
                                style={{ color: scoreColor(r.feasibility_score) }}
                              >
                                {r.feasibility_score.toFixed(0)}%
                              </span>
                            )}
                            <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-brand-400 transition-colors" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!selected && !loading && (
                <p className="text-[11px] text-slate-600 mt-2">
                  ↑ Pick a report above to see a real AI-powered breakdown of every factor.
                </p>
              )}
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <Brain className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-white mb-1">Sign in to use the XAI Suite</p>
              <p className="text-xs text-slate-500">You need an account to save and analyse startup reports.</p>
            </div>
          )}

          {/* ── loading ── */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass-card p-16 flex justify-center"
            >
              <LoadingSpinner size="lg" label="Loading real AI analysis…" />
            </motion.div>
          )}

          {/* ── results ── */}
          <AnimatePresence>
            {selected && !loading && (
              <motion.div
                key={selected.report_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-5"
              >
                {/* score hero */}
                <div className="glass-card p-5 flex flex-wrap items-center gap-6">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Overall Feasibility</p>
                    <div className="flex items-end gap-3">
                      <p className="text-5xl font-black" style={{ color: scoreColor(selected.overall_score) }}>
                        {selected.overall_score}
                        <span className="text-2xl text-slate-500 font-normal">%</span>
                      </p>
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full mb-1"
                        style={{
                          background: `${scoreColor(selected.overall_score)}18`,
                          color: scoreColor(selected.overall_score),
                          border: `1px solid ${scoreColor(selected.overall_score)}30`,
                        }}
                      >
                        {selected.feasibility_label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 truncate">{selected.startup_idea}</p>
                  </div>

                  {/* mini strength/weakness pills */}
                  <div className="flex flex-col gap-2">
                    {(selected.strengths || []).slice(0, 2).map(f => (
                      <div key={f.key} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span className="text-xs text-emerald-300 font-medium">{f.label}</span>
                        <span className="text-xs font-bold text-emerald-400">{f.score}</span>
                      </div>
                    ))}
                    {(selected.weaknesses || []).slice(0, 1).map(f => (
                      <div key={f.key} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/8 border border-red-500/20">
                        <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                        <span className="text-xs text-red-300 font-medium">{f.label}</span>
                        <span className="text-xs font-bold text-red-400">{f.score}</span>
                      </div>
                    ))}
                  </div>

                  {/* source badge */}
                  <div className="flex-shrink-0">
                    <div className="px-2.5 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                      <span className="text-[10px] text-brand-400 font-semibold">Real Gemini AI Data</span>
                    </div>
                  </div>
                </div>

                {/* tabs */}
                <div className="flex gap-1 p-1 bg-white/4 border border-white/8 rounded-xl">
                  {tabs.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex-1 justify-center
                        ${activeTab === t.id
                          ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                          : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {t.icon}{t.label}
                    </button>
                  ))}
                </div>

                {/* ── tab: OVERVIEW ── */}
                <AnimatePresence mode="wait">
                  {activeTab === 'overview' && (
                    <motion.div
                      key="overview"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="space-y-4"
                    >
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Bar chart */}
                        <div className="glass-card p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <BarChart2 className="w-4 h-4 text-brand-400" />
                            <h3 className="text-sm font-semibold text-white">Factor Scores</h3>
                            <span className="ml-auto text-[10px] text-slate-600">From Gemini AI</span>
                          </div>
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={barData} layout="vertical" margin={{ left: 90, right: 30 }}>
                              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={85} />
                              <Tooltip content={<BarTip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                              <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={18}>
                                {barData.map((entry, i) => (
                                  <Cell key={i} fill={entry.fill} />
                                ))}
                                <LabelList dataKey="score" position="right" style={{ fill: '#94a3b8', fontSize: 10 }} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Radar chart */}
                        <div className="glass-card p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            <h3 className="text-sm font-semibold text-white">Strength Radar</h3>
                          </div>
                          <ResponsiveContainer width="100%" height={240}>
                            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                              <PolarGrid stroke="rgba(255,255,255,0.06)" />
                              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#64748b' }} />
                              <Radar
                                name="Score" dataKey="value"
                                stroke="#4D96FF" fill="#4D96FF" fillOpacity={0.15} strokeWidth={2}
                              />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Factor cards */}
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(selected.factors || []).map(f => {
                          const displayScore = f.key === 'competitor_density' ? 100 - f.score : f.score
                          const color = scoreColor(displayScore)
                          return (
                            <motion.div
                              key={f.key}
                              whileHover={{ scale: 1.01 }}
                              className="glass-card p-4"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span style={{ color }} className="flex-shrink-0">
                                  {FACTOR_ICONS[f.key]}
                                </span>
                                <span className="text-xs font-semibold text-white">{f.label}</span>
                                <span className="ml-auto text-xs font-black" style={{ color }}>
                                  {f.score}
                                </span>
                              </div>
                              {/* progress bar */}
                              <div className="h-1.5 rounded-full bg-white/6 overflow-hidden mb-2">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: color }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${f.score}%` }}
                                  transition={{ duration: 0.8, ease: 'easeOut' }}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] text-slate-600 leading-snug pr-1">{f.description}</p>
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                  style={{ background: `${color}15`, color }}
                                >
                                  {scoreLabel(displayScore)}
                                </span>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* ── tab: WHAT-IF ── */}
                  {activeTab === 'whatif' && (
                    <motion.div
                      key="whatif"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="space-y-3"
                    >
                      <div className="glass-card p-4 flex items-start gap-3 border-brand-500/20">
                        <Zap className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-white mb-0.5">What-If Simulation</p>
                          <p className="text-xs text-slate-400">
                            See exactly how much your overall score would improve if you boosted each factor by +15 points.
                            This helps you prioritise which area to work on first.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {(selected.whatif_simulations || []).map((w, i) => {
                          const isPositive = w.delta > 0
                          const isCompetitor = w.key === 'competitor_density'
                          return (
                            <motion.div
                              key={w.key}
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="glass-card p-4"
                            >
                              <div className="flex items-center gap-3 mb-3">
                                <span className="text-slate-400 flex-shrink-0">
                                  {FACTOR_ICONS[w.key]}
                                </span>
                                <div className="flex-1">
                                  <p className="text-xs font-semibold text-white">{w.factor}</p>
                                  <p className="text-[10px] text-slate-500">
                                    {isCompetitor
                                      ? `Reduce from ${w.current_score} → ${w.boosted_score} (lower = fewer competitors)`
                                      : `Improve from ${w.current_score} → ${w.boosted_score}`}
                                  </p>
                                </div>
                                {isPositive && (
                                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                    <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                                    <span className="text-xs font-black text-emerald-400">+{w.delta}%</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex-1">
                                  <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                                    <span>Before</span>
                                    <span className="font-semibold text-slate-400">{w.overall_before}%</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-white/6 overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{
                                        width: `${w.overall_before}%`,
                                        backgroundColor: scoreColor(w.overall_before)
                                      }}
                                    />
                                  </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                                    <span>After</span>
                                    <span className="font-semibold" style={{ color: scoreColor(w.overall_after) }}>
                                      {w.overall_after}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-white/6 overflow-hidden">
                                    <motion.div
                                      className="h-full rounded-full"
                                      style={{ backgroundColor: scoreColor(w.overall_after) }}
                                      initial={{ width: `${w.overall_before}%` }}
                                      animate={{ width: `${w.overall_after}%` }}
                                      transition={{ duration: 0.8, ease: 'easeOut' }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* ── tab: AI INSIGHTS ── */}
                  {activeTab === 'insights' && (
                    <motion.div
                      key="insights"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="space-y-4"
                    >
                      {/* Advantages */}
                      {selected.advantages?.length > 0 && (
                        <div className="glass-card p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                            <h3 className="text-sm font-semibold text-white">Advantages</h3>
                          </div>
                          <ul className="space-y-2">
                            {selected.advantages.map((a, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                                <p className="text-xs text-slate-300">{a}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Risks */}
                      {selected.risks?.length > 0 && (
                        <div className="glass-card p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            <h3 className="text-sm font-semibold text-white">Risks & Challenges</h3>
                          </div>
                          <ul className="space-y-2">
                            {selected.risks.map((r, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                                <p className="text-xs text-slate-300">{r}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Research Gaps */}
                      {selected.research_gaps?.length > 0 && (
                        <div className="glass-card p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <Search className="w-4 h-4 text-violet-400" />
                            <h3 className="text-sm font-semibold text-white">Research Gaps</h3>
                          </div>
                          <ul className="space-y-2">
                            {selected.research_gaps.map((g, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                                <p className="text-xs text-slate-300">{g}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Innovation Opportunities */}
                      {selected.innovation_opportunities?.length > 0 && (
                        <div className="glass-card p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="w-4 h-4 text-brand-400" />
                            <h3 className="text-sm font-semibold text-white">Innovation Opportunities</h3>
                          </div>
                          <ul className="space-y-2">
                            {selected.innovation_opportunities.map((o, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-1.5 flex-shrink-0" />
                                <p className="text-xs text-slate-300">{o}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {!selected.advantages?.length && !selected.risks?.length &&
                        !selected.research_gaps?.length && !selected.innovation_opportunities?.length && (
                        <div className="glass-card p-8 text-center">
                          <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-xs text-slate-500">
                            No detailed AI insights were saved for this report.
                            Re-analyse the idea in the Startup AI page for richer data.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ── tab: FEASIBILITY ── */}
                  {activeTab === 'feasibility' && (
                    <motion.div
                      key="feasibility"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="space-y-4"
                    >
                      {[
                        {
                          label: 'Technical Feasibility',
                          icon: <Microscope className="w-4 h-4 text-violet-400" />,
                          text: selected.technical_feasibility,
                          color: '#a78bfa',
                        },
                        {
                          label: 'Market Feasibility',
                          icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
                          text: selected.market_feasibility,
                          color: '#10b981',
                        },
                        {
                          label: 'Business Feasibility',
                          icon: <DollarSign className="w-4 h-4 text-amber-400" />,
                          text: selected.business_feasibility,
                          color: '#f59e0b',
                        },
                      ].map(({ label, icon, text, color }) => (
                        <div key={label} className="glass-card p-5">
                          <div className="flex items-center gap-2 mb-3">
                            {icon}
                            <h3 className="text-sm font-semibold text-white">{label}</h3>
                          </div>
                          {text ? (
                            <p className="text-xs text-slate-300 leading-relaxed">{text}</p>
                          ) : (
                            <p className="text-xs text-slate-600 italic">
                              No AI reasoning available for this section. Re-analyse with the latest model for full details.
                            </p>
                          )}
                          <div className="mt-3 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            )}
          </AnimatePresence>

          {/* empty state */}
          {!selected && !loading && isAuthenticated && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass-card p-12 text-center"
            >
              <Brain className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-sm font-semibold text-slate-400 mb-1">Pick a report to get started</p>
              <p className="text-xs text-slate-600">
                Select one of your saved startup analyses above and we'll explain exactly why it scored the way it did — using real Gemini AI data.
              </p>
            </motion.div>
          )}

        </div>
      </main>
    </div>
  )
}
