import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 180000, // 3 min for heavy AI ops
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('te-token')
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

export const authApi = {
  signup: (data) => api.post('/auth/signup', data),
  login:  (data) => api.post('/auth/login', data),
  me:     ()     => api.get('/auth/me'),
}

export const evaluateApi = {
  evaluate: (data) => api.post('/evaluate', data),
}

export const explainApi = {
  shap: (profile) => api.post('/explain/shap', { profile }),
  dice: (profile) => api.post('/explain/dice', { profile }),
}

export const biasApi = {
  audit:    (attr) => api.post('/bias/audit',    { sensitive_attribute: attr }),
  mitigate: (attr) => api.post('/bias/mitigate', { sensitive_attribute: attr }),
}

export const reportsApi = {
  history:     (q = '') => api.get('/reports/history', { params: q ? { q } : {} }),
  get:         (id)     => api.get(`/reports/${id}`),
  getProfile:  (id)     => api.get(`/reports/profile/${id}`),
  explain:     (id)     => api.get(`/reports/explain/${id}`),
  delete:      (id)     => api.delete(`/reports/${id}`),
}

export const researchApi = {
  chat:           (message, history = [], paper_limit = 10) =>
                    api.post('/research/chat', { message, history, paper_limit }),
  patentKeywords: (idea, patents) =>
                    api.post('/research/patent-keywords', { idea, patents }),
}

export const startupApi = {
  analyze: (startup_idea, mode = 'startup', profile = {}) =>
    api.post('/startup', {
      startup_idea,
      mode,
      gender:           profile.gender           ?? 0,
      founder_location: profile.founder_location ?? 0,
      education_level:  profile.education_level  ?? 0,
      funding_access:   profile.funding_access   ?? 0,
    }),
}

export const configApi = {
  setGeminiKey:  (key) => api.post('/config/gemini-key', { gemini_api_key: key }),
  getKeyStatus:  ()    => api.get('/config/gemini-key'),
  testKey:       ()    => api.post('/config/gemini-key/test'),
}

export default api
