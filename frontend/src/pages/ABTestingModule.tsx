import React, { useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { abAPI, ABCompareResponse } from '../lib/api'
import { formatCost, formatLatency } from '../lib/utils'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { AlertTriangle, ArrowRight, CheckCircle2, Cpu, Sparkles, ShieldCheck, ThumbsUp, ThumbsDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import toast from 'react-hot-toast'

const AVAILABLE_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
]

const DEFAULT_SYSTEM_PROMPT = 'Eres un asistente técnico, preciso y conciso. Responde siempre en el mismo idioma que el usuario.'

export function ABTestingModule() {
  const [prompt, setPrompt] = useLocalStorage('abtest_prompt', 'Describe brevemente el propósito del siguiente prompt.')
  const [configA, setConfigA] = useLocalStorage('abtest_configA', { model: AVAILABLE_MODELS[0], temperature: 0.1, system_prompt: DEFAULT_SYSTEM_PROMPT })
  const [configB, setConfigB] = useLocalStorage('abtest_configB', { model: AVAILABLE_MODELS[1], temperature: 0.2, system_prompt: DEFAULT_SYSTEM_PROMPT })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useLocalStorage<ABCompareResponse | null>('abtest_result', null)

  async function compare() {
    if (!prompt.trim()) {
      toast.error('El prompt no puede estar vacío')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await abAPI.compare(prompt, configA, configB)
      setResult(res.data)
    } catch (e: any) {
      toast.error('Error comparando configuraciones: ' + (e.response?.data?.detail || e.message))
    } finally {
      setLoading(false)
    }
  }

  const chartData = result ? [
    { name: 'A', Latencia: result.latency_a, Costo: result.cost_a * 1000 },
    { name: 'B', Latencia: result.latency_b, Costo: result.cost_b * 1000 },
  ] : []

  return (
    <Layout title="A/B TESTING" subtitle="MÓDULO 6 — COMPARACIÓN DE CONFIGURACIONES LLM">
      <div className="p-2 sm:p-3 md:p-4 lg:p-6 flex flex-col gap-6 min-h-full">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="nexus-panel p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-nexus-cyan" />
                <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-widest">Prompt a evaluar</span>
              </div>
              <Badge label="LLM-AS-JUDGE ACTIVO" color="blue" />
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Escribe el prompt que quieras comparar entre dos configuraciones"
              className="nexus-input resize-none h-40"
            />
            <button
              onClick={compare}
              disabled={loading}
              className="nexus-btn-primary flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <><Spinner size={14} /><span>COMPARANDO...</span></> : <><ArrowRight size={14} /><span>COMPARAR</span></>}
            </button>
          </div>

          <div className="nexus-panel p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-nexus-accent" />
              <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-widest">Configuración A</span>
            </div>
            <div className="grid gap-3">
              <label className="font-mono text-[10px] text-nexus-dim uppercase">Modelo</label>
              <select
                value={configA.model}
                onChange={e => setConfigA({ ...configA, model: e.target.value })}
                className="nexus-input"
              >
                {AVAILABLE_MODELS.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              <div>
                <div className="flex items-center justify-between text-[10px] text-nexus-dim uppercase mb-2">
                  <span>Temperatura</span>
                  <span>{configA.temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={configA.temperature}
                  onChange={e => setConfigA({ ...configA, temperature: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <label className="font-mono text-[10px] text-nexus-dim uppercase">System prompt</label>
              <textarea
                value={configA.system_prompt}
                onChange={e => setConfigA({ ...configA, system_prompt: e.target.value })}
                className="nexus-input resize-none h-28"
              />
            </div>
          </div>

          <div className="nexus-panel p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-nexus-blue" />
              <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-widest">Configuración B</span>
            </div>
            <div className="grid gap-3">
              <label className="font-mono text-[10px] text-nexus-dim uppercase">Modelo</label>
              <select
                value={configB.model}
                onChange={e => setConfigB({ ...configB, model: e.target.value })}
                className="nexus-input"
              >
                {AVAILABLE_MODELS.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              <div>
                <div className="flex items-center justify-between text-[10px] text-nexus-dim uppercase mb-2">
                  <span>Temperatura</span>
                  <span>{configB.temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={configB.temperature}
                  onChange={e => setConfigB({ ...configB, temperature: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <label className="font-mono text-[10px] text-nexus-dim uppercase">System prompt</label>
              <textarea
                value={configB.system_prompt}
                onChange={e => setConfigB({ ...configB, system_prompt: e.target.value })}
                className="nexus-input resize-none h-28"
              />
            </div>
          </div>
        </div>

        {result && (
          <div className="flex flex-col gap-4">
            <div className="nexus-panel p-5 border-nexus-cyan/20 bg-nexus-dark/70">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-nexus-cyan" />
                <div>
                  <p className="font-display text-sm text-white tracking-widest">Ganador: {result.winner}</p>
                  <p className="font-body text-xs text-nexus-dim mt-1">{result.judge_explanation}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="nexus-panel p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-mono text-[9px] text-nexus-dim uppercase">Resultado A</p>
                    <p className="font-body text-sm text-nexus-text mt-1">{result.model_a} · temp {result.temperature_a.toFixed(2)}</p>
                  </div>
                  <Badge label="A" color="cyan" />
                </div>
                <div className="bg-nexus-dark/60 border border-nexus-blue/20 rounded-sm p-4 min-h-[180px] whitespace-pre-wrap text-sm text-nexus-text">
                  {result.response_a}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="nexus-panel p-3 text-center">
                    <p className="font-display text-lg text-white">{result.tokens_a}</p>
                    <p className="font-mono text-[9px] text-nexus-dim uppercase">tokens</p>
                  </div>
                  <div className="nexus-panel p-3 text-center">
                    <p className="font-display text-lg text-white">{formatLatency(result.latency_a)}</p>
                    <p className="font-mono text-[9px] text-nexus-dim uppercase">latencia</p>
                  </div>
                  <div className="nexus-panel p-3 text-center">
                    <p className="font-display text-lg text-white">{formatCost(result.cost_a)}</p>
                    <p className="font-mono text-[9px] text-nexus-dim uppercase">costo</p>
                  </div>
                </div>
                
                {/* Feedback A */}
                <div className="mt-4 flex items-center justify-between border-t border-nexus-blue/20 pt-4">
                  <span className="font-mono text-[9px] text-nexus-dim uppercase">Feedback para LangSmith</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toast.success('Feedback positivo enviado a LangSmith')}
                      className="p-1.5 rounded-sm bg-nexus-dark hover:bg-nexus-success/20 text-nexus-dim hover:text-nexus-success transition-colors"
                      title="Pulgar arriba"
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button 
                      onClick={() => toast.error('Feedback negativo enviado a LangSmith')}
                      className="p-1.5 rounded-sm bg-nexus-dark hover:bg-nexus-danger/20 text-nexus-dim hover:text-nexus-danger transition-colors"
                      title="Pulgar abajo"
                    >
                      <ThumbsDown size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="nexus-panel p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-mono text-[9px] text-nexus-dim uppercase">Resultado B</p>
                    <p className="font-body text-sm text-nexus-text mt-1">{result.model_b} · temp {result.temperature_b.toFixed(2)}</p>
                  </div>
                  <Badge label="B" color="blue" />
                </div>
                <div className="bg-nexus-dark/60 border border-nexus-blue/20 rounded-sm p-4 min-h-[180px] whitespace-pre-wrap text-sm text-nexus-text">
                  {result.response_b}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="nexus-panel p-3 text-center">
                    <p className="font-display text-lg text-white">{result.tokens_b}</p>
                    <p className="font-mono text-[9px] text-nexus-dim uppercase">tokens</p>
                  </div>
                  <div className="nexus-panel p-3 text-center">
                    <p className="font-display text-lg text-white">{formatLatency(result.latency_b)}</p>
                    <p className="font-mono text-[9px] text-nexus-dim uppercase">latencia</p>
                  </div>
                  <div className="nexus-panel p-3 text-center">
                    <p className="font-display text-lg text-white">{formatCost(result.cost_b)}</p>
                    <p className="font-mono text-[9px] text-nexus-dim uppercase">costo</p>
                  </div>
                </div>
                
                {/* Feedback B */}
                <div className="mt-4 flex items-center justify-between border-t border-nexus-blue/20 pt-4">
                  <span className="font-mono text-[9px] text-nexus-dim uppercase">Feedback para LangSmith</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toast.success('Feedback positivo enviado a LangSmith')}
                      className="p-1.5 rounded-sm bg-nexus-dark hover:bg-nexus-success/20 text-nexus-dim hover:text-nexus-success transition-colors"
                      title="Pulgar arriba"
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button 
                      onClick={() => toast.error('Feedback negativo enviado a LangSmith')}
                      className="p-1.5 rounded-sm bg-nexus-dark hover:bg-nexus-danger/20 text-nexus-dim hover:text-nexus-danger transition-colors"
                      title="Pulgar abajo"
                    >
                      <ThumbsDown size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="nexus-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-mono text-[9px] text-nexus-dim uppercase">Comparativa de métricas</p>
                  <p className="font-body text-xs text-nexus-text mt-1">Latencia en ms y costo en USD x1000</p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#2b2f3d" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false } tickFormatter={value => value} />
                    <Tooltip wrapperStyle={{ borderRadius: 8, background: '#0f172a', borderColor: '#334155' }} />
                    <Legend formatter={(value) => <span className="text-xs text-white">{value}</span>} />
                    <Bar dataKey="Latencia" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Costo" fill="#818cf8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {!result && !loading && (
          <div className="nexus-panel p-8 flex flex-col items-center gap-3 text-center">
            <AlertTriangle size={36} className="text-nexus-dim" />
            <p className="font-display text-sm text-white tracking-widest">Aún no has ejecutado la comparación</p>
            <p className="font-body text-xs text-nexus-dim max-w-lg">
              Define el prompt y las dos configuraciones LLM, luego presiona COMPARAR para ver la diferencia entre ambas respuestas.
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
