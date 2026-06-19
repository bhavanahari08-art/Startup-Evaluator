import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Send, Brain, Search, Microscope, BarChart2, TrendingUp,
  ShieldCheck, FileText, CheckCircle, AlertTriangle, Lightbulb,
  Clock, DollarSign, Users, ExternalLink, ChevronDown, ChevronUp,
  Globe, BookOpen, FlaskConical, Zap, Target, XCircle, Info,
  Download, RefreshCw, Award, GitBranch, Package, Layers, Map,
  Scissors, ArrowDownCircle, Receipt, IndianRupee, Rocket, Trophy, GraduationCap
} from 'lucide-react'
import toast from 'react-hot-toast'
import { startupApi } from '../api/client'
import { configApi } from '../api/client'
import ScoreGauge from '../components/ScoreGauge'
import LoadingSpinner from '../components/LoadingSpinner'
import Sidebar, { notifySidebarRefresh } from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie
} from 'recharts'

// ── Analysis step sequence ──────────────────────────────────────────────────
const STEPS = [
  { id: 'understand',  icon: Brain,       label: 'Understanding Your Idea',   desc: 'AI parsing and interpreting the concept…'     },
  { id: 'domain',      icon: Layers,      label: 'Identifying Domain',        desc: 'Classifying industry and sector…'              },
  { id: 'research',    icon: Search,      label: 'Research Paper Search',     desc: 'Searching Semantic Scholar & OpenAlex…'        },
  { id: 'novelty',     icon: Microscope,  label: 'Novelty Detection',         desc: 'Checking if idea already exists…'              },
  { id: 'competitor',  icon: BarChart2,   label: 'Competitor Intelligence',   desc: 'Mapping the competitive landscape…'            },
  { id: 'feasibility', icon: TrendingUp,  label: 'Feasibility Assessment',    desc: 'Analyzing risks, advantages, challenges…'      },
  { id: 'resources',   icon: Package,     label: 'Resource Estimation',       desc: 'Computing budget bill, team, timeline…'        },
  { id: 'report',      icon: FileText,    label: 'Generating Final Report',   desc: 'Compiling your complete startup report…'       },
]
const STEP_IDS = STEPS.map(s => s.id)

// ── Mode config ──────────────────────────────────────────────────────────────
const MODES = [
  {
    id: 'startup',
    icon: Rocket,
    label: 'Real Startup',
    desc: 'Building this for market — need real budget, team, timeline',
    color: 'brand',
    activeStyle: 'border-brand-500/40 bg-brand-500/10 text-white',
    iconStyle: 'text-brand-400',
    badge: 'Production',
    badgeStyle: 'bg-brand-500/15 text-brand-400',
  },
  {
    id: 'hackathon',
    icon: Trophy,
    label: 'Hackathon / SIH',
    desc: 'Building for SIH, HackIndia, or any 24-72hr hackathon',
    color: 'amber',
    activeStyle: 'border-amber-500/40 bg-amber-500/10 text-white',
    iconStyle: 'text-amber-400',
    badge: '24-72 hrs',
    badgeStyle: 'bg-amber-500/15 text-amber-400',
  },
  {
    id: 'project',
    icon: GraduationCap,
    label: 'College Project / PPT',
    desc: 'Academic project, mini-project, or demo for submission',
    color: 'violet',
    activeStyle: 'border-violet-500/40 bg-violet-500/10 text-white',
    iconStyle: 'text-violet-400',
    badge: '1-4 weeks',
    badgeStyle: 'bg-violet-500/15 text-violet-400',
  },
]

const EXAMPLES = [
  'AI-powered crop disease detection for farmers using smartphone photos',
  'Blockchain health records marketplace where patients monetize anonymized data',
  'AR/VR EdTech app for teaching coding to kids through gamified adventures',
  'Micro-insurance platform for gig workers using usage-based pricing',
  'LLM-powered zero-day vulnerability scanner for enterprise codebases',
  'Mental health app with AI therapy bots trained on CBT techniques',
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function noveltyStyle(status) {
  if (!status) return { text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: Award }
  if (status.includes('Novel'))   return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: Award    }
  if (status.includes('Partial')) return { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: GitBranch }
  return                                  { text: 'text-coral-400',   bg: 'bg-coral-500/10',   border: 'border-coral-500/20',   icon: XCircle   }
}

function modeLabel(mode) {
  return { startup: 'Real Startup', hackathon: 'Hackathon', project: 'College Project' }[mode] || mode
}

const CATEGORY_COLORS = {
  Development:   '#4D96FF',
  Infrastructure:'#10b981',
  Marketing:     '#f59e0b',
  Operations:    '#a78bfa',
  Hardware:      '#FF6B6B',
  Design:        '#ec4899',
  Data:          '#06b6d4',
  Misc:          '#94a3b8',
}
const PIE_COLORS = ['#4D96FF', '#10b981', '#f59e0b', '#FF6B6B', '#a78bfa', '#ec4899', '#06b6d4']

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressStepper({ currentStep }) {
  const idx = STEP_IDS.indexOf(currentStep)
  return (
    <div className="glass-card p-5 space-y-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Analysis Progress</p>
      {STEPS.map((step, i) => {
        const done = i < idx, active = i === idx, Icon = step.icon
        return (
          <motion.div key={step.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: i > idx ? 0.25 : 1, x: 0 }}
            transition={{ delay: i * 0.06 }} className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
              ${done ? 'bg-emerald-500/20 border border-emerald-500/40' : active ? 'bg-brand-500/25 border border-brand-500/60' : 'bg-white/5 border border-white/10'}`}>
              {done ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                : active ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}><Icon className="w-3 h-3 text-brand-400" /></motion.div>
                : <Icon className="w-3 h-3 text-slate-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${done ? 'text-emerald-400' : active ? 'text-white' : 'text-slate-600'}`}>{step.label}</p>
              {active && <p className="text-[11px] text-slate-500 mt-0.5 animate-pulse">{step.desc}</p>}
            </div>
            {active && <span className="text-[10px] text-brand-400 animate-pulse flex-shrink-0 pt-0.5">Running…</span>}
            {done   && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />}
          </motion.div>
        )
      })}
    </div>
  )
}

function Section({ title, icon: Icon, iconClass = 'text-brand-400', badge, badgeVariant = 'blue', children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const badgeCls = {
    green: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    coral: 'text-coral-400 bg-coral-500/10 border-coral-500/20',
    blue:  'text-brand-400 bg-brand-500/10 border-brand-500/20',
    violet:'text-violet-400 bg-violet-500/10 border-violet-500/20',
  }[badgeVariant] || 'text-brand-400 bg-brand-500/10 border-brand-500/20'
  return (
    <div className="glass-card overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/2 transition-colors" aria-expanded={open}>
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 ${iconClass}`} />
          <span className="font-semibold text-sm text-white">{title}</span>
          {badge && <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${badgeCls}`}>{badge}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
            <div className="px-5 pb-5 pt-3 border-t border-white/5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function List({ items = [], icon: Icon = CheckCircle, iconClass = 'text-brand-400', empty = 'None listed' }) {
  if (!items?.length) return <p className="text-xs text-slate-500 mt-2">{empty}</p>
  return (
    <ul className="space-y-2 mt-2">
      {items.map((x, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
          <Icon className={`w-3.5 h-3.5 ${iconClass} mt-0.5 flex-shrink-0`} /><span>{x}</span>
        </li>
      ))}
    </ul>
  )
}

function MetricBar({ label, value, isInverse = false, reasoning }) {
  const [showR, setShowR] = useState(false)
  const color = isInverse
    ? (value >= 65 ? '#FF6B6B' : value >= 35 ? '#f59e0b' : '#10b981')
    : (value >= 65 ? '#10b981' : value >= 35 ? '#f59e0b' : '#FF6B6B')
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-300">{label}</span>
          {reasoning && <button onClick={() => setShowR(s => !s)} className="text-slate-600 hover:text-slate-400 transition-colors"><Info className="w-3 h-3" /></button>}
        </div>
        <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color }}>{value}<span className="text-[10px] text-slate-500 font-normal">/100</span></span>
      </div>
      <div className="relative h-2 rounded-full bg-white/8 overflow-hidden">
        <motion.div className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}55` }}
          initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 1.2, ease: 'easeOut' }} />
      </div>
      <AnimatePresence>
        {showR && reasoning && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="text-[11px] text-slate-500 bg-white/3 rounded-lg px-3 py-2 leading-relaxed border border-white/5">
            <Brain className="w-3 h-3 inline mr-1 text-brand-400" />{reasoning}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function PaperCard({ paper, index }) {
  const [expanded, setExpanded] = useState(false)
  const authors = (paper.authors || []).slice(0, 3).map(a => a.name || a).join(', ')
  const abstract = paper.abstract || ''
  const doi = paper.externalIds?.DOI
  const pdf = paper.openAccessPdf?.url
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      className="glass-card p-3.5 hover:border-brand-500/20 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-md bg-brand-500/12 flex items-center justify-center flex-shrink-0 mt-0.5">
          <BookOpen className="w-3 h-3 text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <a href={paper.url || '#'} target="_blank" rel="noopener noreferrer"
            className="text-xs font-semibold text-white hover:text-brand-300 transition-colors leading-snug block mb-1">
            {paper.title || 'Untitled'} <ExternalLink className="w-2.5 h-2.5 inline opacity-50 ml-0.5" />
          </a>
          <div className="flex flex-wrap items-center gap-2">
            {paper.year && <span className="text-[10px] text-slate-500">{paper.year}</span>}
            {paper.citationCount != null && <span className="text-[10px] text-slate-500">📎 {paper.citationCount}</span>}
            {pdf && <a href={pdf} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-400 hover:underline">PDF</a>}
            {doi && <a href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-400 hover:underline">DOI</a>}
          </div>
          {authors && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{authors}</p>}
          {abstract && (
            <>
              <p className={`text-[11px] text-slate-400 mt-1 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>{abstract}</p>
              {abstract.length > 100 && (
                <button onClick={() => setExpanded(e => !e)} className="text-[10px] text-brand-400 hover:text-brand-300 mt-0.5 flex items-center gap-0.5">
                  {expanded ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />More</>}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function PatentCard({ patent, index }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 + 0.1 }}
      className="glass-card p-3.5 hover:border-violet-500/20 transition-all">
      <a href={patent.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 group">
        <div className="w-6 h-6 rounded-md bg-violet-500/12 flex items-center justify-center flex-shrink-0 mt-0.5">
          <FlaskConical className="w-3 h-3 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white group-hover:text-violet-300 transition-colors flex items-center gap-1">
            {patent.source} <ExternalLink className="w-2.5 h-2.5 opacity-50" />
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">{patent.jurisdiction}</p>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">{patent.description}</p>
        </div>
      </a>
    </motion.div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1f2e] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-white font-semibold mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.fill || p.color }}>₹{Number(p.value).toLocaleString('en-IN')}</p>)}
    </div>
  )
}

// ── Itemized Budget Bill component ────────────────────────────────────────────
function BillRow({ item, index }) {
  const [showTip, setShowTip] = useState(false)
  const color = CATEGORY_COLORS[item.category] || '#94a3b8'
  const isZero = item.amount_inr === 0

  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border-b border-white/5 last:border-0">
      <div className="flex items-start gap-3 py-3">
        {/* Category color dot */}
        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-white">{item.item}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{item.category}</p>
              {/* Justification — always visible */}
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{item.justification}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className={`text-sm font-bold tabular-nums ${isZero ? 'text-emerald-400' : 'text-white'}`}>
                {isZero ? 'Free' : `₹${Number(item.amount_inr).toLocaleString('en-IN')}`}
              </p>
            </div>
          </div>
          {/* Cost reduction tip toggle */}
          {item.cost_reduction_tip && (
            <div className="mt-2">
              <button onClick={() => setShowTip(s => !s)}
                className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                <Scissors className="w-3 h-3" />
                {showTip ? 'Hide cost reduction tip' : 'How to reduce this cost?'}
                {showTip ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              <AnimatePresence>
                {showTip && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                    <div className="mt-1.5 flex items-start gap-2 p-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                      <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-emerald-300 leading-relaxed">{item.cost_reduction_tip}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function BudgetBill({ items = [], totalInr, mode, reductionSummary }) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? items : items.slice(0, 6)
  const byCategory = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount_inr
    return acc
  }, {})
  const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-4">
      {/* Mode banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
        mode === 'hackathon' ? 'bg-amber-500/8 border-amber-500/20' :
        mode === 'project'   ? 'bg-violet-500/8 border-violet-500/20' :
                               'bg-brand-500/8 border-brand-500/20'
      }`}>
        <Receipt className={`w-4 h-4 flex-shrink-0 ${mode === 'hackathon' ? 'text-amber-400' : mode === 'project' ? 'text-violet-400' : 'text-brand-400'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white">
            Estimated cost for a <span className="capitalize">{modeLabel(mode)}</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Click any row's "How to reduce this cost?" to see savings tips
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] text-slate-500">Total</p>
          <p className="text-base font-bold text-white">₹{Number(totalInr).toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Pie chart + legend side by side */}
      {pieData.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4 items-center">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                labelLine={false}
                label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}>
                {pieData.map((d, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[d.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: CATEGORY_COLORS[d.name] || PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-slate-400">{d.name}</span>
                </div>
                <span className="text-slate-300 font-medium tabular-nums">
                  {d.value === 0 ? 'Free' : `₹${Number(d.value).toLocaleString('en-IN')}`}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs border-t border-white/8 pt-2 mt-1">
              <span className="text-slate-300 font-semibold">Total</span>
              <span className="text-white font-bold tabular-nums">₹{Number(totalInr).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Line-item bill */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Itemized Bill</p>
          <p className="text-[10px] text-slate-600">Click → to see savings tip</p>
        </div>
        <div className="divide-y-0">
          {displayed.map((item, i) => <BillRow key={i} item={item} index={i} />)}
        </div>
        {items.length > 6 && (
          <button onClick={() => setShowAll(s => !s)}
            className="mt-2 w-full text-xs text-brand-400 hover:text-brand-300 text-center py-1.5 border-t border-white/5 transition-colors">
            {showAll ? '▲ Show less' : `▼ Show ${items.length - 6} more items`}
          </button>
        )}
      </div>

      {/* Overall reduction summary */}
      {reductionSummary && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
          <Scissors className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-emerald-400 mb-1">Overall Cost Reduction Strategy</p>
            <p className="text-xs text-slate-300 leading-relaxed">{reductionSummary}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Markdown download helper ──────────────────────────────────────────────────
function buildMarkdown(idea, mode, analysis, papers) {
  const a = analysis || {}
  const bill = (a.itemized_budget || []).map(b =>
    `| ${b.item} | ${b.category} | ${b.amount_inr === 0 ? 'Free' : `₹${Number(b.amount_inr).toLocaleString('en-IN')}`} | ${b.justification} | ${b.cost_reduction_tip} |`
  ).join('\n')
  return `# Startup Analysis Report — TrustEval
**Idea:** ${idea}
**Mode:** ${modeLabel(mode)}
**Domain:** ${a.domain_classification || 'N/A'}
**Keywords:** ${(a.extracted_keywords || []).join(', ')}
**Date:** ${new Date().toLocaleString()}

---
## 1. What the AI Understood
${a.what_ai_understood || ''}

## 2. Startup Summary
${a.startup_summary || ''}

---
## 3. Novelty — ${a.idea_novelty_status || 'N/A'}
${a.what_currently_exists || ''}

### Existing Solutions
${(a.existing_solutions || []).map(s => `- ${s}`).join('\n')}

### Suggested New Features
${(a.suggested_new_features || []).map(f => `- ${f}`).join('\n')}

---
## 4. Research Analysis
**Saturation:** ${a.research_saturation || 'N/A'}

### Research Gaps
${(a.research_gaps || []).map(g => `- ${g}`).join('\n')}

### Top Papers
${(papers || []).slice(0, 5).map(p => `- [${p.title}](${p.url}) — ${p.year} · ${p.citationCount} citations`).join('\n')}

---
## 5. Feasibility
- **Technical:** ${a.technical_feasibility || 'N/A'}
- **Market:** ${a.market_feasibility || 'N/A'}
- **Business:** ${a.business_feasibility || 'N/A'}

### Advantages
${(a.advantages || []).map(x => `- ${x}`).join('\n')}

### Risks
${(a.risks || []).map(x => `- ${x}`).join('\n')}

---
## 6. Resource Estimation (${modeLabel(mode)})
- **Timeline:** ${a.development_time_months} months
- **Budget:** ₹${(a.budget_inr || 0).toLocaleString('en-IN')}
- **Team:** ${a.team_size_estimate} people

### Itemized Budget Bill
| Item | Category | Cost | Justification | How to Reduce |
|---|---|---|---|---|
${bill}

### Cost Reduction Summary
${a.total_cost_reduction_summary || ''}

---
## 7. Final Verdict
${a.final_verdict || ''}

*Generated by TrustEval Startup Analyzer*`
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StartupAnalyzer() {
  const { isAuthenticated } = useAuth()
  const [idea, setIdea]           = useState('')
  const [mode, setMode]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const [currentStep, setStep]    = useState(null)
  const [result, setResult]       = useState(null)
  const [activeReport, setReport] = useState(null)
  const [researchTab, setRTab]    = useState('papers')
  const [geminiActive, setGeminiActive] = useState(null)
  // Founder profile — collected for bias/XAI analysis
  const [founderProfile, setFounderProfile] = useState({
    gender: 0, founder_location: 0, education_level: 0, funding_access: 0
  })
  const textareaRef = useRef(null)
  const resultsRef  = useRef(null)

  useEffect(() => {
    configApi.getKeyStatus()
      .then(r => setGeminiActive(r.data.configured))
      .catch(() => setGeminiActive(false))
  }, [])

  const simulateSteps = useCallback(() => {
    const delays = [0, 500, 1800, 3200, 5000, 7500, 10500, 13500]
    delays.forEach((d, i) => setTimeout(() => setStep(STEP_IDS[i]), d))
  }, [])

  const handleAnalyze = async (ideaText, selectedMode) => {
    const text = (ideaText || idea).trim()
    const m    = selectedMode || mode
    if (!text) { toast.error('Please describe your startup idea'); return }
    if (!m)    { toast.error('Please select a project type first'); return }
    setResult(null); setLoading(true); simulateSteps()
    try {
      const { data } = await startupApi.analyze(text, m, founderProfile)
      setResult(data)
      setStep(null)
      if (data.report_id) {
        setTimeout(() => notifySidebarRefresh(), 300)
      }
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Analysis failed — is the backend running?')
      setStep(null)
    } finally { setLoading(false) }
  }

  const handleDownload = () => {
    if (!result) return
    const md = buildMarkdown(result.idea, result.mode, result.analysis, result.papers)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `startup-report-${Date.now()}.md`; a.click()
    URL.revokeObjectURL(url)
    toast.success('Report downloaded')
  }

  const analysis   = result?.analysis  || {}
  const papers     = result?.papers    || []
  const patents    = result?.patents   || []
  const resultMode = result?.mode      || mode
  const projectType = result?.project_type || result?.analysis?.project_type || 'software'
  const ns         = noveltyStyle(analysis.idea_novelty_status)
  const NIcon      = ns.icon
  const keywords   = analysis.extracted_keywords || analysis.keywords || []

  const radarData = [
    { subject: 'Patent Novelty',     value: analysis.patent_novelty_score     || 0 },
    { subject: 'Research Support',   value: analysis.research_support_score   || 0 },
    { subject: 'Market Demand',      value: analysis.market_demand_score      || 0 },
    { subject: 'Team Experience',    value: analysis.team_experience_score    || 0 },
    { subject: 'Competitor Density', value: analysis.competitor_density_score || 0 },
  ]

  return (
    <div className="flex h-full">
      <Sidebar onSelectReport={setReport} activeReportId={activeReport} />
      <main className="flex-1 overflow-y-auto scroll-area">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

          {/* ── Header ── */}
          <div className="mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-lg shadow-brand-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-white">Startup Idea Analyzer</h1>
              <p className="text-sm text-slate-400">AI-powered feasibility analysis — tuned to your build context</p>
            </div>
          </div>

          {/* ── Step 1: Mode selector ── */}
          <div className="glass-card p-5 mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              What are you building this for?
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              {MODES.map(m => {
                const Icon = m.icon
                const active = mode === m.id
                return (
                  <motion.button key={m.id} onClick={() => setMode(m.id)} whileTap={{ scale: 0.98 }}
                    disabled={loading}
                    className={`relative text-left p-4 rounded-2xl border transition-all duration-200
                      ${active ? m.activeStyle : 'border-white/8 bg-white/3 text-slate-400 hover:border-white/15 hover:text-slate-200'}`}>
                    <div className="flex items-center gap-2.5 mb-2">
                      <Icon className={`w-5 h-5 ${active ? m.iconStyle : 'text-slate-500'}`} />
                      <span className="text-sm font-semibold">{m.label}</span>
                      {active && (
                        <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${m.badgeStyle}`}>
                          {m.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-70">{m.desc}</p>
                    {active && (
                      <motion.div layoutId="mode-ring"
                        className={`absolute inset-0 rounded-2xl border-2 border-${m.color}-500/40 pointer-events-none`} />
                    )}
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* ── Step 2: Founder profile (protected attributes for bias/XAI) ── */}
          <div className="glass-card p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-slate-400" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Founder Profile</p>
              <span className="text-[10px] text-slate-600 ml-1">· used for bias & fairness analysis</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: 'gender',           label: 'Gender',           opts: [{v:0,l:'Female'},{v:1,l:'Male'}]    },
                { key: 'founder_location', label: 'Location',         opts: [{v:0,l:'Rural'},{v:1,l:'Urban'}]    },
                { key: 'education_level',  label: 'Education',        opts: [{v:0,l:'Tier 2/3'},{v:1,l:'Tier 1'}] },
                { key: 'funding_access',   label: 'Funding Access',   opts: [{v:0,l:'Low'},{v:1,l:'High'}]       },
              ].map(({ key, label, opts }) => (
                <div key={key}>
                  <p className="text-[10px] font-semibold text-slate-500 mb-1.5">{label}</p>
                  <div className="flex gap-1.5">
                    {opts.map(({ v, l }) => (
                      <button key={v} onClick={() => setFounderProfile(p => ({ ...p, [key]: v }))}
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all
                          ${founderProfile[key] === v
                            ? 'bg-brand-500/15 border-brand-500/30 text-brand-300'
                            : 'bg-white/3 border-white/8 text-slate-500 hover:border-white/15 hover:text-slate-300'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Step 3: Idea input ── */}
          <div className="glass-card p-5 mb-5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Describe Your Idea
            </label>

            {/* Keyword chips — shown when result is available */}
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-[10px] text-slate-500 self-center mr-1">Keywords:</span>
                {keywords.map((k, i) => (
                  <motion.span key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06 }}
                    className="tag text-[10px] px-2 py-0.5">{k}</motion.span>
                ))}
              </div>
            )}

            <div className={`relative rounded-2xl border transition-all duration-200
              ${loading ? 'border-brand-500/40 bg-brand-500/5' : 'border-white/10 bg-white/3 focus-within:border-brand-500/40 focus-within:bg-white/4'}`}>
              <textarea
                ref={textareaRef}
                value={idea}
                onChange={e => setIdea(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAnalyze() } }}
                disabled={loading}
                placeholder={mode === 'hackathon'
                  ? 'Describe your hackathon project idea… (what problem does it solve? what tech will you use?)'
                  : mode === 'project'
                  ? 'Describe your college project… (what is it, what subject/domain?)'
                  : 'Describe your startup idea in detail… (what problem, who are the users, how does it work?)'}
                rows={4}
                className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none px-4 pt-4 pb-12 resize-none leading-relaxed"
              />
              <div className="absolute bottom-3 left-4 right-3 flex items-center justify-between">
                <span className="text-[10px] text-slate-600">{idea.length > 0 ? `${idea.length} chars · ` : ''}Ctrl+Enter to analyze</span>
                <motion.button
                  onClick={() => handleAnalyze()}
                  disabled={!idea.trim() || !mode || loading}
                  whileTap={{ scale: 0.96 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-semibold
                    hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-500/30">
                  {loading
                    ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Analyzing…</>
                    : <><Sparkles className="w-3.5 h-3.5" />Analyze</>}
                </motion.button>
              </div>
            </div>

            {/* Example chips */}
            {!result && !loading && (
              <div className="mt-3">
                <p className="text-[11px] text-slate-600 mb-2">Try an example:</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex, i) => (
                    <button key={i} onClick={() => { setIdea(ex); if (!mode) setMode('startup') }}
                      className="text-[11px] px-3 py-1.5 rounded-lg bg-white/3 border border-white/8 text-slate-500
                        hover:bg-brand-500/10 hover:border-brand-500/20 hover:text-white transition-all text-left line-clamp-1 max-w-xs">
                      {ex.slice(0, 50)}…
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Not logged in nudge */}
            {!isAuthenticated && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/8 border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <p className="text-[11px] text-amber-300">
                  You're not signed in — analysis will run but <strong>won't be saved</strong> to history.&nbsp;
                  <a href="/login" className="underline hover:text-amber-200">Sign in</a> or&nbsp;
                  <a href="/signup" className="underline hover:text-amber-200">create a free account</a>.
                </p>
              </div>
            )}

            {/* Gemini AI status banner */}
            {geminiActive === false && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/4 border border-white/8">
                <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <p className="text-[11px] text-slate-500 flex-1">
                  Running in <strong className="text-slate-400">offline mode</strong> — results use rule-based fallback.
                  For real AI analysis that changes with every idea,&nbsp;
                  <a href="/settings" className="text-brand-400 hover:underline">add your free Gemini key in Settings →</a>
                </p>
              </div>
            )}
            {geminiActive === true && (
              <div className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                <Sparkles className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <p className="text-[11px] text-emerald-400">Gemini AI active — analysis is fully dynamic for each idea</p>
              </div>
            )}          </div>

          {/* ── Loading: progress stepper ── */}
          <AnimatePresence>
            {loading && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                className="grid md:grid-cols-2 gap-5 mb-5">
                <ProgressStepper currentStep={currentStep} />
                <div className="glass-card p-6 flex flex-col items-center justify-center text-center gap-4">
                  <LoadingSpinner size="lg" />
                  <div>
                    <p className="text-sm font-semibold text-white">Analyzing your {modeLabel(mode).toLowerCase()} idea</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                      Searching papers, checking novelty, estimating {mode === 'hackathon' ? 'what you can build in 48hrs' : mode === 'project' ? 'student-friendly resources' : 'real startup costs'}…
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['Semantic Scholar', 'OpenAlex', 'Gemini AI', 'Patent DBs'].map(s => (
                      <span key={s} className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/8 text-slate-400">{s}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Results ── */}
          <AnimatePresence>
            {result && !loading && (
              <motion.div ref={resultsRef} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }} className="space-y-4">

                {/* Hero card: idea + mode badge + keywords + actions */}
                <div className="glass-card p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Mode badge */}
                      <div className="flex items-center gap-2 mb-2">
                        {(() => { const m = MODES.find(m => m.id === resultMode); if (!m) return null; const Icon = m.icon; return (
                          <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${m.badgeStyle} border-current/20`}>
                            <Icon className={`w-3 h-3 ${m.iconStyle}`} />{m.label}
                          </span>
                        )})()}
                        {analysis.domain_classification && <span className="tag text-[10px]">{analysis.domain_classification}</span>}
                        {/* Hardware/Software badge — auto-detected */}
                        <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          projectType === 'hardware'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                        }`}>
                          {projectType === 'hardware' ? '⚙ Hardware' : '💻 Software'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed mb-3">{result.idea}</p>
                      {/* ── Keyword chips (extracted from the idea) ── */}
                      {keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <Search className="w-3 h-3 text-slate-500 self-center" />
                          {keywords.map((k, i) => (
                            <span key={i} className="tag-violet text-[10px] px-2 py-0.5">{k}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      {/* Feasibility Score Gauge — same score that gets saved to Reports */}
                      <ScoreGauge
                        score={analysis.feasibility_score || 0}
                        label={analysis.feasibility_label || ''}
                        size={100}
                      />
                      {/* Novelty badge below gauge */}
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${ns.bg} ${ns.border}`}>
                        <NIcon className={`w-3.5 h-3.5 ${ns.text}`} />
                        <span className={`text-xs font-bold ${ns.text}`}>{analysis.idea_novelty_status || 'Analyzing…'}</span>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button onClick={handleDownload}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-xs text-slate-400 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all">
                          <Download className="w-3.5 h-3.5" /> Export
                        </button>
                        <button onClick={() => { setResult(null); setIdea(''); textareaRef.current?.focus() }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-xs text-slate-400 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all">
                          <RefreshCw className="w-3.5 h-3.5" /> New
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 1: AI Understanding */}
                <Section title="What the AI Understood" icon={Brain} iconClass="text-brand-400" defaultOpen>
                  <div className="space-y-4 mt-1">
                    <p className="text-sm text-slate-300 leading-relaxed">{analysis.what_ai_understood}</p>
                    <p className="text-sm text-slate-400 leading-relaxed">{analysis.startup_summary}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { label: 'Domain',   value: analysis.domain_classification, cls: 'text-brand-400'   },
                        { label: 'Novelty',  value: analysis.idea_novelty_status,   cls: ns.text             },
                        { label: 'Research', value: analysis.research_saturation?.includes('saturated') ? 'Saturated' : 'Opportunity', cls: analysis.research_saturation?.includes('saturated') ? 'text-coral-400' : 'text-emerald-400' },
                      ].map(({ label, value, cls }) => (
                        <div key={label} className="p-3 rounded-xl bg-white/3 border border-white/6">
                          <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                          <p className={`text-xs font-semibold ${cls}`}>{value || 'N/A'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Section>

                {/* Section 2: Novelty */}
                <Section title="Novelty & Innovation Opportunities" icon={NIcon} iconClass={ns.text}
                  badge={analysis.idea_novelty_status}
                  badgeVariant={analysis.idea_novelty_status?.includes('Novel') ? 'green' : analysis.idea_novelty_status?.includes('Partial') ? 'amber' : 'coral'}>
                  <div className="space-y-4 mt-1">
                    {analysis.what_currently_exists && (
                      <div className="p-4 rounded-xl bg-white/3 border border-white/6">
                        <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5"><Map className="w-3.5 h-3.5" />What Currently Exists</p>
                        <p className="text-sm text-slate-300 leading-relaxed">{analysis.what_currently_exists}</p>
                      </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-400 mb-2">Existing Solutions / Competitors</p>
                        <List items={analysis.existing_solutions} icon={XCircle} iconClass="text-coral-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 mb-2">Suggested New Features</p>
                        <List items={analysis.suggested_new_features} icon={Zap} iconClass="text-amber-400" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-2">Innovation Opportunities</p>
                      <List items={analysis.innovation_opportunities} icon={Lightbulb} iconClass="text-brand-400" />
                    </div>
                  </div>
                </Section>

                {/* Section 3: Research Intelligence */}
                <Section title="Research Intelligence" icon={Search} iconClass="text-violet-400">
                  <div className="space-y-4 mt-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`tag ${analysis.research_saturation?.includes('saturated') ? 'tag-coral' : 'tag-green'}`}>{analysis.research_saturation}</span>
                      <span className="text-xs text-slate-500">{papers.length} papers found</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-400 mb-2">Research Gaps</p>
                        <List items={analysis.research_gaps} icon={AlertTriangle} iconClass="text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 mb-2">Missing Capabilities</p>
                        <List items={analysis.missing_capabilities} icon={AlertTriangle} iconClass="text-coral-400" />
                      </div>
                    </div>
                    {/* Papers / Patents tabs */}
                    <div>
                      <div className="flex items-center gap-1 mb-3">
                        {[
                          { id: 'papers',  icon: BookOpen,     label: 'Papers',  count: papers.length,  activeStyle: 'bg-brand-500/15 text-brand-300 border-brand-500/20'   },
                          { id: 'patents', icon: FlaskConical, label: 'Patents', count: patents.length, activeStyle: 'bg-violet-500/15 text-violet-300 border-violet-500/20' },
                        ].map(t => (
                          <button key={t.id} onClick={() => setRTab(t.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                              ${researchTab === t.id ? t.activeStyle : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                            <t.icon className="w-3 h-3" />{t.label}
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/8 text-slate-500">{t.count}</span>
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2 max-h-72 overflow-y-auto scroll-area pr-1">
                        {researchTab === 'papers'  && (papers.length > 0 ? papers.map((p, i) => <PaperCard key={i} paper={p} index={i} />) : <p className="text-xs text-slate-500 text-center py-6">No papers found.</p>)}
                        {researchTab === 'patents' && patents.map((p, i) => <PatentCard key={i} patent={p} index={i} />)}
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Section 4: Feasibility */}
                <Section title="Feasibility Assessment" icon={TrendingUp} iconClass="text-emerald-400">
                  <div className="space-y-4 mt-1">
                    <div className="grid sm:grid-cols-3 gap-3">
                      {[['Technical', analysis.technical_feasibility], ['Market', analysis.market_feasibility], ['Business', analysis.business_feasibility]].map(([k, v]) => (
                        <div key={k} className="p-3 rounded-xl bg-white/3 border border-white/6">
                          <p className="text-[10px] font-semibold text-slate-400 mb-1">{k}</p>
                          <p className="text-xs text-slate-300 leading-relaxed">{v || 'N/A'}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                        <p className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" />Advantages</p>
                        <List items={analysis.advantages} icon={CheckCircle} iconClass="text-emerald-400" />
                      </div>
                      <div className="p-3 rounded-xl bg-coral-500/5 border border-coral-500/15">
                        <p className="text-xs font-semibold text-coral-400 mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Disadvantages</p>
                        <List items={analysis.disadvantages} icon={AlertTriangle} iconClass="text-coral-400" />
                      </div>
                      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                        <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Risks & Challenges</p>
                        <List items={[...(analysis.risks || []), ...(analysis.challenges || [])]} icon={AlertTriangle} iconClass="text-amber-400" />
                      </div>
                      <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                        <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />Failure Points</p>
                        <List items={analysis.failure_reasons} icon={XCircle} iconClass="text-red-400" />
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Section 5: AI Metric Scores */}
                <Section title="AI-Estimated Scores" icon={BarChart2} iconClass="text-brand-400">
                  <div className="grid md:grid-cols-2 gap-6 mt-2">
                    <div className="space-y-4">
                      <MetricBar label="Patent Novelty"     value={analysis.patent_novelty_score     || 0} reasoning={analysis.metric_reasoning?.patent_novelty}  />
                      <MetricBar label="Research Support"   value={analysis.research_support_score   || 0} reasoning={analysis.metric_reasoning?.research_support} />
                      <MetricBar label="Market Demand"      value={analysis.market_demand_score      || 0} reasoning={analysis.metric_reasoning?.market_demand}    />
                      <MetricBar label="Team Experience"    value={analysis.team_experience_score    || 0} reasoning={analysis.metric_reasoning?.team_experience}  />
                      <MetricBar label="Competitor Density" value={analysis.competitor_density_score || 0} isInverse reasoning={analysis.metric_reasoning?.competitor_density} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-3">Score Radar</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                          <PolarGrid stroke="rgba(255,255,255,0.06)" />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                          <Radar dataKey="value" stroke="#4D96FF" fill="#4D96FF" fillOpacity={0.15} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Section>

                {/* Section 6: Resource Estimation + Itemized Bill */}
                <Section title="Resource Estimation & Budget Bill" icon={Receipt} iconClass="text-amber-400" defaultOpen={false}>
                  <div className="space-y-5 mt-1">
                    {/* Key stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { icon: Clock,         label: 'Timeline', value: `${analysis.development_time_months || '?'} ${Number(analysis.development_time_months) < 1 ? 'days' : 'months'}`, color: 'text-amber-400'  },
                        { icon: IndianRupee,   label: 'Total Budget', value: `₹${Number(analysis.budget_inr || 0).toLocaleString('en-IN')}`, color: 'text-emerald-400' },
                        { icon: Users,         label: 'Team Size', value: `${analysis.team_size_estimate || '?'} people`,  color: 'text-brand-400'  },
                        { icon: Target,        label: 'Roles',     value: `${(analysis.team_roles || []).length} roles`,   color: 'text-violet-400' },
                      ].map(({ icon: Icon, label, value, color }) => (
                        <div key={label} className="glass-card p-4 text-center">
                          <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
                          <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                          <p className={`text-sm font-bold ${color}`}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Team roles */}
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-2">Team Roles</p>
                      <div className="flex flex-wrap gap-2">
                        {(analysis.team_roles || []).map((r, i) => (
                          <span key={i} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-white/4 border border-white/8 text-slate-300">
                            <Users className="w-3 h-3 text-brand-400" />{r}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Itemized budget bill */}
                    <BudgetBill
                      items={analysis.itemized_budget || []}
                      totalInr={analysis.budget_inr || 0}
                      mode={resultMode}
                      reductionSummary={analysis.total_cost_reduction_summary}
                    />
                  </div>
                </Section>

                {/* Final verdict */}
                <div className="glass-card p-6 border-brand-500/20 bg-brand-500/5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                      <Award className="w-5 h-5 text-brand-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-2">Final Verdict</p>
                      <p className="text-sm text-slate-200 leading-relaxed">{analysis.final_verdict}</p>
                      {result.report_id && (
                        <p className="text-[10px] text-emerald-500 mt-3 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />Saved as Report #{result.report_id} — view in Reports page
                        </p>
                      )}
                      {!result.report_id && (
                        <p className="text-[10px] text-amber-400 mt-3 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Not saved —&nbsp;<a href="/login" className="underline hover:text-amber-300">sign in</a>&nbsp;to keep this in your history
                        </p>
                      )}
                    </div>
                    <button onClick={handleDownload}
                      className="flex-shrink-0 btn-primary flex items-center gap-2 text-xs py-2">
                      <Download className="w-3.5 h-3.5" />Export
                    </button>
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {!result && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-12 text-center mt-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 border border-brand-500/15 flex items-center justify-center mx-auto mb-5">
                <Sparkles className="w-8 h-8 text-brand-400" />
              </div>
              <h2 className="text-lg font-display font-bold text-white mb-2">Ready to Analyze</h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed mb-6">
                Select your project type above, then describe your idea. The AI will tailor the entire analysis — budget, timeline, team, and recommendations — to your actual build context.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {['Domain Detection','Research Papers','Novelty Check','Feasibility','Itemized Budget Bill','Cost Reduction Tips'].map(f => (
                  <span key={f} className="flex items-center gap-1.5 text-xs text-slate-400 px-3 py-1.5 rounded-full bg-white/4 border border-white/8">
                    <CheckCircle className="w-3 h-3 text-emerald-400" />{f}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

        </div>
      </main>
    </div>
  )
}
