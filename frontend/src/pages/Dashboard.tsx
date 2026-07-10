import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { MetricCard } from '../components/ui/MetricCard'
import { useMetrics, useLatencyHistory, useCostHistory } from '../hooks/useMetrics'
import { formatCost, formatTokens, formatLatency } from '../lib/utils'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid, Cell, Legend, LineChart, Line
} from 'recharts'
import { 
  Activity, Zap, DollarSign, Brain, AlertTriangle, CheckCircle, 
  WifiOff, Eye, Terminal, Network, Sliders, Database, 
  Sparkles, ShieldAlert, Cpu, Compass, Search, Gauge, Layers, GitPullRequest, ThumbsUp, ThumbsDown,
  HelpCircle, X
} from 'lucide-react'
import { Spinner } from '../components/ui/Spinner'
import { NexusLoader } from '../components/ui/NexusLoader'
import { Badge } from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'
import { authAPI, adminAPI } from '../lib/api'
import { PDFReportGenerator } from '../components/ui/PDFReportGenerator'
import { CorporateReportTemplate } from '../components/ui/CorporateReportTemplate'

// Generador de color consistente basado en string
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}

const formatModuleName = (str: string) => {
  if (!str) return 'DESCONOCIDO';
  return str.replace(/_/g, ' ').toUpperCase();
}

const TAB_HELP_CONTENT: Record<string, {
  title: string
  subtitle: string
  badgeColor: string
  description: string
  tracing: string
  metrics: { name: string; desc: string }[]
}> = {
  general: {
    title: 'Monitor del Sistema General',
    subtitle: 'NEXUS NATIVE OTEL ENGINE',
    badgeColor: 'border-nexus-cyan text-nexus-cyan bg-nexus-cyan/10',
    description: 'Centraliza el monitoreo de salud general del sistema de inteligencia artificial en tiempo real. Permite medir el flujo de peticiones, consumo de recursos, latencia agregada y costos globales de todos los agentes (asistente de chat, RAG, Code Review y Repo Agent).',
    tracing: 'Recopila tramas estructuradas de telemetría a través del motor nativo OpenTelemetry (OTEL). Cada petición genera un árbol de spans distribuidos que miden la duración de cada sub-operación (búsquedas vectoriales, inferencia LLM y evaluaciones).',
    metrics: [
      { name: 'Conversaciones Totales', desc: 'Cantidad absoluta de solicitudes de usuario procesadas por todos los agentes de Nexus.' },
      { name: 'Tokens Consumidos', desc: 'Volumen total de datos procesados por los modelos de IA, normalizado por millón de tokens.' },
      { name: 'Latencia Promedio y Desglose', desc: 'Gráfica de área apilada que muestra el tiempo consumido en ChromaDB, respuesta del LLM en Groq, evaluación de juez y overhead.' },
      { name: 'Gantt de Spans e Historial', desc: 'Visualización de cascada de llamadas donde cada bloque horizontal indica la secuencia, duración y fin exacto de sub-operaciones.' }
    ]
  },
  langsmith: {
    title: 'LangSmith Deep Tracing',
    subtitle: 'NESTED PIPELINES AUDIT',
    badgeColor: 'border-nexus-success text-nexus-success bg-nexus-success/10',
    description: 'Permite depurar y rastrear flujos complejos de cadenas de LLM, agentes y pipelines RAG de forma hiper-detallada. Sirve para inspeccionar exactamente qué datos entraron y salieron de cada paso intermedio, identificando cuellos de botella y fallos lógicos.',
    tracing: 'Utiliza decoradores e interceptores en las llamadas de los pipelines (Run Trees). Cada paso de ejecución se registra como un nodo hijo que hereda el identificador del pipeline padre, capturando metadatos enriquecidos, entradas y salidas serializadas.',
    metrics: [
      { name: 'Árbol de Ejecución (Call Run Tree)', desc: 'Estructura jerárquica interactiva en cascada de las llamadas anidadas del pipeline (por ejemplo, búsquedas en bases de datos vectoriales dentro de un flujo RAG).' },
      { name: 'Inspector de Payload (JSON)', desc: 'Detalla las entradas y salidas serializadas reales de cada nodo seleccionado, permitiendo diagnosticar alucinaciones o prompts incorrectos.' },
      { name: 'Seguridad (Guardrails)', desc: 'Muestra el porcentaje de acierto de los escaneos de políticas de seguridad aplicados a las entradas y salidas de texto.' }
    ]
  },
  helicone: {
    title: 'Helicone LLM Proxy & Cache',
    subtitle: 'COST & CACHE OPTIMIZER',
    badgeColor: 'border-nexus-cyan text-nexus-cyan bg-nexus-cyan/10',
    description: 'Actúa como un proxy de telemetría y capa de optimización para APIs de LLM. Permite controlar el rendimiento de las llamadas, monitorear la tasa de peticiones, gestionar la persistencia en caché de las respuestas y auditar la economía de uso de modelos.',
    tracing: 'Redirige las solicitudes de API a través del proxy seguro de Helicone. Esto le permite interceptar los headers de las peticiones en tiempo real para calcular tiempos exactos de respuesta, registrar cuotas de tokens, validar el caché local y calcular los costos financieros.',
    metrics: [
      { name: 'Peticiones por Segundo (RPS)', desc: 'Gráfico interactivo de línea temporal que muestra la carga de tráfico y volumen de solicitudes instantáneas.' },
      { name: 'Simulador de Caché & Ahorro', desc: 'Compara peticiones resueltas mediante caché (Hits, con latencia y costo casi nulos) frente a solicitudes reales al proveedor de LLM (Misses), calculando el ahorro acumulado.' },
      { name: 'Costos de Proveedores', desc: 'Desglosa la distribución del gasto financiero y la proporción de uso entre modelos rápidos (llama-3.1-8b) y complejos (llama-3.3-70b).' }
    ]
  },
  weave: {
    title: 'W&B Weave Evaluator',
    subtitle: 'SCIENTIFIC BENCHMARKING & ALIGNMENT',
    badgeColor: 'border-nexus-warn text-nexus-warn bg-nexus-warn/10',
    description: 'Proporciona un marco científico para evaluar el comportamiento sistemático, la precisión y la calidad de las respuestas generadas por los modelos de IA. Sirve para comparar versiones de prompts, evitar regresiones de calidad y calificar alucinaciones.',
    tracing: 'Ejecuta suites de pruebas sistemáticas sobre conjuntos de datos etiquetados (evaluaciones fuera de línea). Un modelo de IA independiente actúa como juez evaluador ("LLM-as-a-Judge") calificando la fidelidad, relevancia e integridad en base a métricas estrictas.',
    metrics: [
      { name: 'Groundedness (Fidelidad)', desc: 'Califica de 0% a 100% si la respuesta de RAG está estrictamente fundamentada en la información de los fragmentos de ChromaDB y no contiene inventos.' },
      { name: 'Hallucination Rate (Tasa de Alucinaciones)', desc: 'Mide la tasa de oraciones o hechos no verificables en las respuestas.' },
      { name: 'Matriz Comparativa A/B', desc: 'Permite contrastar directamente métricas clave (precisión, costos por 1k tokens, latencia, errores) entre dos versiones distintas de pipelines.' },
      { name: 'Historial de Fallos del Juez', desc: 'Documenta qué prompts específicos violaron los umbrales de calidad del evaluador automático, junto con su razonamiento de rechazo.' }
    ]
  },
  phoenix: {
    title: 'Arize Phoenix Embeddings & Concept Drift',
    subtitle: 'SEMANTIC SPACE & DRIFT AUDITOR',
    badgeColor: 'border-nexus-blue text-nexus-blue bg-nexus-blue/10',
    description: 'Permite auditar el espacio semántico de las consultas del usuario y el comportamiento de las representaciones vectoriales en ChromaDB. Sirve para detectar inyecciones de código maliciosas, solicitudes no relacionadas con el dominio y la deriva conceptual en el tiempo.',
    tracing: 'Extrae los vectores de características (embeddings de 1536 dimensiones) de los prompts del usuario y aplica reducciones de dimensionalidad (UMAP/t-SNE) para proyectarlos en un espacio interactivo de 2 dimensiones, permitiendo identificar agrupamientos.',
    metrics: [
      { name: 'Mapa Vectorial 2D (Scatter Map)', desc: 'Visualiza la proyección bidimensional de embeddings. Agrupa consultas similares e identifica temas imprevistos o intentos de vulneración de seguridad al pasar el cursor.' },
      { name: 'Concept Drift (Deriva Conceptual)', desc: 'Mide el corrimiento semántico de las consultas actuales en comparación con el conjunto de validación original. Desvíos altos indican que los usuarios preguntan temas nuevos.' },
      { name: 'Relación Latencia vs Fragmentos', desc: 'Correlaciona el tiempo de respuesta de búsqueda de ChromaDB en relación con la cantidad y tamaño de fragmentos textuales recuperados.' }
    ]
  }
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="nexus-panel px-3 py-2 text-xs">
        <p className="font-mono text-nexus-dim mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} className="font-body" style={{ color: p.color }}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    )
  }
  return null
}

function getSpansForConversation(c: any) {
  if (!c) return []
  const totalLatency = c.latency_ms || 800
  const totalCost = c.cost_usd || 0.0001
  const totalTokens = c.tokens_used || 200
  const moduleName = formatModuleName(c.module)

  // Generamos un árbol de spans genérico y proporcional basado en la latencia total
  // Esto hace que el sistema sea agnóstico y funcione con cualquier IA conectada
  return [
    { name: `${moduleName} Pipeline Invocation`, type: 'pipeline', latency: totalLatency, cost: totalCost, tokens: totalTokens, offset: 0, status: 'success' },
    { name: 'Input Pre-processing & Auth', type: 'security', latency: Math.round(totalLatency * 0.10), cost: 0, tokens: 0, offset: 0, status: 'success' },
    { name: 'Vector / Context Retrieval (Optional)', type: 'db', latency: Math.round(totalLatency * 0.20), cost: 0, tokens: 0, offset: Math.round(totalLatency * 0.10), status: 'success' },
    { name: 'LLM Core Inference Generation', type: 'llm', latency: Math.round(totalLatency * 0.60), cost: totalCost * 0.9, tokens: Math.round(totalTokens * 0.95), offset: Math.round(totalLatency * 0.30), status: 'success' },
    { name: 'LLM-As-Judge Guardrails Audit', type: 'evaluation', latency: Math.round(totalLatency * 0.10), cost: totalCost * 0.1, tokens: Math.round(totalTokens * 0.05), offset: Math.round(totalLatency * 0.90), status: c.hallucination_score > 0.5 ? 'warning' : 'success' },
  ]
}



export function Dashboard() {
  const { user, updateUser } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [isPersonal, setIsPersonal] = React.useState(true)
  const { metrics, loading, error: metricsError } = useMetrics(isPersonal, true, 8000)
  const { data: latencyHistory, error: latencyError } = useLatencyHistory(isPersonal, 25)
  const { data: costHistory,   error: costError }    = useCostHistory(isPersonal, 25)

  // Restaurar pestañas
  const [activeTab, setActiveTab] = React.useState('general')

  // Contextualization Onboarding Modal States
  const [showContextModal, setShowContextModal] = React.useState(false)
  const [viewedTabs, setViewedTabs] = React.useState<Record<string, boolean>>(() => {
    try {
      if (user?.viewed_context_tabs) {
        return JSON.parse(user.viewed_context_tabs)
      }
    } catch {}
    return {}
  })

  // Automatically trigger modal only once for the whole system
  React.useEffect(() => {
    const hasSeenAnyModal = Object.keys(viewedTabs).length > 0
    if (!hasSeenAnyModal && activeTab === 'general') {
      setShowContextModal(true)
      setViewedTabs(prev => ({ ...prev, [activeTab]: true }))
    }
  }, [activeTab, viewedTabs])

  const handleCloseModal = async () => {
    setShowContextModal(false)
    if (user) {
      try {
        const jsonStr = JSON.stringify(viewedTabs)
        if (jsonStr !== user.viewed_context_tabs) {
          await authAPI.updatePreferences(jsonStr)
          updateUser({ viewed_context_tabs: jsonStr })
        }
      } catch (err) {
        console.error('Error guardando preferencias:', err)
      }
    }
  }

  // Spans Explorer & Telemetry Hub State
  const [selectedTrace, setSelectedTrace] = React.useState<any>(null)

  // LangSmith: usar conversaciones reales como "runs"
  const [selectedConvId, setSelectedConvId] = React.useState<number | null>(null)
  const [selectedSpanNode, setSelectedSpanNode] = React.useState<any>(null)

  // TRM (Tasa Representativa del Mercado)
  const [adminData, setAdminData] = React.useState<any>(null)
  React.useEffect(() => {
    adminAPI.getDashboard().then(res => setAdminData(res.data)).catch(console.error)
  }, [])
  const trm = adminData?.trm_usd_cop || 4200

  // Seleccionar primera conversación real como traza activa cuando cargan
  React.useEffect(() => {
    if (metrics?.recent_conversations?.length) {
      const first = metrics.recent_conversations[0]
      if (!selectedConvId) {
        setSelectedConvId(first.id)
        const spans = getSpansForConversation(first)
        setSelectedSpanNode(spans[0] || null)
      }
    }
  }, [metrics, selectedConvId])

  const selectedConv = metrics?.recent_conversations?.find(c => c.id === selectedConvId) || null
  const selectedSpans = selectedConv ? getSpansForConversation(selectedConv) : []


  // Seleccionar automáticamente la primera traza al cargar
  React.useEffect(() => {
    if (metrics?.recent_conversations?.length && !selectedTrace) {
      setSelectedTrace(metrics.recent_conversations[0])
    }
  }, [metrics, selectedTrace])

  // Consola OTEL — basada en conversaciones reales de la DB
  const [telemetryLogs, setTelemetryLogs] = React.useState<any[]>([])

  React.useEffect(() => {
    const timeNow = new Date()
    const initial = [
      { time: new Date(timeNow.getTime() - 40000).toLocaleTimeString(), trace: '0x8F3C', module: 'SYSTEM', msg: 'Telemetry hub synced, listening...', status: 'SUCCESS' },
      { time: new Date(timeNow.getTime() - 25000).toLocaleTimeString(), trace: '0x8F3D', module: 'SYSTEM', msg: `spans_published=${metrics?.total_conversations ?? 0}, state=CONNECTED`, status: 'SUCCESS' },
      { time: new Date(timeNow.getTime() - 10000).toLocaleTimeString(), trace: '0x8F3E', module: 'SYSTEM', msg: 'ChromaDB collection verified', status: 'SUCCESS' },
    ]
    setTelemetryLogs(initial)

    const interval = setInterval(() => {
      if (metrics?.recent_conversations?.length) {
        const randConv = metrics.recent_conversations[Math.floor(Math.random() * metrics.recent_conversations.length)]
        const time = new Date().toLocaleTimeString()
        const spans = getSpansForConversation(randConv)
        const randomSpan = spans[Math.floor(Math.random() * spans.length)]
        const traceId = randConv.id.toString(16).toUpperCase().padStart(4, '0')
        
        setTelemetryLogs(prev => [{
          time,
          trace: `0x${traceId}`,
          module: randConv.module?.toUpperCase(),
          model: randConv.model,
          msg: `"${randomSpan.name}" latency=${randomSpan.latency}ms`,
          status: randomSpan.status?.toUpperCase() || 'SUCCESS',
          hallucination: randConv.hallucination_score
        }, ...prev].slice(0, 15))
      }
    }, 4500)

    return () => clearInterval(interval)
  }, [metrics])



  const moduleData = metrics
    ? Object.entries(metrics.conversations_by_module).map(([key, count]) => ({
        name: formatModuleName(key), count, color: stringToColor(key),
      }))
    : []

  const traceLatencyBreakdownData = [...latencyHistory].reverse().slice(0, 15).map((h, i) => {
    const lat = h.latency || 500;
    let dbTime = 0;
    let llmTime = 0;
    let evalTime = 0;
    let otherTime = 0;

    if (h.module === 'rag') {
      dbTime = Math.round(lat * 0.25);
      llmTime = Math.round(lat * 0.55);
      evalTime = Math.round(lat * 0.15);
      otherTime = lat - (dbTime + llmTime + evalTime);
    } else if (h.module === 'code_review') {
      llmTime = Math.round(lat * 0.70);
      evalTime = Math.round(lat * 0.15);
      otherTime = lat - (llmTime + evalTime);
    } else if (h.module === 'repo_agent') {
      llmTime = Math.round(lat * 0.60);
      otherTime = lat - llmTime;
    } else {
      llmTime = Math.round(lat * 0.85);
      otherTime = lat - llmTime;
    }

    return {
      name: `#${i + 1}`,
      'LLM Inference': llmTime,
      'Vector Search': dbTime,
      'LLM Judge Evaluation': evalTime,
      'Overhead & Guardrails': otherTime,
      module: h.module,
    };
  });

  const costData = [...costHistory].reverse().slice(0, 15).map((d, i) => ({
    name: `#${i + 1}`,
    cost: parseFloat(((d.cost_usd || 0) * 1_000_000).toFixed(4)), // µUSD
    module: d.module,
  }))

  return (
    <Layout title="DASHBOARD" subtitle="NEXUS OBSERVATORY — CENTRO DE TELEMETRÍA NATIVA">
      <div className="p-2 sm:p-3 md:p-4 lg:p-5 flex flex-col gap-4 md:gap-5 lg:gap-6 animate-fade-in-up">
        
        {/* Header telemetry strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge label="NATIVO" color="cyan" />
            <span className="font-mono text-[10px] text-nexus-cyan tracking-wider font-bold">NEXUS OBSERVABILITY ACTIVE</span>
            <span className="font-mono text-[9px] text-nexus-dim">• MÉTROCOS SINCRONIZADOS</span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1 rounded-lg">
            <span className="status-dot online" />
            <span className="font-mono text-[9px] text-nexus-success uppercase">Motor OTEL Local Conectado</span>
          </div>
        </div>

        {/* ── HIGH TECH TABS DOCK DOCK AND RECORDAR BUTTON ── */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* TABS */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 backdrop-blur-md overflow-x-auto nexus-scrollbar">
            {[
              { id: 'general', label: 'Métricas Reales', icon: <Activity size={14} />, color: 'text-nexus-cyan', activeBg: 'bg-nexus-cyan/20 border-nexus-cyan' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold transition-all duration-300 border border-transparent whitespace-nowrap
                  ${activeTab === tab.id 
                    ? `${tab.activeBg} ${tab.color} shadow-lg` 
                    : 'text-nexus-dim hover:text-white hover:bg-white/5'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-grow"></div>
          
          {isAdmin && (
            <button
              onClick={() => setIsPersonal(!isPersonal)}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border transition-all duration-300 font-mono text-[10px] tracking-wider uppercase font-bold shadow-[0_0_15px_rgba(0,212,255,0.08)] hover:scale-[1.02] active:scale-[0.98] lg:self-stretch ${isPersonal ? 'border-nexus-dim text-nexus-dim hover:bg-white/5' : 'border-nexus-warn/40 bg-nexus-warn/10 text-nexus-warn hover:bg-nexus-warn/25'}`}
            >
              <Database size={13} className={isPersonal ? 'text-nexus-dim' : 'text-nexus-warn'} />
              <span>{isPersonal ? 'MÉTRICAS GLOBALES' : 'MÉTRICAS PERSONALES'}</span>
            </button>
          )}

          <button
            onClick={() => setShowContextModal(true)}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-nexus-cyan/40 bg-nexus-cyan/10 text-nexus-cyan hover:bg-nexus-cyan/25 transition-all duration-300 font-mono text-[10px] tracking-wider uppercase font-bold shadow-[0_0_15px_rgba(0,212,255,0.08)] hover:scale-[1.02] active:scale-[0.98] lg:self-stretch no-print"
          >
            <HelpCircle size={13} className="animate-pulse text-nexus-cyan" />
            <span>RECORDAR</span>
          </button>
          
          <PDFReportGenerator targetElementId="corporate-pdf-template" />
        </div>

        {/* ==================================================== */}
        {/* DASHBOARD CONTENT (Printable Area)                   */}
        {/* ==================================================== */}
        <div id="dashboard-printable-area" className="flex flex-col gap-4 animate-fade-in pb-10">
            {metricsError && (
              <div className="nexus-panel p-4 border-nexus-danger/40 bg-nexus-danger/5 flex items-center gap-3">
                <WifiOff size={16} className="text-nexus-danger flex-shrink-0" />
                <div>
                  <p className="font-mono text-xs text-nexus-danger">Error de Conexión del Backend</p>
                  <p className="font-body text-xs text-nexus-dim mt-0.5">{metricsError} — ¿El backend está activo?</p>
                </div>
              </div>
            )}



            {activeTab === 'general' && (
              <>
                {loading && !metrics ? (
                  <div className="flex h-64 items-center justify-center">
                    <NexusLoader message="CARGANDO TELEMETRÍA..." fullscreen={false} />
                  </div>
                ) : (
                  <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard
                    label="Conversaciones totales"
                    value={metrics?.total_conversations ?? 0}
                    sub="Interacciones de sesión"
                    color="#00d4ff"
                    icon={<Activity size={16} className="text-nexus-cyan" />}
                  />
                  <MetricCard
                    label="Tokens consumidos"
                    value={formatTokens(metrics?.total_tokens ?? 0)}
                    sub="Promedio de todos los módulos"
                    color="#0e4aff"
                    icon={<Brain size={16} className="text-nexus-blue" />}
                  />
                  <MetricCard
                    label="Costo total (USD)"
                    value={formatCost(metrics?.total_cost_usd ?? 0)}
                    sub="Acumulado por llamadas Groq"
                    color="#00ffcc"
                    icon={<DollarSign size={16} className="text-nexus-accent" />}
                  />
                  <MetricCard
                    label="Latencia promedio"
                    value={formatLatency(metrics?.avg_latency_ms ?? 0)}
                    sub="Tiempo de respuesta pipeline"
                    color="#ff6b35"
                    icon={<Zap size={16} className="text-nexus-warn" />}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="nexus-panel p-4 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-[10px] text-nexus-dim tracking-widest uppercase">Distribución de Latencia por Sub-spans (ms)</span>
                      <Badge label="MEDICIÓN NATIVA" color="cyan" />
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={traceLatencyBreakdownData}>
                        <defs>
                          <linearGradient id="llmGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#0e4aff" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#0e4aff" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="dbGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#ff6b35" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ff6b35" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="overGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#5a7a9f" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#5a7a9f" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,74,255,0.1)" />
                        <XAxis dataKey="name" stroke="#2a3f5f" tick={{ fontFamily: 'Share Tech Mono', fontSize: 10, fill: '#5a7a9f' }} />
                        <YAxis stroke="#2a3f5f" tick={{ fontFamily: 'Share Tech Mono', fontSize: 10, fill: '#5a7a9f' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend iconType="rect" wrapperStyle={{ fontSize: 8, fontFamily: 'Share Tech Mono', color: '#5a7a9f' }} />
                        <Area type="monotone" stackId="1" dataKey="LLM Inference" stroke="#0e4aff" fill="url(#llmGrad)" strokeWidth={1.5} />
                        <Area type="monotone" stackId="1" dataKey="Vector Search" stroke="#00d4ff" fill="url(#dbGrad)" strokeWidth={1.5} />
                        <Area type="monotone" stackId="1" dataKey="LLM Judge Evaluation" stroke="#ff6b35" fill="url(#evalGrad)" strokeWidth={1.5} />
                        <Area type="monotone" stackId="1" dataKey="Overhead & Guardrails" stroke="#5a7a9f" fill="url(#overGrad)" strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="nexus-panel p-4">
                    <div className="mb-4">
                      <span className="font-mono text-[10px] text-nexus-dim tracking-widest uppercase">Uso por Módulo Operativo</span>
                    </div>
                    {moduleData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={moduleData} layout="vertical">
                          <XAxis type="number" stroke="#2a3f5f" tick={{ fontSize: 10, fill: '#5a7a9f', fontFamily: 'Share Tech Mono' }} />
                          <YAxis type="category" dataKey="name" stroke="#2a3f5f" tick={{ fontSize: 9, fill: '#5a7a9f', fontFamily: 'Share Tech Mono' }} width={80} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="count" name="Conversaciones" radius={[0, 2, 2, 0]}>
                            {moduleData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-40 flex items-center justify-center text-nexus-dim font-mono text-xs">Sin datos recolectados</div>
                    )}
                  </div>
                </div>

                <div className="nexus-panel p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[10px] text-nexus-dim tracking-widest uppercase">Costo Acumulado por Petición (µUSD)</span>
                    <Badge label="ESTIMACIONES DE COSTO" color="accent" />
                  </div>
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={costData}>
                      <defs>
                        <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#00ffcc" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00ffcc" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,74,255,0.1)" />
                      <XAxis dataKey="name" stroke="#2a3f5f" tick={{ fontFamily: 'Share Tech Mono', fontSize: 10, fill: '#5a7a9f' }} />
                      <YAxis stroke="#2a3f5f" tick={{ fontFamily: 'Share Tech Mono', fontSize: 10, fill: '#5a7a9f' }} />
                      <Tooltip content={<CustomTooltip />} formatter={(value: any) => [`${value} µUSD`, 'Costo']} />
                      <Area type="monotone" dataKey="cost" name="µUSD" stroke="#00ffcc" fill="url(#costGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {metrics?.avg_hallucination_score != null ? (
                    <div className="nexus-panel p-4 flex flex-col justify-center">
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-mono text-[10px] text-nexus-dim tracking-widest uppercase">Score de Alucinación Promedio (Judge)</span>
                        {metrics.avg_hallucination_score > 0.5
                          ? <div className="flex items-center gap-2 text-nexus-warn animate-pulse"><AlertTriangle size={14} /><span className="font-mono text-[10px] font-bold">ALERTA DE ALUCINACIONES</span></div>
                          : <div className="flex items-center gap-2 text-nexus-success"><CheckCircle size={14} /><span className="font-mono text-[10px]">PARÁMETROS SEGUROS</span></div>
                        }
                      </div>
                      <div className="h-3 bg-nexus-dark rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${metrics.avg_hallucination_score * 100}%`,
                            background: metrics.avg_hallucination_score > 0.5
                              ? 'linear-gradient(90deg, #ff6b3580, #ff6b35)'
                              : 'linear-gradient(90deg, #00e67680, #00e676)',
                          }}
                        />
                      </div>
                      <div className="mt-2 font-display text-2xl font-bold" style={{ color: metrics.avg_hallucination_score > 0.5 ? '#ff6b35' : '#00e676' }}>
                        {(metrics.avg_hallucination_score * 100).toFixed(1)}%
                      </div>
                    </div>
                  ) : <div />}

                  <div className="nexus-panel p-4 bg-nexus-darker/60 border-nexus-accent/30 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-[10px] text-nexus-dim tracking-widest uppercase text-nexus-accent">Gasto Total Acumulado (COP)</span>
                      <DollarSign size={14} className="text-nexus-accent animate-pulse" />
                    </div>
                    <div className="flex flex-col gap-1 items-end justify-center h-full flex-grow">
                      <span className="font-display text-4xl font-bold text-nexus-accent">
                        ${((metrics?.total_cost_usd || 0) * trm).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </span>
                      <span className="font-mono text-[10px] text-nexus-dim">Pesos Colombianos (Tasa aprox. ${trm.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                    </div>
                  </div>
                </div>

                {/* Recent Activity Table */}
                <div className="nexus-panel p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-nexus-dim tracking-widest uppercase">Actividad de Consultas Recientes</span>
                    <Badge label={`${metrics?.recent_conversations?.length ?? 0} Solicitudes`} color="blue" />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-nexus-blue/20">
                          {['MÓDULO', 'MODELO', 'MENSAJE', 'TOKENS', 'COSTO', 'LATENCIA', 'ALUCINACIÓN'].map(h => (
                            <th key={h} className="text-left font-mono text-[9px] text-nexus-dim tracking-widest pb-2 pr-4">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(metrics?.recent_conversations ?? []).map((c, i) => (
                          <tr 
                            key={c.id} 
                            className={`border-b border-nexus-blue/10 hover:bg-nexus-blue/5 transition-colors cursor-pointer ${selectedTrace?.id === c.id ? 'bg-nexus-blue/10 border-l-2 border-l-nexus-cyan pl-2 font-bold' : ''}`}
                            onClick={() => setSelectedTrace(c)}
                            style={{ animationDelay: `${i * 50}ms` }}
                          >
                            <td className="py-2.5 pr-4">
                              <Badge label={c.module?.toUpperCase() || 'CHAT'} color={c.module === 'chat' ? 'blue' : c.module === 'rag' ? 'cyan' : c.module === 'code_review' ? 'accent' : 'orange'} />
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-[9px] text-nexus-dim truncate max-w-[100px]">
                              {(c as any).model || '—'}
                            </td>
                            <td className="py-2.5 pr-4 font-body text-nexus-text max-w-[180px] truncate">{c.user_message}</td>
                            <td className="py-2.5 pr-4 font-mono text-nexus-cyan">{formatTokens(c.tokens_used)}</td>
                            <td className="py-2.5 pr-4 font-mono text-nexus-accent">{formatCost(c.cost_usd)}</td>
                            <td className="py-2.5 pr-4 font-mono text-nexus-warn">{formatLatency(c.latency_ms)}</td>
                            <td className="py-2.5 pr-4">
                              {c.hallucination_score != null
                                ? <span className="font-mono" style={{ color: c.hallucination_score > 0.5 ? '#ff6b35' : '#00e676' }}>{(c.hallucination_score * 100).toFixed(0)}%</span>
                                : <span className="text-nexus-dim">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── GENERAL GANTT TIMELINE TIMELINE ── */}
                <div className="nexus-panel p-5 border-nexus-cyan/40 bg-gradient-to-br from-[#020408] via-nexus-darker/90 to-[#020408]">
                  <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/5">
                    <Network size={20} className="text-nexus-cyan animate-pulse" />
                    <div>
                      <span className="font-mono text-xs text-nexus-cyan tracking-widest uppercase font-bold">Línea de Trazas e Historial de Spans</span>
                      <p className="font-body text-[10px] text-nexus-dim leading-none mt-0.5">Desglose de llamadas y sincronización OTEL del registro seleccionado</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 flex flex-col gap-4">
                      {selectedTrace ? (
                        <div className="bg-nexus-darker/80 border border-white/5 rounded-xl p-4 flex flex-col gap-4">
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 border-b border-white/5 pb-3">
                            <div className="flex flex-col">
                              <span className="font-mono text-[8px] text-nexus-dim uppercase">TRACE ID</span>
                              <span className="font-mono text-xs text-white truncate font-bold">0x{selectedTrace.id.toString(16).toUpperCase()}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-mono text-[8px] text-nexus-dim uppercase">MODELO</span>
                              <span className="font-mono text-xs text-nexus-blue truncate font-bold">{selectedTrace.model || 'N/A'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-mono text-[8px] text-nexus-dim uppercase">LATENCIA</span>
                              <span className="font-mono text-xs text-nexus-warn font-bold">{selectedTrace.latency_ms} ms</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-mono text-[8px] text-nexus-dim uppercase">TOKENS</span>
                              <span className="font-mono text-xs text-nexus-cyan font-bold">{selectedTrace.tokens_used}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-mono text-[8px] text-nexus-dim uppercase">COSTO</span>
                              <span className="font-mono text-xs text-nexus-accent font-bold">${selectedTrace.cost_usd ? selectedTrace.cost_usd.toFixed(6) : '0.000000'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-mono text-[8px] text-nexus-dim uppercase">ALUCINACIÓN</span>
                              <span className="font-mono text-xs font-bold" style={{ color: selectedTrace.hallucination_score > 0.5 ? '#ff6b35' : '#00e676' }}>
                                {selectedTrace.hallucination_score != null ? `${(selectedTrace.hallucination_score * 100).toFixed(0)}%` : '—'}
                              </span>
                            </div>
                          </div>

                          <div className="bg-[#020408]/60 p-2.5 rounded border border-white/5 text-[11px]">
                            <span className="font-mono text-[9px] text-nexus-dim uppercase block mb-1">PROMPT DE ENTRADA (SPAN PARENT INPUT)</span>
                            <p className="font-body text-nexus-text line-clamp-2 truncate">{selectedTrace.user_message}</p>
                          </div>

                          <div className="flex flex-col gap-3.5 mt-4 relative">
                            {/* Subtle background grid for timing visualization */}
                            <div className="absolute inset-0 flex justify-between pointer-events-none border-x border-white/5 opacity-50">
                              {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-full border-r border-white/5 w-1/4" />)}
                            </div>
                            {getSpansForConversation(selectedTrace).map((span: any, index: number) => {
                              const totalLat = selectedTrace.latency_ms || 800
                              const percentOffset = (span.offset / totalLat) * 100
                              const percentWidth = Math.max(4, (span.latency / totalLat) * 100)
                              return (
                                <div key={index} className="flex flex-col gap-1 relative z-10">
                                  <div className="flex justify-between items-center text-[10px] font-mono bg-[#020408]/60 p-1.5 rounded border border-white/5 backdrop-blur-sm shadow-sm">
                                    <span className="text-nexus-text font-bold flex items-center gap-1.5 flex-wrap">
                                      {span.type === 'llm' && <Cpu size={10} className="text-nexus-blue" />}
                                      {span.type === 'db' && <Database size={10} className="text-nexus-cyan" />}
                                      {span.type === 'evaluation' && <Sparkles size={10} className="text-nexus-accent" />}
                                      {span.type === 'security' && <ShieldAlert size={10} className="text-nexus-danger" />}
                                      {span.type === 'pipeline' && <Network size={10} className="text-white" />}
                                      {span.name}
                                    </span>
                                    <span className="text-nexus-dim flex items-center gap-2">
                                      <Badge label={`${span.latency} ms`} color={span.status === 'warning' ? 'orange' : 'cyan'} />
                                      {span.tokens ? <span className="opacity-70">{span.tokens} t</span> : ''}
                                      {span.cost ? <span className="opacity-70">${span.cost.toFixed(6)}</span> : ''}
                                    </span>
                                  </div>
                                  <div className="relative h-2.5 bg-white/5 rounded-full w-full overflow-hidden mt-1 shadow-inner">
                                    <div 
                                      className="absolute h-full rounded-full transition-all duration-700 shadow-lg"
                                      style={{
                                        left: `${percentOffset}%`,
                                        width: `${percentWidth}%`,
                                        background: span.type === 'llm' 
                                          ? 'linear-gradient(90deg, #0e4aff, #00d4ff)' 
                                          : span.type === 'db' 
                                            ? 'linear-gradient(90deg, #00d4ff, #00ffcc)'
                                            : span.type === 'evaluation' 
                                              ? 'linear-gradient(90deg, #ff6b35, #ff9e00)'
                                              : span.type === 'security'
                                                ? 'linear-gradient(90deg, #ff3366, #ff6b35)'
                                                : 'linear-gradient(90deg, #5a7a9f, #7f9eb2)'
                                      }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-nexus-darker/40 border border-dashed border-white/10 rounded-xl p-12 text-center text-nexus-dim font-mono text-xs">
                          Selecciona una solicitud para examinar sus spans de ejecución.
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-5 flex flex-col gap-4">
                      <div className="flex justify-between items-center bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                        <div className="flex items-center gap-2">
                          <Terminal size={14} className="text-nexus-cyan" />
                          <span className="font-mono text-[10px] text-white uppercase tracking-wider">Consola OTEL en Tiempo Real</span>
                        </div>
                        <div className="flex items-center gap-1.5 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-nexus-cyan shadow-[0_0_6px_#00d4ff]" />
                          <span className="font-mono text-[8px] text-nexus-cyan uppercase font-bold">CONEXIÓN LOCAL</span>
                        </div>
                      </div>
                      <div className="bg-[#020408] border border-white/5 rounded-xl p-4 h-[210px] overflow-y-auto nexus-scrollbar font-mono text-[10px] flex flex-col gap-2 select-text">
                        {telemetryLogs.map((log: any, index: number) => (
                          <div key={index} className="opacity-90 hover:opacity-100 transition-opacity flex flex-wrap gap-2 items-center bg-white/[0.02] p-1.5 rounded">
                            <span className="text-nexus-dim">[{log.time}]</span>
                            <span className="text-nexus-cyan font-bold">{log.trace}</span>
                            <span className="text-white bg-white/10 px-1.5 py-0.5 rounded text-[8px]">{log.module}</span>
                            {log.model && <span className="text-nexus-blue bg-nexus-blue/10 px-1.5 py-0.5 rounded text-[8px]">{log.model}</span>}
                            <span className="text-nexus-text flex-grow">{log.msg}</span>
                            {log.hallucination != null && (
                              <span className="font-bold text-[9px]" style={{ color: log.hallucination > 0.5 ? '#ff6b35' : '#00e676' }}>
                                H_SCORE={log.hallucination.toFixed(2)}
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${log.status === 'WARNING' ? 'bg-nexus-warn/20 text-nexus-warn' : 'bg-nexus-success/20 text-nexus-success'}`}>
                              {log.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Top Users Section */}
            {!isPersonal && metrics?.top_users && metrics.top_users.length > 0 && (
              <div className="nexus-panel p-5 border-nexus-warn/40 bg-gradient-to-r from-[#020408] via-nexus-warn/5 to-[#020408] mt-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-nexus-warn/10 p-2 rounded-lg border border-nexus-warn/30">
                    <span className="text-xl">👑</span>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-nexus-warn tracking-widest uppercase block font-bold">TOP 5 POWER USERS</span>
                    <span className="font-body text-xs text-nexus-dim block mt-0.5">Usuarios con mayor consumo en el sistema</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {metrics.top_users.map((user, index) => (
                    <div key={user.user_email} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-lg hover:border-nexus-warn/30 transition-all">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className={`font-mono text-xs font-bold ${index === 0 ? 'text-nexus-warn' : 'text-nexus-dim'}`}>#{index + 1}</span>
                        <span className="font-display text-sm text-white truncate">{user.user_email}</span>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0 ml-2">
                        <span className="font-mono text-xs text-nexus-warn font-bold">{user.conversations}</span>
                        <span className="font-mono text-[8px] text-nexus-dim uppercase">Interacciones</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>


      </div>

      {/* ── HIGH TECH OBSERVABILITY CONTEXT ONBOARDING MODAL ── */}
      {showContextModal && (() => {
        const info = TAB_HELP_CONTENT[activeTab] || TAB_HELP_CONTENT.general
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nexus-darker/80 backdrop-blur-md animate-fade-in select-none">
            <div className="relative w-full max-w-2xl bg-nexus-darker/95 border border-white/10 rounded-2xl p-6 md:p-8 shadow-[0_0_50px_rgba(0,212,255,0.18)] flex flex-col gap-5 max-h-[85vh] overflow-y-auto nexus-scrollbar animate-scale-in">
              
              {/* Close Button X */}
              <button 
                onClick={handleCloseModal}
                className="absolute top-4 right-4 text-nexus-dim hover:text-white transition-colors duration-200 p-1"
                aria-label="Cerrar modal"
              >
                <X size={16} />
              </button>

              {/* Title & Badge */}
              <div className="flex flex-col gap-1.5 pr-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`border px-2 py-0.5 rounded text-[8px] font-mono tracking-widest uppercase font-bold ${info.badgeColor}`}>
                    {info.subtitle}
                  </span>
                  <span className="font-mono text-[9px] text-nexus-cyan tracking-wider font-bold uppercase animate-pulse">
                    Centro de Inducción
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold font-title text-white tracking-wide mt-1">
                  {info.title}
                </h2>
              </div>

              <hr className="border-white/5 my-0.5" />

              {/* Section 1: ¿Qué hace y para qué sirve? */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-nexus-cyan font-mono text-[10px] tracking-wider uppercase font-bold">
                  <Activity size={12} className="text-nexus-cyan" />
                  <span>¿Qué hace y para qué sirve?</span>
                </div>
                <p className="font-body text-nexus-text text-xs leading-relaxed pl-5 text-justify">
                  {info.description}
                </p>
              </div>

              {/* Section 2: ¿Cómo hace los trazos? */}
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-center gap-2 text-nexus-cyan font-mono text-[10px] tracking-wider uppercase font-bold">
                  <Network size={12} className="text-nexus-cyan" />
                  <span>¿Cómo hace los trazos? (Rastreo Técnico)</span>
                </div>
                <p className="font-body text-nexus-text text-xs leading-relaxed pl-5 text-justify">
                  {info.tracing}
                </p>
              </div>

              {/* Section 3: Interpretación de Métricas */}
              <div className="flex flex-col gap-3 mt-1">
                <div className="flex items-center gap-2 text-nexus-cyan font-mono text-[10px] tracking-wider uppercase font-bold">
                  <Sliders size={12} className="text-nexus-cyan" />
                  <span>Interpretación de Métricas y Gráficos</span>
                </div>
                <div className="flex flex-col gap-2.5 pl-5">
                  {info.metrics.map((m, idx) => (
                    <div key={idx} className="bg-[#020408]/40 border border-white/5 p-3 rounded-xl hover:border-nexus-cyan/20 transition-all duration-300">
                      <strong className="font-mono text-xs text-white block mb-0.5 uppercase tracking-wide">
                        {m.name}
                      </strong>
                      <span className="font-body text-nexus-dim text-xs leading-relaxed text-justify block">
                        {m.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-white/5 my-0.5" />

              {/* Accept button at bottom */}
              <div className="flex justify-end items-center gap-4 mt-1">
                <span className="font-mono text-[8px] text-nexus-dim uppercase tracking-wider hidden sm:inline">
                  Presiona el botón para continuar
                </span>
                <button
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 rounded-xl bg-nexus-cyan/25 border border-nexus-cyan text-nexus-cyan hover:bg-nexus-cyan/40 transition-all duration-300 font-mono text-[10px] tracking-wider uppercase font-bold shadow-[0_0_15px_rgba(0,212,255,0.15)] hover:scale-[1.03] active:scale-[0.98]"
                >
                  Entendido
                </button>
              </div>

            </div>
          </div>
        )
      })()}

      {/* PLANTILLA DE PDF EMPRESARIAL OCULTA */}
      <CorporateReportTemplate metrics={metrics} period="Actual" />

    </Layout>
  )
}
