import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Moon, Sun, LogOut, User, Shield, Settings, Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const NAV_LINKS = [
  { to: '/startup',       label: 'Startup AI',  public: true  },
  { to: '/research-chat', label: 'Research',    public: true  },
  { to: '/explain',       label: 'XAI',         public: false },
  { to: '/bias',          label: 'Bias Audit',  public: false },
  { to: '/reports',       label: 'Reports',     public: false },
]

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (path) => location.pathname === path
  const visibleLinks = NAV_LINKS.filter(l => l.public || isAuthenticated)

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/6 bg-[#0a0d14]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-[15px] text-white tracking-tight">TrustEval</span>
          <span className="hidden sm:block text-[10px] text-slate-500 font-medium border border-white/10 rounded-full px-2 py-0.5">XAI</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
          {visibleLinks.map(({ to, label }) => (
            <Link key={to} to={to}
              className={`nav-item ${isActive(to) ? 'active' : ''} ${to === '/startup' ? 'text-brand-400 hover:text-brand-300' : ''}`}>
              {label}
              {to === '/startup' && (
                <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/20">NEW</span>
              )}
            </Link>
          ))}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-1.5">
          {/* Theme toggle */}
          <motion.button whileTap={{ scale: 0.9 }} onClick={toggle}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all"
            aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </motion.button>

          {isAuthenticated && (
            <Link to="/settings"
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all ${isActive('/settings') ? 'text-white bg-white/8' : ''}`}
              aria-label="Settings">
              <Settings className="w-4 h-4" />
            </Link>
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-1.5">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8">
                <div className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center">
                  <User className="w-3 h-3 text-brand-400" />
                </div>
                <span className="text-xs text-slate-300 font-medium max-w-[100px] truncate">
                  {user?.name || user?.email?.split('@')[0]}
                </span>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleLogout}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-coral-400 hover:bg-coral-500/10 transition-all"
                aria-label="Sign out">
                <LogOut className="w-4 h-4" />
              </motion.button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link to="/login"  className="btn-secondary text-xs py-1.5 px-3">Sign in</Link>
              <Link to="/signup" className="btn-primary  text-xs py-1.5 px-3">Get started</Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all"
            onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-white/6 bg-[#0a0d14]/95 overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1">
              {visibleLinks.map(({ to, label }) => (
                <Link key={to} to={to} onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${isActive(to) ? 'text-white bg-white/8' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                  {label}
                </Link>
              ))}
              {isAuthenticated && (
                <Link to="/settings" onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5">
                  Settings
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
