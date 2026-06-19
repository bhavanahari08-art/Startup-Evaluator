import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Send, ChevronDown, ChevronUp, Brain, BookOpen,
  TrendingUp, AlertTriangle, CheckCircle, XCircle, Lightbulb,
  Clock, DollarSign, Users, Info, FlaskConical, ExternalLink,
  Star, GitBranch, Zap, Target, FileText,
  Search, Microscope, BarChart2, ShieldCheck, Download
} from 'lucide-react'
import toast from 'react-hot-toast'
import { evaluateApi, researchApi } from '../api/client'
import ScoreGauge from '../components/ScoreGauge'
import LoadingSpinner from '../components/LoadingSpinner'
import Sidebar, { notifySidebarRefresh } from '../components/Sidebar'

const STEPS = [
  { id: 'understand',  icon: Brain,       label: 'Understanding Idea'      },
  { id: 'research',    icon: Search,      label: 'Research Analysis'       },
  { id: 'patent',      icon: Microscope,  label: 'Patent Analysis'         },
  { id: 'competitor',  icon: BarChart2,   label: 'Competitor Analysis'     },
  { id: 'feasibility', icon: TrendingUp,  label: 'Feasibility Assessment'  },
  { id: 'xai',         icon: ShieldCheck, label: 'Explainable AI Analysis' },
  { id: 'report',      icon: FileText,    label: 'Final Report Generation' },
]

const STEP_IDS = STEPS.map(s => s.id)

function ProgressStepper({ currentStep }) {
  const idx = STEP_IDS.indexOf(currentStep)
  return (
    <div className="glass-card p-4 space-y-2">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Analysis Progress</p>
      {STEPS.map((step, i) => {
        const done = i < idx, active = i === idx, Icon = step.icon
        return (
          <motion.div key={step.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: i > idx ? 0.3 : 1, x: 0 }}
            transition={{ delay: i * 0.06 }} className="flex items-center gap-2.5">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
              ${done ? 'bg-emerald-500/20 border border-emerald-500/40'
              : active ? 'bg-brand-500/25 border border-brand-500/60'
              : 'bg-white/5 border border-white/10'}`}>
              {done ? <CheckCircle className="w-3 h-3 text-emerald-400" />
                : active ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Icon className="w-3 h-3 text-brand-400" /></motion.div>
                : <Icon className="w-3 h-3 text-slate-600" />}
            </div>
            <span className={`text-xs font-medium ${done ? 'text-emerald-400' : active ? 'text-white' : 'text-slate-600'}`}>{step.label}</span>
            {active && <span className="ml-auto text-[10px] text-brand-400 animate-pulse">Running…</span>}
            {done && <CheckCircle className="ml-auto w-3 h-3 text-emerald-500" />}
          </motion.div>
        )
      })}
    </div>
  )
}

function Section({ title, icon: Icon, iconClass = 'text-brand-400', badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const badgeStyle = badge === 'Novel'
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : badge === 'Partially Exists' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : badge ? 'text-coral-400 bg-coral-500/10 border-coral-500/20' : ''
  return (
    <div className="glass-card overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/2 transition-colors" aria-expanded={open}>
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 ${iconClass}`} />
          <span className="font-semibold text-sm text-white">{title}</span>
          {badge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyle}`}>{badge}</span>}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="b" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
            <div className="px-5 pb-5 pt-2 border-t border-white/5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Tags({ items = [], variant = 'blue' }) {
  const cls = { blue: 'tag', coral: 'tag-coral', green: 'tag-green', amber: 'tag-amber', violet: 'tag-violet' }[variant] || 'tag'
  if (!items?.length) return null
  return <div className="flex flex-wrap gap-1.5 mt-2">{items.map((x, i) => <span key={i} className={cls}>{x}</span>)}</div>
}

function List({ items = [], icon: Icon = CheckCircle, iconClass = 'text-brand-400' }) {
  if (!items?.length) return <p className="text-xs text-slate-500 mt-1">None listed</p>
  return (
    <ul className="space-y-1.5 mt-2">
      {items.map((x, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
          <Icon className={`w-3.5 h-3.5 ${iconClass} mt-0.5 flex-shrink-0`} /><span>{x}</span>
        </li>
      ))}
    </ul>
  )
}

function PaperCard({ paper }) {
  const authors = (paper.authors || []).slice(0, 2).map(a => a.name || a).join(', ')
  return (
    <a href={paper.url || '#'} target="_blank" rel="noopener noreferrer"
      className="block glass-card p-3.5 hover:border-brand-500/25 transition-all group">
      <p className="text-xs font-semibold text-white group-hover:text-brand-300 line-clamp-2 mb-1.5">
        {paper.title || 'Untitled'} <ExternalLink className="w-2.5 h-2.5 inline opacity-50" />
      </p>
      <div className="flex items-center flex-wrap gap-3 text-[10px] text-slate-500">
        {paper.year && <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{paper.year}</span>}
        {paper.citationCount != null && <span>📎 {paper.citationCount} citations</span>}
        {authors && <span className="truncate">{authors}</span>}
      </div>
      {paper.abstract && <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{paper.abstract}</p>}
    </a>
  )
}

function AIMetricBar({ label, value, reasoning }) {
  const [showR, setShowR] = useState(false)
  const isComp = label === 'Competitor Density'
  const color = isComp
    ? (value >= 65 ? '#FF6B6B' : value >= 35 ? '#f59e0b' : '#10b981')
    : (value >= 65 ? '#10b981' : value >= 35 ? '#f59e0b' : '#FF6B6B')
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-300">{label}</span>
          {reasoning && <button onClick={() => setShowR(s => !s)} className="text-slate-600 hover:text-slate-400 transition-colors"><Info className="w-3 h-3" /></button>}
        </div>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{value}<span className="text-xs text-slate-500">/100</span></span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/8 overflow-hidden">
        <motion.div className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}50` }}
          initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
      </div>
      <AnimatePresence>
        {showR && reasoning && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="text-[11px] text-slate-500 bg-white/3 rounded-lg px-3 py-1.5 leading-relaxed">
            <Brain className="w-3 h-3 inline mr-1 text-brand-400" />{reasoning}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

const DEFAULT_PROFILE = {
  founder_location: 1, education_level: 1, funding_access: 1, gender: 1,
  patent_novelty: 55, research_support: 45, market_demand: 60,
  competitor_density: 30, team_experience: 55,
}

export default function Dashboard() {
  const [idea, setIdea]           = useState('')
  const [profile, setProfile]     = useState(DEFAULT_PROFILE)
  const [loading, setLoading]     = useState(false)
  const [currentStep, setStep]    = useState(null)
  const [result, setResult]       = useState(null)
  const [activeReport, setReport] = useState(null)
  const [patentLoading, setPL]    = useState(false)
  const [patentData, setPatent]   = useState(null)

  const simulateSteps = useCallback(() => {
    const delays = [0, 600, 2000, 4000, 6500, 9000, 12000]
    delays.forEach((d, i) => setTimeout(() => setStep(STEP_IDS[i]), d))
  }, [])

  const handleEvaluate = async () => {
    const trimmed = idea.trim()
    if (!trimmed) { toast.error('Please enter a startup idea'); return }
    setResult(null); setPatent(null); setLoading(true); simulateSteps()
    try {
      const { data } = await evaluateApi.evaluate({ startup_idea: trimmed, profile })
      setResult(data); setStep(null)
      if (data.report_id) notifySidebarRefresh()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Evaluation failed')
      setStep(null)
    } finally { setLoading(false) }
  }

  const handlePatentDeepDive = async () => {
    if (!result) return
    setPL(true)
    try {
      const { data } = await researchApi.patentKeywords(idea, result.genai_analysis?.patent_links || [])
      setPatent(data)
      toast.success('Patent analysis complete')
    } catch { toast.error('Patent analysis failed') }
    finally { setPL(false) }
  }

  const analysis = result?.genai_analysis || {}
  const papers   = result?.papers || []
  const metrics  = [
    { label: 'Patent Novelty',     key: 'patent_novelty_score',      rkey: 'patent_novelty'     },
    { label: 'Research Support',   key: 'research_support_score',    rkey: 'research_support'   },
    { label: 'Market Demand',      key: 'market_demand_score',       rkey: 'market_demand'      },
    { label: 'Competitor Density', key: 'competitor_density_score',  rkey: 'competitor_density' },
    { label: 'Team Experience',    key: 'team_experience_score',     rkey: 'team_experience'    },
  ]

  return (
    <div className="flex h-full">
      <Sidebar onSelectReport={setReport} activeReportId={activeReport} />
      <main className="flex-1 overflow-y-auto scroll-area">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Startup Feasibility Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1">Full ML + XAI evaluation pipeline with bias-aware scoring.</p>
          </div>

          {/* Input */}
          <div className="glass-card p-5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Startup Idea</label>
            <div className="flex gap-3">
              <textarea value={idea} onChange={e => setIdea(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEvaluate() } }}
                placeholder="Describe your startup idea…"
                rows={3} disabled={loading}
                className="flex-1 input-field resize-none leading-relaxed" />
              <motion.button onClick={handleEvaluate} disabled={!idea.trim() || loading} whileTap={{ scale: 0.97 }}
                className="btn-primary self-end flex items-center gap-2 text-sm">
                {loading
                  ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Analyzing…</>
                  : <><Sparkles className="w-4 h-4" />Evaluate</>}
              </motion.button>
            </div>
            
            {/* Founder Profile Simulator for Demo */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Users className="w-3 h-3 text-violet-400"/> Founder Profile Simulator (For Bias Testing)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <select value={profile.gender} onChange={e => setProfile({...profile, gender: parseInt(e.target.value)})} className="input-field text-xs py-2">
                  <option value={1}>Male</option>
                  <option value={0}>Female</option>
                </select>
                <select value={profile.founder_location} onChange={e => setProfile({...profile, founder_location: parseInt(e.target.value)})} className="input-field text-xs py-2">
                  <option value={1}>Urban</option>
                  <option value={0}>Rural</option>
                </select>
                <select value={profile.funding_access} onChange={e => setProfile({...profile, funding_access: parseInt(e.target.value)})} className="input-field text-xs py-2">
                  <option value={1}>High Funding</option>
                  <option value={0}>Low Funding</option>
                </select>
                <select value={profile.education_level} onChange={e => setProfile({...profile, education_level: parseInt(e.target.value)})} className="input-field text-xs py-2">
                  <option value={1}>Tier 1 Ed</option>
                  <option value={0}>Tier 2/3 Ed</option>
                </select>
              </div>
            </div>

            <p className="text-[10px] text-slate-600 mt-2">Press Enter to evaluate · Shift+Enter for new line</p>
          </div>

          {/* Progress stepper */}
          <AnimatePresence>
            {loading && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="grid md:grid-cols-2 gap-5">
                <ProgressStepper currentStep={currentStep} />
                <div className="glass-card p-8 flex flex-col items-center justify-center gap-4 text-center">
                  <LoadingSpinner size="lg" />
                  <p className="text-sm text-slate-400">Running full AI pipeline…</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {result && !loading && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {/* Score header */}
                <div className="glass-card p-5 flex items-center gap-5">
                  <ScoreGauge score={result.feasibility_score || 0} label={result.feasibility_label} size={100} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Report #{result.report_id || '—'}</p>
                    <p className="text-sm font-semibold text-white mb-2 line-clamp-2">{idea}</p>
                    {analysis.domain_classification && <span className="tag">{analysis.domain_classification}</span>}
                  </div>
                </div>

                <Section title="AI Understanding" icon={Brain} defaultOpen>
                  <p className="text-sm text-slate-300 leading-relaxed mt-1">{analysis.what_ai_understood}</p>
                  <p className="text-sm text-slate-400 mt-3 leading-relaxed">{analysis.startup_summary}</p>
                  <Tags items={analysis.keywords} variant="blue" />
                </Section>

                <Section title="Novelty Status" icon={Star} iconClass="text-amber-400"
                  badge={analysis.idea_novelty_status}
                  defaultOpen={false}>
                  <p className="text-sm text-slate-300 mt-2 leading-relaxed">{analysis.what_currently_exists}</p>
                  <div className="grid sm:grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-1">Existing Solutions</p>
                      <List items={analysis.existing_solutions} icon={XCircle} iconClass="text-coral-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-1">Suggested New Features</p>
                      <List items={analysis.suggested_new_features} icon={Zap} iconClass="text-amber-400" />
                    </div>
                  </div>
                </Section>

                <Section title="Research Analysis" icon={BookOpen} iconClass="text-violet-400">
                  <div className="grid sm:grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-1">Research Gaps</p>
                      <List items={analysis.research_gaps} icon={AlertTriangle} iconClass="text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-1">Innovation Opportunities</p>
                      <List items={analysis.innovation_opportunities} icon={Lightbulb} iconClass="text-brand-400" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {papers.slice(0, 4).map((p, i) => <PaperCard key={i} paper={p} />)}
                  </div>
                </Section>

                <Section title="AI Metric Scores" icon={BarChart2} iconClass="text-emerald-400">
                  <div className="space-y-4 mt-2">
                    {metrics.map(m => (
                      <AIMetricBar key={m.key} label={m.label}
                        value={analysis[m.key] || 0}
                        reasoning={analysis.metric_reasoning?.[m.rkey]} />
                    ))}
                  </div>
                </Section>

                <Section title="Feasibility Report" icon={TrendingUp} iconClass="text-emerald-400">
                  <div className="grid sm:grid-cols-3 gap-3 mt-2">
                    {[['Technical', analysis.technical_feasibility], ['Market', analysis.market_feasibility], ['Business', analysis.business_feasibility]].map(([k, v]) => (
                      <div key={k} className="p-3 rounded-xl bg-white/3 border border-white/5">
                        <p className="text-[10px] font-semibold text-slate-400 mb-1">{k}</p>
                        <p className="text-xs text-slate-300 leading-relaxed">{v || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-1">Advantages</p>
                      <List items={analysis.advantages} icon={CheckCircle} iconClass="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-1">Risks</p>
                      <List items={analysis.risks} icon={AlertTriangle} iconClass="text-coral-400" />
                    </div>
                  </div>
                </Section>

                <Section title="Implementation Plan" icon={Clock} iconClass="text-amber-400">
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <div className="glass-card p-3 text-center">
                      <p className="text-[10px] text-slate-400">Timeline</p>
                      <p className="text-base font-bold text-white">{analysis.development_time_months}<span className="text-xs text-slate-400">mo</span></p>
                    </div>
                    <div className="glass-card p-3 text-center">
                      <p className="text-[10px] text-slate-400">Budget</p>
                      <p className="text-sm font-bold text-white">₹{(analysis.budget_inr||0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="glass-card p-3 text-center">
                      <p className="text-[10px] text-slate-400">Team</p>
                      <p className="text-base font-bold text-white">{(analysis.team_roles||[]).length} roles</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-slate-400 mb-2">Team Roles</p>
                    <List items={analysis.team_roles} icon={Users} iconClass="text-brand-400" />
                  </div>
                </Section>

                {/* Patent deep dive */}
                <div className="glass-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Microscope className="w-4 h-4 text-violet-400" />
                      <h3 className="text-sm font-semibold text-white">Patent Intelligence</h3>
                    </div>
                    <button onClick={handlePatentDeepDive} disabled={patentLoading}
                      className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
                      {patentLoading ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                      Deep Patent Analysis
                    </button>
                  </div>
                  {patentData && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-300">{patentData.patent_analysis}</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-semibold text-emerald-400 mb-1">Uniqueness Opportunities</p>
                          <List items={patentData.uniqueness_opportunities} icon={Star} iconClass="text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-coral-400 mb-1">Conflict Risks</p>
                          <List items={patentData.conflict_risks} icon={AlertTriangle} iconClass="text-coral-400" />
                        </div>
                      </div>
                    </div>
                  )}
                  {!patentData && <p className="text-xs text-slate-500">Click "Deep Patent Analysis" to get Gemini-powered patent intelligence for this idea.</p>}
                </div>

                <div className="glass-card p-4 bg-emerald-500/5 border-emerald-500/20">
                  <div className="flex items-start gap-3">
                    <Target className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-400 mb-1">Final Verdict</p>
                      <p className="text-sm text-slate-300 leading-relaxed">{analysis.final_verdict}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!result && !loading && (
            <div className="glass-card p-12 text-center">
              <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Enter a startup idea above to run the full evaluation pipeline.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
