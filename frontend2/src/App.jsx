import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import { LoginPage, SignupPage } from './pages/Auth'
import ResearchChat from './pages/ResearchChat'
import ResearchPage from './pages/ResearchPage'
import BiasPage from './pages/BiasPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import StartupAnalyzer from './pages/StartupAnalyzer'
import { FullPageLoader } from './components/LoadingSpinner'
import { Toaster } from 'react-hot-toast'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <FullPageLoader label="Loading TrustEval…" />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function AppShell({ children }) {
  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex-1 overflow-hidden mt-14">{children}</div>
    </div>
  )
}

function PublicLayout({ children }) {
  return (
    <>
      <Navbar />
      <div className="pt-14">{children}</div>
    </>
  )
}

export default function App() {
  const { loading } = useAuth()
  if (loading) return <FullPageLoader label="Loading TrustEval…" />

  return (
    <>
      <Toaster position="top-right" toastOptions={{
        style: { background: '#111827', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '13px' },
        success: { iconTheme: { primary: '#10b981', secondary: '#111827' } },
        error:   { iconTheme: { primary: '#FF6B6B', secondary: '#111827' } },
      }} />

      <Routes>
        {/* Public */}
        <Route path="/"       element={<PublicLayout><Landing /></PublicLayout>} />
        <Route path="/login"  element={<PublicLayout><LoginPage /></PublicLayout>} />
        <Route path="/signup" element={<PublicLayout><SignupPage /></PublicLayout>} />

        {/* Public — no login needed */}
        <Route path="/research-chat" element={<AppShell><ResearchChat /></AppShell>} />
        <Route path="/startup"       element={<AppShell><StartupAnalyzer /></AppShell>} />

        {/* /dashboard redirects to /startup — unified analysis page */}
        <Route path="/dashboard" element={<Navigate to="/startup" replace />} />
        <Route path="/explain"   element={<ProtectedRoute><AppShell><ResearchPage /></AppShell></ProtectedRoute>} />
        <Route path="/bias"      element={<ProtectedRoute><AppShell><BiasPage /></AppShell></ProtectedRoute>} />
        <Route path="/reports"   element={<ProtectedRoute><AppShell><ReportsPage /></AppShell></ProtectedRoute>} />
        <Route path="/settings"  element={<ProtectedRoute><AppShell><SettingsPage /></AppShell></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
