import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Eye, EyeOff, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../api/client'
import { useAuth } from '../context/AuthContext'

function AuthForm({ mode }) {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [show, setShow]   = useState(false)
  const [loading, setLoading] = useState(false)

  const isSignup = mode === 'signup'

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { toast.error('Email and password are required'); return }
    if (isSignup && !form.name) { toast.error('Name is required'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }

    setLoading(true)
    try {
      const { data } = isSignup
        ? await authApi.signup(form)
        : await authApi.login({ email: form.email, password: form.password })

      login(data.access_token, data.user_name, data.user_email)
      toast.success(isSignup ? 'Account created!' : 'Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      const msg = err?.response?.data?.detail || (isSignup ? 'Signup failed' : 'Invalid credentials')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-20">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-brand-500/6 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="glass-card p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/30">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white">
              {isSignup ? 'Create account' : 'Welcome back'}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {isSignup ? 'Start evaluating AI trustworthiness' : 'Sign in to TrustEval'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {isSignup && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Full name</label>
                <input
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ada Lovelace"
                  className="input-field"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email address</label>
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="ada@example.com"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  name="password"
                  type={show ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="input-field pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {isSignup ? 'Creating account…' : 'Signing in…'}
                </span>
              ) : (
                <>
                  {isSignup ? 'Create account' : 'Sign in'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Switch mode */}
          <p className="text-center text-sm text-slate-400 mt-6">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}
            {' '}
            <Link
              to={isSignup ? '/login' : '/signup'}
              className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
            >
              {isSignup ? 'Sign in' : 'Sign up'}
            </Link>
          </p>
        </div>

        {/* Back to home */}
        <p className="text-center text-xs text-slate-600 mt-6">
          <Link to="/" className="hover:text-slate-400 transition-colors">← Back to home</Link>
        </p>
      </motion.div>
    </div>
  )
}

export function LoginPage()  { return <AuthForm mode="login" /> }
export function SignupPage() { return <AuthForm mode="signup" /> }
