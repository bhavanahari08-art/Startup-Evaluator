import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Scale, Shield, AlertTriangle, CheckCircle, BarChart2,
  Activity, Zap, Info, Database, Users, TrendingUp,
  Eye, Lock, Award, ChevronDown, ChevronUp
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie
} from 'recharts'
import toast from 'react-hot-toast'
import { biasApi } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import FairnessBar from '../components/FairnessBar'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'

const ATTRS = [
  { key: 'gender',           label: 'Gender',          desc: 'Male vs Female founders'        },
  { key: 'founder_location', label: 'Location',         desc: 'Urban vs Rural founders'        },
  { key: 'education_level',  label: 'Education',        desc: 'Tier 1 vs Tier 2/3 institutions'},
  { key: 'funding_access',   label: 'Funding Access',   desc: 'High vs Low capital access'     },
]

const PIE_COLORS = ['#4D96FF','#10b981','#f59e0b','#FF6B6B','#a78bfa']

function TrustCard({ icon: Icon, label, value, subtext, color }) {
  return (
    <div className="glass-card p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <p className="text-xs font-semibold text-slate-400">{label}</p>
      </div>
      {typeof value === 'number' ? (
        <>
          <p className="text-2xl font-black" style={{ color: value >= 70 ? '#10b981' : value >= 50 ? '#f59e0b' : '#FF6B6B' }}>
            {value}<span className="text-sm text-slate-500 font-normal">%</span>
          </p>
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <motion.div className="h-full rounded-full"
              style={{ backgroundColor: value >= 70 ? '#10b981' : value >= 50 ? '#f59e0b' : '#FF6B6B' }}
              initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 1 }} />
          </div>
        </>
      ) : (
        <p className={`text-lg font-black ${value === 'Low' ? 'text-emerald-400' : value === 'Medium' ? 'text-amber-400' : 'text-coral-400'}`}>
          {value}
        </p>
      )}
      {subtext && <p className="text-[10px] text-slate-600 mt-0.5">{subtext}</p>}
    </div>
  )
}

function MetricCard({ label, value, description }) {
  const abs    = Math.abs(value)
  const status = abs <= 0.05 ? 'good' : abs <= 0.15 ? 'warn' : 'bad'
  const color  = { good: '#10b981', warn: '#f59e0b', bad: '#FF6B6B' }[status]
  const Icon   = status === 'good' ? CheckCircle : AlertTriangle
  return (
    <div className="glass-card p-4" style={{ borderColor: `${color}20` }}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-slate-400">{label}</p>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value.toFixed(4)}</p>
      <p className="text-[10px] text-slate-500 mt-1">{description}</p>
      <div className="mt-2 h-1 rounded-full bg-white/8">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, abs * 200)}%`, background: color }} />
      </div>
    </div>
  )
}

function CollapsibleSection({ title, icon: Icon, iconClass, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="glass-card overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/2 transition-colors">
        <div className="flex items-center gap-2"><Icon className={`w-4 h-4 ${iconClass}`} /><span className="text-sm font-semibold text-white">{title}</span></div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
            <div className="px-5 pb-5 pt-2 border-t border-white/5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1f2e] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-white font-semibold mb-1">{label}</p>
      {payload.map(p => <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {(p.value * 100).toFixed(1)}%</p>)}
    </div>
  )
}

export default function BiasPage() {
  const { isAuthenticated } = useAuth()
  const [selected, setSelected]         = useState('gender')
  const [loadingAudit, setLAudit]       = useState(false)
  const [loadingMit, setLMit]           = useState(false)
  const [auditData, setAudit]           = useState(null)
  const [mitData, setMit]               = useState(null)
  const [activeReport, setActiveReport] = useState(null)

  const runAudit = async () => {
    setLAudit(true); setAudit(null); setMit(null)
    try {
      const { data } = await biasApi.audit(selected)
      setAudit(data)
      toast.success('Bias audit complete')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Audit failed')
    } finally { setLAudit(false) }
  }

  const runMitigate = async () => {
    if (!auditData) { toast.error('Run bias audit first'); return }
    setLMit(true)
    try {
      const { data } = await biasApi.mitigate(selected)
      setMit(data)
      toast.success('Mitigation complete')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Mitigation failed')
    } finally { setLMit(false) }
  }

  const groupBars = (auditData?.group_metrics || []).map(g => ({
    name: g.group_name,
    'Selection Rate':     g.selection_rate,
    'True Positive Rate': g.true_positive_rate,
    'False Positive Rate':g.false_positive_rate,
  }))

  const allIntersect = auditData?.all_intersectional || {}
  const transparency = auditData?.data_transparency  || {}
  const trust        = auditData?.trust_scores        || {}
  const source       = auditData?.data_source
  const nRecords     = auditData?.n_records

  return (
    <div className="flex h-full">
      <Sidebar onSelectReport={setActiveReport} activeReportId={activeReport} />
      <main className="flex-1 overflow-y-auto scroll-area">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Scale className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-white">Bias Audit & Fairness Analysis</h1>
              <p className="text-sm text-slate-400">Research-grade fairness metrics using Fairlearn — on real startup report data</p>
            </div>
          </div>

          {/* Data source banner — always shows the synthetic dataset explanation */}
          {source && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-brand-500/8 border-brand-500/25">
              <Database className="w-4 h-4 flex-shrink-0 text-brand-400" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-brand-400">
                  Auditing the ML model on {nRecords}-record synthetic dataset (held-out test split)
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  The synthetic data was intentionally designed with demographic bias injected across Gender, Location, Education, and Funding —
                  making it ideal for demonstrating bias detection and mitigation.
                </p>
              </div>
            </motion.div>
          )}

          {/* Attribute selector + run buttons */}
          <div className="glass-card p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Select Protected Attribute</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              {ATTRS.map(a => (
                <button key={a.key} onClick={() => setSelected(a.key)}
                  className={`p-3 rounded-xl border text-left transition-all
                    ${selected === a.key ? 'bg-brand-500/12 border-brand-500/30 text-white' : 'bg-white/3 border-white/8 text-slate-400 hover:border-white/15 hover:text-slate-200'}`}>
                  <p className="text-xs font-semibold">{a.label}</p>
                  <p className="text-[11px] mt-0.5 opacity-70">{a.desc}</p>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <motion.button onClick={runAudit} disabled={loadingAudit} whileTap={{ scale: 0.97 }}
                className="btn-primary flex items-center gap-2 text-sm">
                {loadingAudit ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Scale className="w-4 h-4" />}
                Run Bias Audit
              </motion.button>
              <motion.button onClick={runMitigate} disabled={loadingMit || !auditData} whileTap={{ scale: 0.97 }}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-40">
                {loadingMit ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Zap className="w-4 h-4" />}
                Run Fairlearn Mitigation
              </motion.button>
            </div>
          </div>

          {/* Loading */}
          <AnimatePresence>
            {loadingAudit && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="glass-card p-12 flex justify-center">
                <LoadingSpinner size="lg" label="Computing fairness metrics on real data…" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Results ── */}
          <AnimatePresence>
            {auditData && !loadingAudit && (
              <motion.div key="audit" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

                {/* Trustworthiness Dashboard */}
                {Object.keys(trust).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Award className="w-3.5 h-3.5 text-amber-400" />Trustworthiness Dashboard
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <TrustCard icon={Eye}       label="Explainability"  value={trust.explainability} color="text-brand-400"   subtext="Factor transparency" />
                      <TrustCard icon={Scale}     label="Fairness"        value={trust.fairness}        color="text-emerald-400" subtext="Demographic parity" />
                      <TrustCard icon={TrendingUp}label="Confidence"      value={trust.confidence}      color="text-violet-400"  subtext="Prediction quality" />
                      <TrustCard icon={Lock}      label="Transparency"    value={trust.transparency}    color="text-amber-400"   subtext="Data source clarity" />
                      <TrustCard icon={AlertTriangle} label="Bias Risk"   value={trust.bias_risk}       color="text-coral-400"   subtext="Overall bias level" />
                    </div>
                  </div>
                )}

                {/* Data Transparency */}
                {Object.keys(transparency).length > 0 && (
                  <CollapsibleSection title="Dataset Distribution (1500 synthetic records)" icon={Database} iconClass="text-brand-400" defaultOpen>
                    <p className="text-xs text-slate-500 mb-4">
                      Distribution of protected attributes in the synthetic training dataset.
                      Bias was intentionally injected: Urban, Tier-1, High-Funding, and Male founders were scored higher to simulate real-world historical bias.
                    </p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {Object.entries(transparency).map(([attr, dist]) => {
                        const total = Object.values(dist).reduce((a, b) => a + b, 0)
                        const pieData = Object.entries(dist).map(([k, v]) => ({ name: k, value: v }))
                        return (
                          <div key={attr} className="text-center">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">
                              {attr.replace('_', ' ')}
                            </p>
                            <ResponsiveContainer width="100%" height={100}>
                              <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" outerRadius={40} dataKey="value"
                                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                                  labelLine={false} style={{ fontSize: 9 }}>
                                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(v) => `${v} (${((v/total)*100).toFixed(0)}%)`} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="mt-1 space-y-0.5">
                              {pieData.map((d, i) => (
                                <div key={i} className="flex items-center justify-between text-[10px]">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                    <span className="text-slate-400">{d.name}</span>
                                  </div>
                                  <span className="text-slate-300">{d.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Core fairness metrics */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5 text-violet-400" />Core Fairness Metrics
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <MetricCard label="Demographic Parity Difference" value={auditData.demographic_parity_difference}
                      description="Selection rate gap between groups. Ideal: 0" />
                    <MetricCard label="Equal Opportunity Difference"  value={auditData.equal_opportunity_difference}
                      description="True positive rate gap. Ideal: 0" />
                    <MetricCard label="Equalized Odds Difference"     value={auditData.equalized_odds_difference}
                      description="Combined TPR + FPR gap. Ideal: 0" />
                  </div>
                </div>

                {/* Fairness bars */}
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-brand-400" />
                    <h3 className="text-sm font-semibold text-white">Fairness Metric Visualisation</h3>
                    <span className="ml-auto text-[10px] text-slate-600">|value| closer to 0 = fairer</span>
                  </div>
                  <div className="space-y-4">
                    <FairnessBar label="Demographic Parity Difference" value={auditData.demographic_parity_difference} />
                    <FairnessBar label="Equal Opportunity Difference"  value={auditData.equal_opportunity_difference} />
                    <FairnessBar label="Equalized Odds Difference"     value={auditData.equalized_odds_difference} />
                  </div>
                </div>

                {/* Group comparison */}
                <CollapsibleSection title="Group-Level Analysis (Selection Rate / TPR / FPR)" icon={Users} iconClass="text-violet-400" defaultOpen>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={groupBars} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                      <Tooltip content={<Tip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                      <Bar dataKey="Selection Rate"      fill="#4D96FF" radius={[4,4,0,0]} />
                      <Bar dataKey="True Positive Rate"  fill="#10b981" radius={[4,4,0,0]} />
                      <Bar dataKey="False Positive Rate" fill="#FF6B6B" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CollapsibleSection>

                {/* Intersectional fairness — all combos */}
                {Object.keys(allIntersect).length > 0 && (
                  <CollapsibleSection title="Intersectional Fairness Analysis" icon={Shield} iconClass="text-emerald-400" defaultOpen>
                    <p className="text-xs text-slate-500 mb-4">Selection rates across protected attribute combinations. Equal bars = fair treatment.</p>
                    <div className="space-y-6">
                      {Object.entries(allIntersect).map(([pairLabel, combo]) => {
                        const bars = Object.entries(combo).map(([k, v]) => ({ name: k, value: v }))
                        return (
                          <div key={pairLabel}>
                            <p className="text-xs font-semibold text-slate-300 mb-2">{pairLabel}</p>
                            <ResponsiveContainer width="100%" height={Math.max(120, bars.length * 30)}>
                              <BarChart data={bars} layout="vertical" margin={{ left: 110, right: 40 }}>
                                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v.toFixed(0)}%`} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <Tooltip formatter={v => `${v.toFixed(1)}%`} />
                                <Bar dataKey="value" radius={[0,4,4,0]}>
                                  {bars.map((e, i) => (
                                    <Cell key={i} fill={e.value > 65 ? '#FF6B6B' : e.value > 35 ? '#f59e0b' : '#10b981'} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )
                      })}
                    </div>
                  </CollapsibleSection>
                )}

              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Mitigation results ── */}
          <AnimatePresence>
            {loadingMit && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="glass-card p-12 flex justify-center">
                <LoadingSpinner size="lg" label="Training Fairlearn ThresholdOptimizer…" />
              </motion.div>
            )}
            {mitData && !loadingMit && (
              <motion.div key="mit" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">Fairlearn Mitigation Results</h3>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15 mb-5">
                    <p className="text-sm text-emerald-300 leading-relaxed">{mitData.improvement_summary}</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-3">Model Performance (Before vs After)</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={[
                          { metric: 'Accuracy', baseline: mitData.baseline.accuracy, mitigated: mitData.mitigated.accuracy },
                          { metric: 'F1 Score', baseline: mitData.baseline.f1_score, mitigated: mitData.mitigated.f1_score },
                        ]}>
                          <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                          <Tooltip formatter={v => `${(v*100).toFixed(2)}%`} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="baseline"  name="Before" fill="#FF6B6B" radius={[4,4,0,0]} />
                          <Bar dataKey="mitigated" name="After"  fill="#4D96FF" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-3">Fairness Metrics (lower = fairer)</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={[
                          { metric: 'Dem. Parity', baseline: mitData.baseline.demographic_parity_difference, mitigated: mitData.mitigated.demographic_parity_difference },
                          { metric: 'Eq. Opp.',    baseline: mitData.baseline.equal_opportunity_difference,  mitigated: mitData.mitigated.equal_opportunity_difference  },
                          { metric: 'Eq. Odds',    baseline: mitData.baseline.equalized_odds_difference,     mitigated: mitData.mitigated.equalized_odds_difference     },
                        ]}>
                          <XAxis dataKey="metric" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="baseline"  name="Before" fill="#FF6B6B" radius={[4,4,0,0]} />
                          <Bar dataKey="mitigated" name="After"  fill="#10b981" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="mt-4 p-3 rounded-xl bg-brand-500/5 border border-brand-500/15 flex gap-2">
                    <Info className="w-3.5 h-3.5 text-brand-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-300 leading-relaxed">
                      The mitigated model uses Fairlearn's <strong>ThresholdOptimizer</strong> with demographic parity constraint.
                      The accuracy–fairness tradeoff is intentional: reducing bias slightly reduces raw accuracy.
                      This is the expected and acceptable cost of building fair AI systems.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {!auditData && !loadingAudit && (
            <div className="glass-card p-12 text-center">
              <Scale className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-400 mb-1">Select an attribute and run the audit</p>
              <p className="text-xs text-slate-600">The audit will use your real saved startup reports when available, ensuring meaningful real-world fairness analysis.</p>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
