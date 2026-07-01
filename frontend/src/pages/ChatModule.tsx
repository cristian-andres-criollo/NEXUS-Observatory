import React, { useState, useEffect, useRef } from 'react'
import { Layout } from '../components/layout/Layout'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { chatAPI, ChatResponse } from '../lib/api'
import { formatCost, formatTokens, formatLatency, generateSessionId } from '../lib/utils'
import { MetricCard } from '../components/ui/MetricCard'
import { ScoreBar } from '../components/ui/ScoreBar'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'
import { Send, Bot, User, Zap, DollarSign, Hash, AlertTriangle, Clock, BarChart2, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'

const SESSION_STORAGE_KEY = 'nexus_chat_session_id'
const getSessionStorageKey = (sessionId: string) => `nexus_chat_${sessionId}`

interface Message { role: 'user' | 'assistant'; content: string; meta?: ChatResponse; timestamp: Date }

function loadInitialSessionId(): string {
  if (typeof window === 'undefined') return generateSessionId()
  return localStorage.getItem(SESSION_STORAGE_KEY) || generateSessionId()
}

function loadInitialMessages(sessionId: string): Message[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(getSessionStorageKey(sessionId))
  if (!stored) return []
  try {
    return JSON.parse(stored) as Message[]
  } catch {
    return []
  }
}

interface SessionHistoryItem {
  id: string
  title: string
  date: Date
}

function getPastSessions(): SessionHistoryItem[] {
  if (typeof window === 'undefined') return []
  const sessions: SessionHistoryItem[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('nexus_chat_') && key !== 'nexus_chat_session_id') {
      try {
        const stored = localStorage.getItem(key)
        if (stored) {
          const msgs = JSON.parse(stored) as Message[]
          if (msgs.length > 0) {
            const firstUserMsg = msgs.find(m => m.role === 'user')?.content || 'Nuevo chat'
            const lastMsg = msgs[msgs.length - 1]
            sessions.push({
              id: key.replace('nexus_chat_', ''),
              title: firstUserMsg,
              date: new Date(lastMsg.timestamp)
            })
          }
        }
      } catch (e) {}
    }
  }
  return sessions.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export function ChatModule() {
  const initialSessionId = loadInitialSessionId()
  const [messages, setMessages] = useState<Message[]>(() => loadInitialMessages(initialSessionId))
  const [input, setInput] = useLocalStorage('chatmodule_input', '')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [lastMeta, setLastMeta] = useLocalStorage<ChatResponse | null>('chatmodule_lastMeta', null)
  const [pastSessions, setPastSessions] = useState<SessionHistoryItem[]>([])
  const { user } = useAuth()

  // Control del panel lateral en mobile
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPastSessions(getPastSessions())
  }, [messages, sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId)
  }, [sessionId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(getSessionStorageKey(sessionId), JSON.stringify(messages))
  }, [messages, sessionId])

  function startNewSession() {
    const newSessionId = generateSessionId()
    setSessionId(newSessionId)
    setMessages([])
    setLastMeta(null)
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, newSessionId)
      localStorage.setItem(getSessionStorageKey(newSessionId), JSON.stringify([]))
    }
  }

  function loadSession(id: string) {
    setSessionId(id)
    const msgs = loadInitialMessages(id)
    setMessages(msgs)
    const lastAst = [...msgs].reverse().find(m => m.role === 'assistant' && m.meta)
    setLastMeta(lastAst?.meta || null)
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, id)
    }
  }

  function deleteSession(id: string) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(getSessionStorageKey(id))
    }
    setPastSessions(prev => prev.filter(s => s.id !== id))
    if (sessionId === id) {
      startNewSession()
    }
    toast.success('Chat eliminado')
  }

  function clearAllHistory() {
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('nexus_chat_') && key !== 'nexus_chat_session_id') {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
    }
    setPastSessions([])
    startNewSession()
    toast.success('Todo el historial eliminado')
  }

  async function send() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(p => [...p, { role: 'user', content: userMsg, timestamp: new Date() }])
    
    setMessages(p => [...p, { role: 'assistant', content: '', timestamp: new Date() }])
    setLoading(true)
    
    try {
      const stream = chatAPI.stream(userMsg, sessionId)
      let fullContent = ''
      
      for await (const chunk of stream) {
        if (typeof chunk === 'string') {
          fullContent += chunk
          setMessages(p => {
            const newMsgs = [...p]
            newMsgs[newMsgs.length - 1].content = fullContent
            return newMsgs
          })
        } else if (chunk && chunk.metrics) {
          const meta = { ...chunk.metrics, response: fullContent } as ChatResponse
          setLastMeta(meta)
          setMessages(p => {
            const newMsgs = [...p]
            newMsgs[newMsgs.length - 1].meta = meta
            return newMsgs
          })
        }
      }
    } catch (e: any) {
      toast.error('Error de conexión o streaming')
      setMessages(p => {
        const newMsgs = [...p]
        if (!newMsgs[newMsgs.length - 1].content) {
          newMsgs[newMsgs.length - 1].content = '⚠️ Error de conexión.'
        }
        return newMsgs
      })
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <Layout title="ASISTENTE IA" subtitle="MÓDULO 1 — CHAT GENERAL / CASOS NO-SOFTWARE" noPadding>

      {/* ── Barra de sesión + toggle panel (mobile) ──────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 md:px-5 pb-2 pt-3 flex-shrink-0 flex-wrap gap-y-2 relative z-20">
        <div className="min-w-0">
          <p className="font-mono text-[10px] text-nexus-dim">Sesión actual:</p>
          <p className="font-mono text-xs text-nexus-text truncate max-w-[200px] sm:max-w-none">{sessionId}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Toggle panel lateral — solo mobile/tablet */}
          <button
            id="chat-side-panel-toggle"
            onClick={() => setIsSidePanelOpen(v => !v)}
            className={`panel-toggle-btn xl:hidden ${isSidePanelOpen ? 'active' : ''}`}
            aria-label="Panel de métricas y historial"
          >
            <BarChart2 size={12} />
            <span>Panel</span>
            {lastMeta && <span className="status-dot online ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={startNewSession}
            className="nexus-btn-secondary px-3 md:px-4 py-2 text-xs flex-shrink-0"
          >
            Nuevo chat
          </button>
        </div>
      </div>

      {/* ── Layout principal ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        
        {/* ── Área de chat ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto nexus-scrollbar p-3 sm:p-4 md:p-5 flex flex-col gap-4 scroll-smooth">
            <AnimatePresence initial={false}>
              {messages.length === 0 && (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex-1 flex flex-col items-center justify-center gap-4 text-center"
                >
                  <div className="relative">
                    <Bot size={48} className="text-nexus-blue opacity-60 drop-shadow-[0_0_15px_rgba(14,74,255,0.5)]" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-nexus-success rounded-full animate-pulse shadow-[0_0_8px_#00e676]" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold text-white tracking-widest drop-shadow-md">NEXUS ASISTENTE</p>
                    <p className="font-body text-xs text-nexus-dim mt-1 px-4">Instrumentado con LangSmith + Helicone + W&B Weave + Phoenix</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-w-md w-full px-4">
                    {[
                      '¿Qué es la observabilidad de LLMs?',
                      'Explícame cómo funciona RAG',
                      '¿Cuánto cuesta usar GPT-4o-mini?',
                      'Dame un ejemplo de alucinación en IA',
                    ].map(s => (
                      <button key={s} onClick={() => { setInput(s); }} className="nexus-btn text-left text-[10px] py-1.5 px-3 text-wrap hover:bg-white/5">
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
                  layout
                  className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg ${
                    m.role === 'user' ? 'bg-gradient-to-br from-nexus-blue/30 to-nexus-blue/10 border border-nexus-blue/40 shadow-nexus-blue/20' : 'bg-black/60 backdrop-blur border border-nexus-cyan/40 shadow-nexus-cyan/20'
                  }`}>
                    {m.role === 'user' ? (
                      user?.profile_picture ? (
                        <img src={user.profile_picture} alt="User" className="w-full h-full object-cover" />
                      ) : (
                        <User size={14} className="text-white drop-shadow-sm" />
                      )
                    ) : <Bot size={14} className="text-nexus-cyan drop-shadow-[0_0_5px_#00d4ff]" />}
                  </div>
                  <div className={`max-w-[85%] md:max-w-[70%] ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div className={`px-4 py-3 md:px-5 font-body leading-relaxed backdrop-blur-xl border border-white/10 shadow-xl ${
                      m.role === 'user' 
                        ? 'bg-nexus-blue/15 rounded-2xl rounded-tr-sm text-white text-[13px]' 
                        : m.meta?.jailbreak_detected 
                          ? 'bg-red-900/30 border-red-500/50 text-red-200 rounded-2xl rounded-tl-sm text-[13px]' 
                          : 'bg-black/50 text-nexus-text rounded-2xl rounded-tl-sm w-full'
                    }`}>
                      {m.meta?.jailbreak_detected && (
                        <div className="flex items-center gap-2 mb-2 text-red-400 font-bold">
                          <AlertTriangle size={16} />
                          <span>INTERVENCIÓN DEL GUARDRAIL</span>
                        </div>
                      )}
                      {m.role === 'assistant' && !m.meta?.jailbreak_detected ? (
                        <div className="prose prose-invert prose-sm md:prose-base max-w-none prose-pre:bg-black/60 prose-pre:border prose-pre:border-white/10 prose-headings:text-white prose-a:text-nexus-cyan prose-p:leading-relaxed prose-code:text-nexus-cyan prose-strong:text-nexus-ice">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      )}
                    </div>
                    {m.meta && !m.meta.jailbreak_detected && (
                      <div className="flex gap-2 flex-wrap mt-1">
                        <span className="font-mono text-[9px] text-nexus-cyan px-2 py-0.5 bg-nexus-cyan/10 rounded border border-nexus-cyan/20">{formatTokens(m.meta.tokens_used)} tokens</span>
                        <span className="font-mono text-[9px] text-nexus-accent px-2 py-0.5 bg-nexus-accent/10 rounded border border-nexus-accent/20">{formatCost(m.meta.cost_usd)}</span>
                        <span className="font-mono text-[9px] text-nexus-warn px-2 py-0.5 bg-nexus-warn/10 rounded border border-nexus-warn/20">{formatLatency(m.meta.latency_ms)}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black/60 backdrop-blur border border-nexus-cyan/40 shadow-lg shadow-nexus-cyan/20">
                    <Bot size={14} className="text-nexus-cyan drop-shadow-[0_0_5px_#00d4ff]" />
                  </div>
                  <div className="nexus-panel px-4 py-3 flex items-center gap-3">
                    <Spinner size={16} />
                    <span className="font-mono text-xs text-nexus-dim animate-pulse">Procesando IA...</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={bottomRef} className="h-4" />
          </div>

          {/* Input */}
          <div className="p-3 sm:p-4 md:p-5 bg-black/30 backdrop-blur-2xl flex-shrink-0 z-20 border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col sm:flex-row gap-3">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Escribe tu mensaje... (Enter para enviar)"
                className="nexus-input flex-1 resize-none min-h-[48px] pt-3 leading-tight shadow-inner"
                rows={1}
              />
              <button onClick={send} disabled={loading || !input.trim()} className="nexus-btn-primary px-6 py-3 sm:py-0 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                <Send size={14} />
                <span>ENVIAR</span>
              </button>
            </div>
            <p className="font-mono text-[9px] text-nexus-dim mt-2 text-center sm:text-left">
              Cada mensaje es trazado automáticamente en LangSmith • Modelo: Groq llama-3.1-8b-instant
            </p>
          </div>
        </div>

        {/* ── Panel lateral — desktop siempre visible ────────────────────── */}
        <div className="hidden xl:block w-80 flex-shrink-0 border-l border-white/5 bg-black/40 backdrop-blur-2xl overflow-y-auto nexus-scrollbar shadow-[-10px_0_30px_rgba(0,0,0,0.3)]">
          <div className="flex flex-col gap-6 p-4 md:p-5 lg:p-6">
            <SidePanelContent
              lastMeta={lastMeta}
              pastSessions={pastSessions}
              sessionId={sessionId}
              onLoadSession={loadSession}
              onDeleteSession={deleteSession}
              onClearAll={clearAllHistory}
            />
          </div>
        </div>

        {/* ── Panel lateral — mobile drawer ──────────────────────────────── */}
        <AnimatePresence>
          {isSidePanelOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="drawer-backdrop xl:hidden"
                onClick={() => setIsSidePanelOpen(false)}
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 right-0 z-50 w-[85%] sm:w-80 bg-nexus-darker/95 border-l border-white/10 overflow-y-auto nexus-scrollbar backdrop-blur-3xl shadow-2xl"
              >
                <div className="flex flex-col gap-5 p-4 md:p-5 lg:p-6">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display font-bold text-[10px] text-nexus-cyan tracking-widest uppercase">Panel de Métricas</span>
                    <button onClick={() => setIsSidePanelOpen(false)} className="text-nexus-dim hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all p-1.5" aria-label="Cerrar panel">
                      <X size={16} />
                    </button>
                  </div>
                  <SidePanelContent
                    lastMeta={lastMeta}
                    pastSessions={pastSessions}
                    sessionId={sessionId}
                    onLoadSession={(id) => { loadSession(id); setIsSidePanelOpen(false) }}
                    onDeleteSession={deleteSession}
                    onClearAll={clearAllHistory}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  )
}

// ── Contenido compartido del panel lateral ─────────────────────────────────────
interface SidePanelContentProps {
  lastMeta: ChatResponse | null
  pastSessions: SessionHistoryItem[]
  sessionId: string
  onLoadSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onClearAll: () => void
}

function SidePanelContent({ lastMeta, pastSessions, sessionId, onLoadSession, onDeleteSession, onClearAll }: SidePanelContentProps) {
  return (
    <>
      {/* Historial de Chat */}
      <div className="nexus-panel p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-nexus-cyan" />
            <p className="font-display font-semibold text-[10px] text-white tracking-widest uppercase">Historial de Chat</p>
          </div>
          {pastSessions.length > 0 && (
            <button
              onClick={() => {
                if(window.confirm('¿Estás seguro de vaciar todo el historial de chat?')) onClearAll()
              }}
              className="text-nexus-danger hover:text-red-400 bg-nexus-danger/10 hover:bg-nexus-danger/20 p-1.5 rounded-lg transition-colors flex items-center justify-center"
              title="Vaciar todo el historial"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1.5 pr-1 max-h-[300px] overflow-y-auto nexus-scrollbar">
          <AnimatePresence>
            {pastSessions.length === 0 ? (
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="font-body text-[11px] text-nexus-dim text-center py-6"
              >
                No hay chats anteriores
              </motion.p>
            ) : (
              pastSessions.map(s => (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, x: -20 }}
                  className={`flex items-center justify-between rounded-xl border transition-all duration-300 group ${
                    s.id === sessionId ? 'bg-nexus-cyan/15 border-nexus-cyan/40 shadow-[0_0_15px_rgba(0,212,255,0.1)]' : 'bg-black/30 border-white/5 hover:bg-white/10 hover:border-white/10'
                  }`}
                >
                  <button
                    onClick={() => onLoadSession(s.id)}
                    className="flex-1 text-left px-3 py-2.5 flex flex-col gap-1 overflow-hidden"
                  >
                    <span className={`font-body text-xs truncate w-full ${s.id === sessionId ? 'text-white font-medium drop-shadow-[0_0_2px_#00d4ff]' : 'text-white/70'}`}>{s.title}</span>
                    <span className="font-mono text-[9px] text-nexus-dim">
                      {new Date(s.date).toLocaleDateString()} {new Date(s.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteSession(s.id)
                    }}
                    className="p-2.5 text-nexus-dim hover:text-nexus-danger opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                    title="Borrar chat"
                  >
                    <Trash2 size={12} />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      <div>
        <p className="font-display font-semibold text-[10px] text-white tracking-widest uppercase mb-4 px-1">Última Respuesta</p>
        {lastMeta ? (
          <div className="flex flex-col gap-3">
            <MetricCard label="Tokens" value={formatTokens(lastMeta.tokens_used)} color="#00d4ff" icon={<Hash size={12} />} />
            <MetricCard label="Costo" value={formatCost(lastMeta.cost_usd)} color="#00ffcc" icon={<DollarSign size={12} />} />
            <MetricCard label="Latencia" value={formatLatency(lastMeta.latency_ms)} color="#ff6b35" icon={<Zap size={12} />} />
            {lastMeta.hallucination_score != null && (
              <div className="nexus-panel p-4 mt-2">
                <ScoreBar label="Score de Alucinación" score={lastMeta.hallucination_score || 0} inverse={true} />
              </div>
            )}
          </div>
        ) : (
          <div className="nexus-panel p-4 text-center">
             <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-2">
               <Zap size={14} className="text-nexus-dim" />
             </div>
            <p className="text-nexus-dim font-body text-[11px]">Envía un mensaje para ver métricas telemetricas en vivo</p>
          </div>
        )}
      </div>

      <div className="nexus-panel p-4 shadow-lg">
        <p className="font-display font-semibold text-[10px] text-white tracking-widest uppercase mb-3">Herramientas Activas</p>
        <div className="grid grid-cols-2 gap-2">
          {['LangSmith', 'Helicone', 'W&B Weave', 'Phoenix'].map(t => (
            <div key={t} className="flex items-center gap-2 py-1.5 px-2 bg-black/30 rounded-lg border border-white/5">
              <span className="status-dot online" />
              <span className="font-body text-[10px] font-medium text-nexus-text truncate">{t}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="nexus-panel p-4 shadow-lg text-center">
        <p className="font-display font-semibold text-[10px] text-white tracking-widest uppercase mb-3">Modelo Backend</p>
        <Badge label="GROQ / LLAMA 3.1 8B" color="blue" />
        <p className="font-mono text-[9px] text-nexus-dim mt-3">Vía Groq API (Inferencia ultra-rápida)</p>
      </div>
    </>
  )
}
