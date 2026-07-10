import React, { useEffect, useState } from 'react'
import { Activity, DollarSign, Cpu, TrendingUp, Database, Save } from 'lucide-react'
import { api, adminAPI, AdminDashboardData } from '../lib/api'
import { Layout } from '../components/layout/Layout'
import { MetricCard } from '../components/ui/MetricCard'
import { FlipMetricCard } from '../components/ui/FlipMetricCard'
import { Spinner } from '../components/ui/Spinner'
import { useMetrics, useCostHistory } from '../hooks/useMetrics'
import toast from 'react-hot-toast'

export function FinOpsModule() {
  const { metrics, loading: loadingMetrics } = useMetrics(false)
  const { data: costHistory } = useCostHistory(false)
  
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null)
  const [loadingAdmin, setLoadingAdmin] = useState(true)
  const [error, setError] = useState('')

  // Estados de presupuesto
  const [newBudgetCop, setNewBudgetCop] = useState('')
  const [newTrm, setNewTrm] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)

  const fetchFinopsData = async () => {
    try {
      const adminRes = await adminAPI.getDashboard()
      setAdminData(adminRes.data)
      
      if (adminRes.data) {
        setNewBudgetCop(adminRes.data.budget_cop.toString())
        setNewTrm(adminRes.data.trm_usd_cop.toString())
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error cargando datos de FinOps')
    } finally {
      setLoadingAdmin(false)
    }
  }

  useEffect(() => {
    fetchFinopsData()
  }, [])

  // Formatea un número con puntos como separadores de miles
  const formatCOP = (raw: string) => {
    const digits = raw.replace(/\./g, '')
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  const updateBudget = async () => {
    const cop = parseInt(newBudgetCop.replace(/\D/g, '') || '0')
    if (cop <= 0) { toast.error('Ingresa un presupuesto válido'); return }
    setSavingBudget(true)
    try {
      await adminAPI.updateSettings(cop, parseFloat(newTrm) || undefined)
      toast.success('Presupuesto actualizado exitosamente')
      fetchFinopsData()
    } catch (err: any) {
      toast.error('Error al actualizar el presupuesto')
    } finally {
      setSavingBudget(false)
    }
  }

  // Computed: tokens comprables con el presupuesto actual en el input
  const previewTokens = (() => {
    const b = parseInt(newBudgetCop.replace(/\./g, '') || '0')
    const t = parseFloat(newTrm || String(adminData?.trm_usd_cop || 4200))
    const c = adminData?.groq_cost_per_million || 0.69
    if (!b || !t || !c) return 0
    return Math.floor((b / t / c) * 1_000_000)
  })()

  if (loadingMetrics || loadingAdmin) {
    return (
      <Layout title="FinOps & Economía de IA" subtitle="Cargando métricas...">
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <Spinner />
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout title="FinOps" subtitle="Error">
        <div className="p-8 text-nexus-danger flex items-center gap-3">
          <Activity size={24} />
          {error}
        </div>
      </Layout>
    )
  }

  // Valores convertidos USD -> COP usando TRM guardada
  const trm = adminData?.trm_usd_cop || 4200
  const costUsd = metrics?.total_cost_usd || 0
  const costCop = costUsd * trm
  
  const budgetUsd = (adminData?.budget_cop || 0) / trm
  const percentUsed = budgetUsd > 0 ? (costUsd / budgetUsd) * 100 : 0

  return (
    <Layout title="FinOps & Economía de IA" subtitle="Control de Presupuesto y Enrutamiento" noPadding>
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-fade-in z-10 relative">


        {/* Panel de Presupuesto visible al tope (ancho completo) */}
        <div className="nexus-panel p-6 rounded-3xl animate-fade-in-up-delay-2 mb-8 w-full">
          <h3 className="font-display font-bold text-sm tracking-widest text-white/90 uppercase mb-4 flex items-center gap-2">
            <Database size={18} className="text-nexus-warn" />
            Presupuesto Corporativo
          </h3>
          <p className="text-xs text-nexus-dim mb-4">
            El sistema consulta diariamente la TRM del dólar y los precios de tokens de diferentes proveedores (OpenAI, Anthropic, Google Cloud y Groq) para calcular tu capacidad de consumo real.
          </p>

          {adminData && (
            <div className="flex flex-col xl:flex-row gap-6 items-center">
              <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-nexus-dim uppercase tracking-widest font-mono mb-2 block">Presupuesto en Pesos (COP)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-warn font-bold text-lg">$</span>
                    <input
                      type="text"
                      value={formatCOP(newBudgetCop)}
                      onChange={e => setNewBudgetCop(e.target.value.replace(/[^0-9]/g, ''))}
                      className="nexus-input w-full pl-8 text-lg tracking-wider"
                      placeholder="500.000"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-nexus-dim uppercase tracking-widest font-mono mb-2 block">TRM Hoy (COP/USD)</label>
                  <input
                    type="text"
                    value={formatCOP(newTrm)}
                    onChange={e => setNewTrm(e.target.value.replace(/[^0-9]/g, ''))}
                    className="nexus-input w-full tracking-wider opacity-80"
                    placeholder="4.200"
                    readOnly
                    title="La TRM se actualiza automáticamente desde internet"
                  />
                </div>
              </div>

              <div className="flex-1 w-full bg-black/40 border border-white/5 rounded-xl p-4">
                <h4 className="text-[10px] text-nexus-dim uppercase tracking-widest font-mono border-b border-white/5 pb-2 mb-3">Precios Actualizados (Dólares / 1M Tokens)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-white/5">
                    <div className="text-nexus-cyan font-bold">${adminData.groq_cost_per_million} <span className="text-[9px] opacity-70 font-normal">USD</span></div>
                    <div className="text-[9px] text-nexus-dim mt-1 uppercase">Groq</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <div className="text-purple-400 font-bold">${adminData.anthropic_cost_per_million} <span className="text-[9px] opacity-70 font-normal">USD</span></div>
                    <div className="text-[9px] text-nexus-dim mt-1 uppercase">Anthropic</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <div className="text-green-400 font-bold">${adminData.openai_cost_per_million} <span className="text-[9px] opacity-70 font-normal">USD</span></div>
                    <div className="text-[9px] text-nexus-dim mt-1 uppercase">OpenAI</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <div className="text-blue-400 font-bold">${adminData.google_cost_per_million} <span className="text-[9px] opacity-70 font-normal">USD</span></div>
                    <div className="text-[9px] text-nexus-dim mt-1 uppercase">Google</div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-3 w-full xl:w-64">
                {parseInt(newBudgetCop || '0') > 0 && (
                  <div className="p-2 bg-nexus-warn/5 border border-nexus-warn/20 rounded-xl text-center">
                    <span className="text-[10px] text-nexus-dim block">Límite Estimado (Groq)</span>
                    <span className="text-nexus-warn font-bold font-mono text-sm">≈ {previewTokens.toLocaleString()} tokens</span>
                  </div>
                )}
                <button onClick={updateBudget} disabled={savingBudget} className="nexus-btn-primary w-full flex items-center justify-center gap-2">
                  {savingBudget ? <Spinner size={16} /> : <Save size={16} />}
                  APLICAR
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tarjetas de Métricas (ancho completo) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <FlipMetricCard
            labelFront="Costo Total (COP)"
            valueFront={`$${costCop.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}
            subFront={`TRM: $${trm.toLocaleString()} COP`}
            labelBack="Costo Total (USD)"
            valueBack={`$${costUsd.toFixed(4)}`}
            subBack="Equivalente en dólares"
            icon={<DollarSign size={16} />}
            color="#00d4ff"
          />
          <MetricCard
            label="Tokens Consumidos"
            value={metrics?.total_tokens?.toLocaleString() || '0'}
            icon={<Cpu size={16} />}
            color="#00e676"
          />
          <MetricCard
            label="Eficiencia Híbrida"
            value="~80%"
            icon={<TrendingUp size={16} />}
            sub="Ahorro estimado (8b vs 70b)"
            color="#00e676"
          />
          <FlipMetricCard
            labelFront="Restante (COP)"
            valueFront={`$${((adminData?.budget_cop || 0) - costCop).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}
            subFront={`${percentUsed.toFixed(1)}% utilizado`}
            labelBack="Restante (USD)"
            valueBack={`$${(budgetUsd - costUsd).toFixed(2)}`}
            subBack={`${percentUsed.toFixed(1)}% utilizado`}
            icon={<Activity size={16} />}
            color={percentUsed > 80 ? "#ff2d55" : "#ffb74d"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            {/* Gráfica de Costos */}
            <div className="nexus-panel p-6 rounded-3xl animate-fade-in-up-delay-3 h-full max-h-[300px] overflow-y-auto nexus-scrollbar">
              <h3 className="font-display font-bold text-sm tracking-widest text-white/90 uppercase mb-4 flex items-center gap-2">
                <Activity size={18} className="text-nexus-cyan" />
                Historial de Consumo (COP)
              </h3>
              <div className="space-y-3">
                {costHistory.slice(0, 10).map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-nexus-cyan shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
                      <div>
                        <div className="font-mono text-xs">{new Date(item.timestamp).toLocaleString()}</div>
                        <div className="text-[10px] text-nexus-dim font-display uppercase">{item.module}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-nexus-success">${(item.cost_usd * trm).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
                      <div className="text-[10px] text-nexus-dim">{item.tokens} tokens</div>
                    </div>
                  </div>
                ))}
                {costHistory.length === 0 && (
                  <div className="text-center text-nexus-dim p-4">No hay datos de consumo registrados aún.</div>
                )}
              </div>
            </div>
          </div>
      </main>
    </Layout>
  )
}
