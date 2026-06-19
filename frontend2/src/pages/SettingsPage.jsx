import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Moon, Sun, Shield, Trash2, LogOut, Bell, Key, Info, Sparkles, CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useNavigate } from 'react-router-dom'
import { configApi } from '../api/client'

function SettingRow({ icon: Icon, iconClass = 'text-brand-400', title, description, action }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
          <Icon className={`w-4 h-4 ${iconClass}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState(true)
  const [geminiKey, setGeminiKey]         = useState('')
  const [keyStatus, setKeyStatus]         = useState(null)   // {configured, key_preview}
  const [keyVisible, setKeyVisible]       = useState(false)
  const [keyLoading, setKeyLoading]       = useState(false)
  const [testLoading, setTestLoading]     = useState(false)

  useEffect(() => {
    configApi.getKeyStatus().then(r => setKeyStatus(r.data)).catch(() => {})
  }, [])

  const handleSaveKey = async () => {
    setKeyLoading(true)
    try {
      const { data } = await configApi.setGeminiKey(geminiKey)
      toast.success(data.message)
      const status = await configApi.getKeyStatus()
      setKeyStatus(status.data)
      if (geminiKey) setGeminiKey('')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save key')
    } finally { setKeyLoading(false) }
  }

  const handleTestKey = async () => {
    setTestLoading(true)
    try {
      const { data } = await configApi.testKey()
      if (data.status === 'ok') toast.success(data.message)
      else toast.error(data.message)
    } catch { toast.error('Test failed') }
    finally { setTestLoading(false) }
  }

  const handleLogout = () => { logout(); navigate('/') }
  const handleDeleteAccount = () => {
    toast('Account deletion is not yet implemented.', { icon: 'ℹ️' })
  }

  return (
    <div className="flex h-full">
      <main className="flex-1 overflow-y-auto scroll-area">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-xl font-display font-bold text-white">Settings</h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage your account, appearance and preferences.</p>
          </div>

          {/* Profile */}
          <div className="glass-card p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Profile</p>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center">
                <span className="text-xl font-bold text-white">
                  {(user?.name || user?.email || 'U')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{user?.name || 'User'}</p>
                <p className="text-xs text-slate-400">{user?.email}</p>
              </div>
            </div>
            <SettingRow icon={User} title="Display Name" description={user?.name || 'Not set'}
              action={<span className="text-xs text-slate-500">Read-only</span>} />
            <SettingRow icon={Key} title="Email" description={user?.email}
              action={<span className="text-xs text-slate-500">Read-only</span>} />
          </div>

          {/* Appearance */}
          <div className="glass-card p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Appearance</p>
            <SettingRow
              icon={theme === 'dark' ? Moon : Sun}
              iconClass={theme === 'dark' ? 'text-violet-400' : 'text-amber-400'}
              title="Theme"
              description={`Currently using ${theme} mode`}
              action={
                <motion.button whileTap={{ scale: 0.95 }} onClick={toggle}
                  className={`relative w-12 h-6 rounded-full transition-all duration-300 ${theme === 'dark' ? 'bg-brand-500' : 'bg-slate-300'}`}>
                  <motion.div
                    animate={{ x: theme === 'dark' ? 24 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                  />
                </motion.button>
              }
            />
          </div>

          {/* Preferences */}
          <div className="glass-card p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Preferences</p>
            <SettingRow icon={Bell} title="Notifications" description="Receive analysis completion alerts"
              action={
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setNotifications(n => !n)}
                  className={`relative w-12 h-6 rounded-full transition-all duration-300 ${notifications ? 'bg-brand-500' : 'bg-white/10'}`}>
                  <motion.div
                    animate={{ x: notifications ? 24 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                  />
                </motion.button>
              }
            />
          </div>

          {/* About */}
          <div className="glass-card p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">About</p>
            <SettingRow icon={Shield} iconClass="text-brand-400" title="TrustEval"
              description="Explainable AI & Bias-Aware Startup Feasibility System v2.0"
              action={<span className="tag text-[10px]">v2.0</span>} />
            <SettingRow icon={Info} title="Built with"
              description="FastAPI · React · Gemini AI · SHAP · DiCE · Fairlearn"
              action={null} />
          </div>

          {/* Gemini AI Configuration */}
          <div className="glass-card p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">AI Configuration</p>

            {/* Status banner */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-4 ${
              keyStatus?.configured
                ? 'bg-emerald-500/8 border-emerald-500/20'
                : 'bg-amber-500/8 border-amber-500/20'
            }`}>
              {keyStatus?.configured
                ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                : <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
              <div className="flex-1">
                <p className={`text-xs font-semibold ${keyStatus?.configured ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {keyStatus?.configured ? 'Gemini AI is active' : 'Gemini AI not configured'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {keyStatus?.configured
                    ? `Key: ${keyStatus.key_preview} — Real AI analysis is enabled`
                    : 'Without a key, analysis uses rule-based fallback and gives similar results for every idea'}
                </p>
              </div>
              {keyStatus?.configured && (
                <button onClick={handleTestKey} disabled={testLoading}
                  className="flex-shrink-0 text-[11px] px-3 py-1.5 rounded-lg border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/10 transition-all">
                  {testLoading ? 'Testing…' : 'Test'}
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Gemini API Key
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                    className="ml-2 text-brand-400 hover:underline text-[10px]">Get a free key →</a>
                </label>
                <div className="relative">
                  <input
                    type={keyVisible ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={e => setGeminiKey(e.target.value)}
                    placeholder={keyStatus?.configured ? `Current: ${keyStatus.key_preview}` : 'AIza...'}
                    className="input-field pr-10 font-mono text-xs"
                  />
                  <button onClick={() => setKeyVisible(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {keyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-600 mt-1">
                  Stored in server memory for this session. Add to .env file for persistence across restarts.
                </p>
              </div>
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleSaveKey}
                  disabled={keyLoading}
                  className="btn-primary text-xs py-2 flex items-center gap-2">
                  {keyLoading
                    ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <Sparkles className="w-3.5 h-3.5" />}
                  {geminiKey ? 'Save Key' : 'Clear Key'}
                </motion.button>
                {keyStatus?.configured && (
                  <button onClick={handleTestKey} disabled={testLoading}
                    className="btn-secondary text-xs py-2 flex items-center gap-2">
                    {testLoading
                      ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      : <CheckCircle className="w-3.5 h-3.5" />}
                    Test Connection
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="glass-card p-5 border-coral-500/15">
            <p className="text-xs font-semibold text-coral-400 uppercase tracking-wider mb-4">Account</p>
            <SettingRow icon={LogOut} iconClass="text-coral-400" title="Sign out"
              description="Sign out of your TrustEval account"
              action={
                <button onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-coral-500/30 text-coral-400 hover:bg-coral-500/10 transition-all">
                  Sign out
                </button>
              }
            />
            <SettingRow icon={Trash2} iconClass="text-red-400" title="Delete Account"
              description="Permanently delete your account and all reports"
              action={
                <button onClick={handleDeleteAccount}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
                  Delete
                </button>
              }
            />
          </div>

        </div>
      </main>
    </div>
  )
}
