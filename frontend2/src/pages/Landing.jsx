import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield, BarChart2, GitBranch, ArrowRight,
  Brain, Scale, FlaskConical, FileText, ChevronRight
} from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'Explainable AI',
    desc: 'SHAP global & local explanations plus DiCE counterfactuals reveal exactly why a model makes each decision.',
    color: 'text-brand-400',
    bg: 'bg-brand-500/10',
  },
  {
    icon: Scale,
    title: 'Bias Detection',
    desc: 'Audit for demographic parity, equal opportunity, equalized odds and individual fairness across four protected attributes.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    icon: GitBranch,
    title: 'Bias Mitigation',
    desc: 'Apply Fairlearn ThresholdOptimizer to reduce algorithmic bias while tracking the accuracy–fairness trade-off.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: FlaskConical,
    title: 'Research Intelligence',
    desc: 'Semantic Scholar search + Gemini AI synthesis surfaces research gaps, saturation levels, and innovation opportunities.',
    color: 'text-coral-400',
    bg: 'bg-coral-500/10',
  },
  {
    icon: BarChart2,
    title: 'Interactive Visualizations',
    desc: 'SHAP waterfall plots, group comparison charts, counterfactual tables, and fairness metric bars — all live.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    icon: FileText,
    title: 'Trust Reports',
    desc: 'One-click comprehensive PDF-ready reports covering explainability, bias audit, research analysis, and recommendations.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
  },
]

const steps = [
  { num: '01', title: 'Describe your startup', desc: 'Enter your idea, domain, and founder profile.' },
  { num: '02', title: 'AI analyses & predicts', desc: 'Gemini + RandomForest assess feasibility and research context.' },
  { num: '03', title: 'Explain the decision', desc: 'SHAP + DiCE reveal every factor behind the score.' },
  { num: '04', title: 'Audit for bias', desc: 'Fairlearn measures fairness across gender, location, funding, education.' },
  { num: '05', title: 'Get your Trust Report', desc: 'Download a complete, auditable report with recommendations.' },
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}
const item = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.5 } },
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-20 pb-16 overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/6 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-coral-500/4 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative text-center max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-400 text-sm font-medium mb-8"
          >
            <Shield className="w-3.5 h-3.5" />
            Explainable AI · Bias Detection · Trustworthy AI
          </motion.div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-extrabold leading-[1.1] mb-6">
            <span className="text-white">Make AI </span>
            <span className="gradient-text">Trustworthy</span>
            <span className="text-white"> by Design</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            TrustEval is a research-grade XAI framework using startup feasibility assessment as a
            real-world case study. Understand <em>why</em>, detect <em>bias</em>, and build <em>fair</em> AI.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/startup" className="btn-primary flex items-center gap-2 text-base px-8 py-3">
              <Brain className="w-4 h-4" /> Analyze a Startup Idea
            </Link>
            <Link to="/signup" className="btn-secondary flex items-center gap-2 text-base px-8 py-3">
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Stat row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-slate-500"
          >
            {[
              ['SHAP + DiCE', 'XAI methods'],
              ['4 fairness', 'metrics'],
              ['Gemini 2.0', 'Flash AI'],
              ['Fairlearn', 'mitigation'],
            ].map(([val, unit]) => (
              <div key={val} className="text-center">
                <p className="text-white font-bold text-base">{val}</p>
                <p className="text-xs">{unit}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-4">
              Everything you need for <span className="gradient-text">trustworthy AI</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              A complete research toolkit covering the full XAI and fairness pipeline in one product.
            </p>
          </motion.div>

          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {features.map(({ icon: Icon, title, desc, color, bg }) => (
              <motion.div key={title} variants={item} className="glass-card p-6 group hover:border-white/12 transition-all duration-200">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <h3 className="text-white font-semibold mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-4">
              How TrustEval works
            </h2>
            <p className="text-slate-400">Five steps from idea to a fully audited trust report.</p>
          </motion.div>

          <div className="relative">
            {/* Connector line */}
            <div className="hidden md:block absolute left-8 top-6 bottom-6 w-px bg-gradient-to-b from-brand-500/40 via-violet-500/40 to-coral-500/40" />

            <div className="space-y-8">
              {steps.map(({ num, title, desc }, i) => (
                <motion.div
                  key={num}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-6 md:pl-20 relative"
                >
                  {/* Step bubble */}
                  <div className="hidden md:flex absolute left-0 w-16 h-16 items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-brand-500/30">
                      {num.split('').pop()}
                    </div>
                  </div>

                  <div className="flex-1 glass-card p-5">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-bold text-slate-600 font-display">{num}</span>
                      <h3 className="text-white font-semibold">{title}</h3>
                    </div>
                    <p className="text-sm text-slate-400">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────── */}
      <section className="py-24 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center glass-card p-12 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-violet-500/5 pointer-events-none" />
          <Shield className="w-12 h-12 text-brand-400 mx-auto mb-6" />
          <h2 className="text-3xl font-display font-bold text-white mb-4">
            Ready to build trustworthy AI?
          </h2>
          <p className="text-slate-400 mb-8">
            Join TrustEval and start auditing your AI decisions with explainability and fairness at the core.
          </p>
          <Link to="/signup" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3">
            Get started free <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4 text-center text-xs text-slate-600">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-3.5 h-3.5 text-brand-500" />
          <span className="text-slate-400 font-medium">TrustEval</span>
        </div>
        <p>Explainable AI · Bias Detection · Bias Mitigation · Trustworthy AI</p>
      </footer>
    </div>
  )
}
