import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Initialise synchronously to avoid a flicker
    const token = localStorage.getItem('te-token')
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.replace('te_', '')))
      if (payload.exp > Date.now() / 1000) {
        const name = localStorage.getItem('te-user-name') || payload.email
        return { email: payload.email, id: payload.user_id, name }
      }
    } catch { /* invalid token */ }
    return null
  })
  const [token, setToken] = useState(() => localStorage.getItem('te-token') || null)
  const [loading, setLoading] = useState(false)

  const logout = useCallback(() => {
    localStorage.removeItem('te-token')
    localStorage.removeItem('te-user-name')
    setToken(null)
    setUser(null)
  }, [])

  // Validate token expiry whenever it changes
  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }
    try {
      const payload = JSON.parse(atob(token.replace('te_', '')))
      if (payload.exp <= Date.now() / 1000) logout()
    } catch {
      logout()
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(false)
  }, [token, logout])

  const login = (tokenStr, userName, userEmail) => {
    localStorage.setItem('te-token', tokenStr)
    localStorage.setItem('te-user-name', userName)
    setToken(tokenStr)
    try {
      const payload = JSON.parse(atob(tokenStr.replace('te_', '')))
      setUser({ email: userEmail, id: payload.user_id, name: userName })
    } catch {
      setUser({ email: userEmail, name: userName })
    }
  }

  // logout defined above with useCallback

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
