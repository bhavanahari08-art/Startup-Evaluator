import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import {
  Send, BookOpen, FlaskConical, ExternalLink, ChevronDown,
  ChevronUp, Sparkles, User, Copy, Check, RotateCcw,
  Search, Globe, FileText, Lightbulb, Clock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { researchApi } from '../api/client'

/* ── Suggested prompts shown on empty state ── */
const SUGGESTIONS = [
  'Papers on explainable AI for medical diagnosis',
  'Research on bias in hiring algorithms',
  'Latest work on federated learning and privacy',
  'Patents related to edge computing for agriculture',
  'Research gaps in multimodal large language models',
  'Computer vision for crop disease detection',
]

/* ── Typing animation dots ── */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-brand-400"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  )
}

/* ── Copy button ── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
      aria-label="Copy message"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

/* ── Single paper card ── */
function PaperCard({ paper, index }) {
  const [expanded, setExpanded] = useState(false)
  const abstract = paper.abstract || ''
  const authors  = (paper.authors || []).slice(0, 3).map(a => a.name || a).join(', ')
  const doi      = paper.externalIds?.DOI
  const pdfUrl   = paper.openAccessPdf?.url

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card p-3.5 hover:border-white/12 transition-all duration-150"
    >
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-md bg-brand-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
          <FileText className="w-3 h-3 text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <a
            href={paper.url || `https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-white hover:text-brand-300 transition-colors leading-snug line-clamp-2 block"
          >
            {paper.title || 'Untitled'}
            <ExternalLink className="w-2.5 h-2.5 inline ml-1 opacity-60" />
          </a>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {paper.year && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />{paper.year}
              </span>
            )}
            {paper.citationCount != null && (
              <span className="text-[10px] text-slate-500">📎 {paper.citationCount} citations</span>
            )}
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5">
                <Globe className="w-2.5 h-2.5" /> PDF
              </a>
            )}
            {doi && (
              <a href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-brand-400 hover:underline">
                DOI
              </a>
            )}
          </div>
          {authors && (
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{authors}</p>
          )}
          {abstract && (
            <>
              <p className={`text-[11px] text-slate-400 mt-1.5 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                {abstract}
              </p>
              {abstract.length > 120 && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="text-[10px] text-brand-400 hover:text-brand-300 mt-0.5 flex items-center gap-0.5"
                >
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

/* ── Patent database card ── */
function PatentCard({ patent, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 + 0.1 }}
      className="glass-card p-3.5 hover:border-violet-500/20 transition-all duration-150"
    >
      <a
        href={patent.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-2 group"
      >
        <div className="w-6 h-6 rounded-md bg-violet-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
          <FlaskConical className="w-3 h-3 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white group-hover:text-violet-300 transition-colors leading-snug flex items-center gap-1">
            {patent.source}
            <ExternalLink className="w-2.5 h-2.5 opacity-60 flex-shrink-0" />
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">{patent.jurisdiction}</p>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{patent.description}</p>
        </div>
      </a>
    </motion.div>
  )
}

/* ── Results panel (papers + patents) ── */
function ResultsPanel({ papers, patents, query }) {
  const [tab, setTab] = useState('papers')

  if (!papers.length && !patents.length) return null

  return (
    <div className="border-t border-white/5 pt-3 mt-3">
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-3">
        <button
          onClick={() => setTab('papers')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            ${tab === 'papers' ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <BookOpen className="w-3 h-3" />
          Papers
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
            ${tab === 'papers' ? 'bg-brand-500/20 text-brand-300' : 'bg-white/8 text-slate-500'}`}>
            {papers.length}
          </span>
        </button>
        <button
          onClick={() => setTab('patents')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            ${tab === 'patents' ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <FlaskConical className="w-3 h-3" />
          Patents
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
            ${tab === 'patents' ? 'bg-violet-500/20 text-violet-300' : 'bg-white/8 text-slate-500'}`}>
            {patents.length}
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="space-y-2 max-h-72 overflow-y-auto scroll-area pr-1">
        {tab === 'papers' && (
          papers.length > 0
            ? papers.map((p, i) => <PaperCard key={i} paper={p} index={i} />)
            : <p className="text-xs text-slate-500 text-center py-4">No papers found for this query.</p>
        )}
        {tab === 'patents' && (
          patents.map((p, i) => <PatentCard key={i} patent={p} index={i} />)
        )}
      </div>
    </div>
  )
}

/* ── A single chat message bubble ── */
function MessageBubble({ msg, isLast }) {
  const isUser = msg.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
        ${isUser
          ? 'bg-brand-500/20 border border-brand-500/30'
          : 'bg-gradient-to-br from-brand-500 to-violet-500 shadow-lg shadow-brand-500/20'
        }`}
      >
        {isUser
          ? <User className="w-3.5 h-3.5 text-brand-400" />
          : <Sparkles className="w-3.5 h-3.5 text-white" />
        }
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? 'bg-brand-500/15 border border-brand-500/20 text-slate-100 rounded-tr-sm'
            : 'bg-white/3 border border-white/8 text-slate-200 rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p>{msg.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none
              prose-p:my-1 prose-ul:my-1 prose-li:my-0.5
              prose-h2:text-sm prose-h3:text-xs prose-h2:mt-3 prose-h3:mt-2
              prose-a:text-brand-400 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-white prose-code:text-brand-300">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Papers / Patents inline results */}
        {!isUser && msg.papers && (
          <div className="w-full">
            <ResultsPanel papers={msg.papers} patents={msg.patents || []} query={msg.query} />
          </div>
        )}

        {/* Actions */}
        {!isUser && (
          <div className="flex items-center gap-1 px-1">
            <CopyButton text={msg.content} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ── Main chat page ── */
export default function ResearchChat() {
  const [messages, setMessages]     = useState([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [paperLimit, setPaperLimit] = useState(10)
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)
  const abortRef   = useRef(null)

  // Auto-scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || input).trim()
    if (!trimmed || loading) return

    setInput('')
    const userMsg = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    // Build history for API (exclude embedded paper data)
    const history = messages.map(m => ({ role: m.role, content: m.content }))

    try {
      const { data } = await researchApi.chat(trimmed, history, paperLimit)
      const assistantMsg = {
        role: 'assistant',
        content: data.reply,
        papers:  data.papers,
        patents: data.patents,
        query:   data.query_used,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Request failed. Is the backend running?'
      toast.error(detail)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${detail}`,
        papers: [],
        patents: [],
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, messages, paperLimit])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex h-full flex-col bg-[#0f1117]">

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5 bg-[#0f1117]/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Search className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Research Intelligence</h1>
            <p className="text-[11px] text-slate-500">Papers · Patents · AI analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Paper limit control */}
          <div className="hidden sm:flex items-center gap-2">
            <label className="text-xs text-slate-400">Papers per search:</label>
            <select
              value={paperLimit}
              onChange={e => setPaperLimit(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-300 outline-none focus:border-brand-500/40"
            >
              {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 border border-white/8 transition-all"
            >
              <RotateCcw className="w-3 h-3" /> New chat
            </button>
          )}
        </div>
      </div>

      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto scroll-area px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Empty state */}
          {messages.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center pt-8 pb-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 border border-brand-500/20 flex items-center justify-center mb-5">
                <Sparkles className="w-8 h-8 text-brand-400" />
              </div>
              <h2 className="text-xl font-display font-bold text-white mb-2">
                Research Intelligence
              </h2>
              <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
                Ask about any research topic or startup idea. I'll search academic papers from
                Semantic Scholar and surface patent databases — then analyse what I find.
              </p>

              {/* Suggestion chips */}
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
                      bg-white/4 border border-white/8 text-slate-300
                      hover:bg-brand-500/10 hover:border-brand-500/20 hover:text-white
                      transition-all duration-150"
                  >
                    <Lightbulb className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Messages */}
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} isLast={i === messages.length - 1} />
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white/3 border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-2">
                  <TypingDots />
                  <span className="text-xs text-slate-500">Searching papers and patents…</span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 border-t border-white/5 bg-[#0f1117]/90 backdrop-blur-sm px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 bg-white/4 border border-white/10 rounded-2xl px-4 py-3
            focus-within:border-brand-500/40 focus-within:bg-white/5 transition-all duration-200">
            <Search className="w-4 h-4 text-slate-500 flex-shrink-0 mb-0.5" />
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about research papers, patents, or any topic… (Enter to send)"
              rows={1}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none resize-none max-h-32 leading-relaxed"
              style={{ minHeight: '22px' }}
              aria-label="Research query input"
            />
            <motion.button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              whileTap={{ scale: 0.9 }}
              className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0
                hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all
                shadow-lg shadow-brand-500/30"
              aria-label="Send message"
            >
              {loading
                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                : <Send className="w-3.5 h-3.5 text-white" />
              }
            </motion.button>
          </div>
          <p className="text-[10px] text-slate-600 text-center mt-2">
            Searches Semantic Scholar · Google Patents · WIPO · EPO · USPTO · IP India
          </p>
        </div>
      </div>
    </div>
  )
}
