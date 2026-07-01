import axios, { AxiosError } from 'axios'

// En desarrollo usa el proxy de Vite (/api → localhost:8000).
// En producción (Netlify) usa VITE_API_URL con la URL de Railway.
const BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api/v1'

// Solo loguear en desarrollo
const isDev = (import.meta as any).env?.DEV === true

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 90000, // 90s — aumentado para tareas normales
  headers: { 'Content-Type': 'application/json' },
})

// ── Interceptor de request — Token Auth ───────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('nexus_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    if (isDev) {
      console.debug(`[NEXUS API →] ${config.method?.toUpperCase()} ${config.url}`)
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Interceptor de response — manejo global de errores ────────────────────────
api.interceptors.response.use(
  (response) => {
    if (isDev) {
      console.debug(
        `[NEXUS API ←] ${response.status} ${response.config.url}`,
        response.data
      )
    }
    return response
  },
  (error: AxiosError) => {
    const status = error.response?.status
    const detail = (error.response?.data as any)?.detail || error.message

    if (status === 401) {
      // Token expirado o inválido — limpiar sesión y redirigir al login
      console.warn('[NEXUS API] Sesión expirada (401) — cerrando sesión')
      localStorage.removeItem('nexus_token')
      localStorage.removeItem('nexus_user')
      // Forzar recarga para que AuthContext detecte la ausencia del token
      window.location.reload()
    } else if (status === 503) {
      console.error('[NEXUS API] Servicio no disponible (503):', detail)
    } else if (status === 500) {
      console.error('[NEXUS API] Error interno del servidor (500):', detail)
    } else if (status === 400) {
      console.warn('[NEXUS API] Solicitud inválida (400):', detail)
    } else if (!status) {
      console.error('[NEXUS API] Sin respuesta del servidor — ¿backend activo?')
    }

    return Promise.reject(error)
  }
)

// ── Tipos de respuesta ─────────────────────────────────────────────────────────
export interface ChatResponse {
  response: string
  session_id: string
  tokens_used: number
  cost_usd: number
  latency_ms: number
  hallucination_score?: number
  groundedness_score?: number
  jailbreak_detected?: boolean
}

export interface RAGResponse {
  answer: string
  sources: string[]
  groundedness_score: number
  hallucination_score: number
  relevancy_score?: number
  tokens_used: number
  cost_usd: number
  latency_ms: number
}

export interface CodeIssue {
  severity: string
  line?: number
  description: string
  suggestion: string
}

export interface CodeReviewResponse {
  summary: string
  issues: CodeIssue[]
  quality_score: number
  security_score: number
  maintainability_score: number
  corrected_code: string
  tokens_used: number
  cost_usd: number
  latency_ms: number
}

export interface SecurityIssue {
  severity: string
  title: string
  description: string
  line_hint?: string
  recommendation?: string
}

export interface TestGeneratorResponse {
  generated_tests: string
  coverage_estimate: number
  test_count: number
  explanation: string
  security_issues?: SecurityIssue[]
  tokens_used: number
  cost_usd: number
  latency_ms: number
}

export interface RepoChatIndexResponse {
  repo_name: string
  collection_name: string
  files_indexed: number
  chunks_indexed: number
  files_list: string[]
  tokens_used: number
  cost_usd: number
  latency_ms: number
}

export interface RepoChatResponse {
  repo_name: string
  collection_name: string
  answer: string
  sources: string[]
  groundedness_score: number
  hallucination_score: number
  relevancy_score?: number
  tokens_used: number
  cost_usd: number
  latency_ms: number
}

export interface ABConfig {
  model: string
  temperature: number
  system_prompt: string
}

export interface ABCompareResponse {
  response_a: string
  response_b: string
  tokens_a: number
  tokens_b: number
  cost_a: number
  cost_b: number
  latency_a: number
  latency_b: number
  winner: 'A' | 'B' | 'TIE'
  judge_explanation: string
  model_a: string
  model_b: string
  temperature_a: number
  temperature_b: number
}

export interface CommitAnalysis {
  hash: string
  author: string
  date: string
  message: string
  risk_score: number
  risk_level: string
  summary: string
  issues: string[]
}

export interface CommitAnalyzeResponse {
  repo_url: string
  commits: CommitAnalysis[]
  average_risk: number
  highest_risk: number
  tokens_used: number
  cost_usd: number
  latency_ms: number
}

/** Coincide con el schema Pydantic AgentStep del backend */
export interface AgentStep {
  step: number
  action: string
  status: 'running' | 'done' | 'error'
  input?: string
  output?: string
}

export interface RepoAnalysisResponse {
  repo_name: string
  summary: string
  files_analyzed: number
  issues_found: number
  agent_steps: AgentStep[]
  quality_score: number
  tokens_used: number
  cost_usd: number
  latency_ms: number
}

export interface RecentConversation {
  id: number
  module: string
  user_message: string
  tokens_used: number
  cost_usd: number
  latency_ms: number
  hallucination_score?: number
  created_at: string
}

export interface TopUser {
  user_email: string
  conversations: number
}

export interface GlobalMetrics {
  total_conversations: number
  total_tokens: number
  total_cost_usd: number
  avg_latency_ms: number
  avg_hallucination_score?: number
  conversations_by_module: Record<string, number>
  recent_conversations: RecentConversation[]
  top_user?: string
  top_user_conversations?: number
  top_users?: TopUser[]
}

export interface DocumentOut {
  id: number
  filename: string
  chunk_count: number
  doc_type: string
  collection_name: string
  created_at?: string
}

export type LatencyPoint = { time: string; latency: number; module: string }
export type CostPoint = { time: string; cost: number; module: string }

// ── Servicios API ──────────────────────────────────────────────────────────────
export const chatAPI = {
  send: (message: string, sessionId = 'default') =>
    api.post<ChatResponse>('/chat/', { message, session_id: sessionId }),
  stream: async function* (message: string, sessionId = 'default') {
    const token = localStorage.getItem('nexus_token')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    // El BASE_URL ya fue extraído de env o es /api/v1
    const baseUrl = (import.meta as any).env?.VITE_API_URL || '/api/v1'
    const url = `${baseUrl.replace(/\/$/, '')}/chat/stream`

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, session_id: sessionId }),
    })

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    if (!response.body) throw new Error('Response body is null')

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split('\n\n__METRICS__:')
      if (parts.length > 1) {
        // Encontramos las métricas
        yield parts[0] // Mandamos el texto restante
        try {
          const metrics = JSON.parse(parts[1])
          yield { metrics }
        } catch (e) { }
        break
      } else {
        yield buffer
        buffer = '' // Reseteamos buffer tras emitir
      }
    }
  }
}

export const documentsAPI = {
  upload: (file: File, collection = 'default') => {
    const form = new FormData()
    form.append('file', file)
    form.append('collection_name', collection)
    return api.post<{ message: string; filename: string; chunks: number; collection: string }>(
      '/documents/upload',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
  query: (question: string, sessionId = 'default', collection = 'default', filenameFilter?: string | null) =>
    api.post<RAGResponse>('/documents/query', {
      question,
      session_id: sessionId,
      collection_name: collection,
      filename_filter: filenameFilter || null
    }),
  list: () => api.get<DocumentOut[]>('/documents/'),
  delete: (id: number) => api.delete<{ message: string }>(`/documents/${id}`),
  deleteAll: (collection = 'default') => api.delete<{ message: string, count: number }>(`/documents/?collection_name=${collection}`),
}

export const codeAPI = {
  review: (code: string, language: string, sessionId = 'default') =>
    api.post<CodeReviewResponse>('/code/review', { code, language, session_id: sessionId }),
  analyzeRepo: (repoUrl: string, sessionId = 'default') =>
    api.post<RepoAnalysisResponse>('/code/analyze-repo', {
      repo_url: repoUrl,
      session_id: sessionId,
    }, { timeout: 600000 }),
  analyzeRepoStream: async function* (repoUrl: string, sessionId = 'default') {
    const token = localStorage.getItem('nexus_token')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const baseUrl = (import.meta as any).env?.VITE_API_URL || '/api/v1'
    const url = `${baseUrl.replace(/\/$/, '')}/code/analyze-repo/stream`

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ repo_url: repoUrl, session_id: sessionId }),
    })

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    if (!response.body) throw new Error('Response body is null')

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // El último fragmento puede estar incompleto

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line)
            yield data
          } catch (e) { }
        }
      }
    }

    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer)
        yield data
      } catch (e) { }
    }
  }
}

export const exportAPI = {
  codeReviewMarkdown: (reviewData: CodeReviewResponse) =>
    api.post('/export/code-review', { review_data: reviewData }, { responseType: 'blob' }),
  codeReviewPDF: (reviewData: CodeReviewResponse) =>
    api.post('/export/code-review/pdf', { review_data: reviewData }, { responseType: 'blob' }),
  repoReportMarkdown: (repoData: RepoAnalysisResponse) =>
    api.post('/export/repo-report', { repo_data: repoData }, { responseType: 'blob' }),
  repoReportPDF: (repoData: RepoAnalysisResponse) =>
    api.post('/export/repo-report/pdf', { repo_data: repoData }, { responseType: 'blob' }),
}

export const testAPI = {
  generate: (code: string, language: string, framework: string, sessionId = 'default') =>
    api.post<TestGeneratorResponse>('/tests/generate', {
      code,
      language,
      framework,
      session_id: sessionId,
    }),
}

export const abAPI = {
  compare: (prompt: string, config_a: ABConfig, config_b: ABConfig) =>
    api.post<ABCompareResponse>('/ab/compare', { prompt, config_a, config_b }),
}

export const commitsAPI = {
  analyze: (repoUrl: string, nCommits: number, sessionId = 'default') =>
    api.post<CommitAnalyzeResponse>('/commits/analyze', {
      repo_url: repoUrl,
      n_commits: nCommits,
      session_id: sessionId,
    }, { timeout: 600000 }),
}

export const repoChatAPI = {
  index: (repoUrl: string, sessionId = 'default') =>
    api.post<RepoChatIndexResponse>('/repo-chat/index', { repo_url: repoUrl, session_id: sessionId }, { timeout: 600000 }),
  query: (repoUrl: string, question: string, sessionId = 'default', top_k = 4, filenameFilter?: string | null) =>
    api.post<RepoChatResponse>('/repo-chat/query', {
      repo_url: repoUrl,
      question,
      session_id: sessionId,
      top_k,
      filename_filter: filenameFilter || null,
    }),
}

export const metricsAPI = {
  global: (personal: boolean = false) => api.get<GlobalMetrics>(`/metrics/?personal=${personal}`),
  latency: (personal: boolean = false, limit?: number) => api.get<LatencyPoint[]>(`/metrics/latency?personal=${personal}${limit ? `&limit=${limit}` : ''}`),
  cost: (personal: boolean = false, limit?: number) => api.get<CostPoint[]>(`/metrics/cost?personal=${personal}${limit ? `&limit=${limit}` : ''}`),
}

export const authAPI = {
  login: async (email: string, password: string) => {
    const formData = new URLSearchParams()
    formData.append('username', email)
    formData.append('password', password)
    return api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
  },
  register: (email: string, password: string) => 
    api.post('/auth/register', { email, password }),
  updatePreferences: (viewed_context_tabs: string) =>
    api.put('/auth/me/preferences', { viewed_context_tabs }),
  updateTheme: (theme_color: string) =>
    api.put('/auth/me/theme', { theme_color }),
  updateProfile: (profileData: {
    full_name?: string,
    profile_picture?: string,
    custom_ai_instructions?: string,
    language?: string,
    hardware_specs?: string
  }) => api.put('/auth/me/profile', profileData),
}

export const webauthnAPI = {
  listPasskeys: () => api.get<any[]>('/auth/webauthn/list'),
  deletePasskey: (id: string) => api.delete<{message: string}>(`/auth/webauthn/delete/${id}`)
}

export interface AdminDashboardData {
  budget_cop: number;
  total_tokens_purchased: number;
  trm_usd_cop: number;
  groq_cost_per_million: number;
  total_users: number;
  token_limit_per_user: number;
  llm_provider: string;
  ollama_base_url: string;
  ollama_model: string;
  payment_methods: any[];
  users: any[];
}

export const adminAPI = {
  getDashboard: () => api.get<AdminDashboardData>('/admin/dashboard'),
  updateSettings: (budget_cop: number, trm?: number, groq_rate?: number) =>
    api.put('/admin/settings', {
      budget_cop,
      trm_usd_cop: trm,
      groq_cost_per_million: groq_rate,
    }),
  updateLLMSettings: (llm_provider: string, ollama_base_url: string, ollama_model: string) =>
    api.put('/admin/settings/llm', {
      llm_provider,
      ollama_base_url,
      ollama_model
    }),
  createUser: (email: string, password: string, role: string, plan: string) =>
    api.post('/admin/users', { email, password, role, plan }),
  updateUser: (email: string, data: { role?: string, plan?: string, password?: string }) =>
    api.put(`/admin/users/${encodeURIComponent(email)}`, data),
  deleteUser: (email: string) =>
    api.delete(`/admin/users/${encodeURIComponent(email)}`),
  checkOllamaStatus: () =>
    api.get<{status: string}>('/admin/ollama/status'),
  startOllama: () =>
    api.post<{message: string}>('/admin/ollama/start'),
  stopOllama: () =>
    api.post<{message: string}>('/admin/ollama/stop'),
}