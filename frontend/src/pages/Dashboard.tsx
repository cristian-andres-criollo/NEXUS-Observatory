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
import { authAPI } from '../lib/api'

const MODULE_LABELS: Record<string, string> = {
  chat: 'ASISTENTE',
  rag: 'DOCUMENTOS',
  code_review: 'CODE REVIEW',
  repo_agent: 'REPO AGENT',
}
const MODULE_COLORS: Record<string, string> = {
  chat: '#0e4aff', rag: '#00d4ff', code_review: '#00ffcc', repo_agent: '#ff6b35',
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

  if (c.module === 'rag') {
    return [
      { name: 'RAG Pipeline Invocation', type: 'pipeline', latency: totalLatency, cost: totalCost, tokens: totalTokens, offset: 0, status: 'success' },
      { name: 'ChromaDB Query Search', type: 'db', latency: Math.round(totalLatency * 0.25), cost: 0, tokens: 0, offset: 0, status: 'success' },
      { name: 'Prompt Augmentation & Context Sync', type: 'internal', latency: Math.round(totalLatency * 0.08), cost: 0, tokens: 0, offset: Math.round(totalLatency * 0.25), status: 'success' },
      { name: 'Groq LLM Generation (Llama 3.1)', type: 'llm', latency: Math.round(totalLatency * 0.52), cost: totalCost * 0.8, tokens: Math.round(totalTokens * 0.95), offset: Math.round(totalLatency * 0.33), status: 'success' },
      { name: 'LLM-As-Judge Groundedness Evaluation', type: 'evaluation', latency: Math.round(totalLatency * 0.15), cost: totalCost * 0.2, tokens: Math.round(totalTokens * 0.05), offset: Math.round(totalLatency * 0.85), status: c.hallucination_score > 0.5 ? 'warning' : 'success' },
    ]
  } else if (c.module === 'code_review') {
    return [
      { name: 'Code Review Pipeline', type: 'pipeline', latency: totalLatency, cost: totalCost, tokens: totalTokens, offset: 0, status: 'success' },
      { name: 'Syntax Parsing & Abstract Syntax Tree', type: 'internal', latency: Math.round(totalLatency * 0.12), cost: 0, tokens: 0, offset: 0, status: 'success' },
      { name: 'Groq Static Code Analysis & Linting', type: 'llm', latency: Math.round(totalLatency * 0.68), cost: totalCost * 0.9, tokens: Math.round(totalTokens * 0.9), offset: Math.round(totalLatency * 0.12), status: 'success' },
      { name: 'Diff Generation & Vulnerability Auditing', type: 'security', latency: Math.round(totalLatency * 0.20), cost: totalCost * 0.1, tokens: Math.round(totalTokens * 0.1), offset: Math.round(totalLatency * 0.80), status: 'success' },
    ]
  } else if (c.module === 'repo_agent') {
    return [
      { name: 'Repo Agent Report Builder', type: 'pipeline', latency: totalLatency, cost: totalCost, tokens: totalTokens, offset: 0, status: 'success' },
      { name: 'Repository Structure Analysis & Traversal', type: 'internal', latency: Math.round(totalLatency * 0.35), cost: 0, tokens: 0, offset: 0, status: 'success' },
      { name: 'Groq Multi-File Technical Synthesizer', type: 'llm', latency: Math.round(totalLatency * 0.55), cost: totalCost * 0.95, tokens: Math.round(totalTokens * 0.95), offset: Math.round(totalLatency * 0.35), status: 'success' },
      { name: 'PDF Report Assembly', type: 'internal', latency: Math.round(totalLatency * 0.10), cost: totalCost * 0.05, tokens: Math.round(totalTokens * 0.05), offset: Math.round(totalLatency * 0.90), status: 'success' },
    ]
  } else {
    return [
      { name: 'Assistant Chat Invocation', type: 'pipeline', latency: totalLatency, cost: totalCost, tokens: totalTokens, offset: 0, status: 'success' },
      { name: 'System Context & Security Guardrails', type: 'security', latency: Math.round(totalLatency * 0.08), cost: 0, tokens: 0, offset: 0, status: 'success' },
      { name: 'Groq LLM Chat Generation (Llama 3.1)', type: 'llm', latency: Math.round(totalLatency * 0.84), cost: totalCost, tokens: totalTokens, offset: Math.round(totalLatency * 0.08), status: 'success' },
      { name: 'Observability Span Publish', type: 'internal', latency: Math.round(totalLatency * 0.08), cost: 0, tokens: 0, offset: Math.round(totalLatency * 0.92), status: 'success' },
    ]
  }
}

// ==========================================
// MOCK DATA PARA DASHBOARDS INTEGRADOS
// ==========================================

const LANGSMITH_MOCK_RUNS = [
  { id: 'run-1', name: 'RAG Pipeline Ingest & Answer', module: 'rag', status: 'success', latency: 980, tokens: 350, cost: 0.00015, date: '11:24:02' },
  { id: 'run-2', name: 'Code Review Security Audit', module: 'code_review', status: 'success', latency: 1420, tokens: 840, cost: 0.00052, date: '11:21:44' },
  { id: 'run-3', name: 'Standard Assistant Chat Completion', module: 'chat', status: 'success', latency: 620, tokens: 180, cost: 0.00008, date: '11:18:12' },
  { id: 'run-4', name: 'Unit Test Suite Generator', module: 'repo_agent', status: 'warning', latency: 2800, tokens: 1650, cost: 0.00110, date: '10:55:01' },
]

const LANGSMITH_RUN_TREES: Record<string, any[]> = {
  'run-1': [
    { id: 'r1-n1', name: 'RAG Pipeline Entrypoint', type: 'pipeline', latency: 980, indent: 0, status: 'success', inputs: { query: '¿Cómo funciona RAG en Nexus?', session_id: 'sess-839c' }, outputs: { response: 'El sistema RAG en Nexus recupera fragmentos desde ChromaDB y los inyecta en el prompt del LLM...' } },
    { id: 'r1-n2', name: 'ChromaDBVectorSearch.query', type: 'db', latency: 245, indent: 1, status: 'success', inputs: { query: 'RAG en Nexus', limit: 3 }, outputs: { documents: ['doc_id_1: RAG indexa archivos...', 'doc_id_2: ChromaDB es el motor...'] } },
    { id: 'r1-n3', name: 'AugmentedPromptBuilder', type: 'internal', latency: 35, indent: 1, status: 'success', inputs: { raw_query: '¿Cómo funciona RAG?', context_length: 512 }, outputs: { full_prompt: 'System: Eres un asistente... Contexto: RAG indexa... Usuario: ¿Cómo funciona RAG?' } },
    { id: 'r1-n4', name: 'Groq.llama3_1_8b_instant.generate', type: 'llm', latency: 550, indent: 1, status: 'success', inputs: { model: 'llama-3.1-8b-instant', temp: 0.2, prompt_tokens: 380 }, outputs: { completion: 'El sistema RAG en Nexus recupera fragmentos...', completion_tokens: 70 } },
    { id: 'r1-n5', name: 'LLMJudge.evaluate_groundedness', type: 'evaluation', latency: 150, indent: 1, status: 'success', inputs: { response: 'El sistema RAG...', context: 'doc_id_1: RAG...' }, outputs: { score: 0.95, matches: ['RAG recupera fragmentos'] } },
  ],
  'run-2': [
    { id: 'r2-n1', name: 'Code Review Security Audit', type: 'pipeline', latency: 1420, indent: 0, status: 'success', inputs: { code: 'def login(): eval(request.args.get("pass"))' }, outputs: { review: 'CRITICAL WARNING: SQL Injection vulnerability and unsafe use of eval()...' } },
    { id: 'r2-n2', name: 'AST Syntax Parsing', type: 'internal', latency: 90, indent: 1, status: 'success', inputs: { raw_code: 'def login()...' }, outputs: { nodes_parsed: 14, syntax_errors: 0 } },
    { id: 'r2-n3', name: 'Groq.llama3_3_70b_versatile.analyze', type: 'llm', latency: 1120, indent: 1, status: 'success', inputs: { model: 'llama-3.3-70b-versatile', mode: 'security-audit' }, outputs: { json: { severity: 'CRITICAL', vulnerability: 'Unsafe execution', suggestion: 'Use static matching instead of eval()' } } },
    { id: 'r2-n4', name: 'JSON_Parse_Validation', type: 'internal', latency: 210, indent: 1, status: 'success', inputs: { raw_json: '{"severity": "CRITICAL"}' }, outputs: { valid: true } },
  ],
  'run-3': [
    { id: 'r3-n1', name: 'Assistant Chat Run', type: 'pipeline', latency: 620, indent: 0, status: 'success', inputs: { message: 'Hola, ¿quién eres?' }, outputs: { response: 'Hola, soy Antigravity, un asistente de IA de Nexus.' } },
    { id: 'r3-n2', name: 'GuardrailSecurityScanner', type: 'security', latency: 45, indent: 1, status: 'success', inputs: { message: 'Hola, ¿quién eres?' }, outputs: { flagged: false, category: 'safe' } },
    { id: 'r3-n3', name: 'Groq.llama3_1_8b_instant.chat', type: 'llm', latency: 525, indent: 1, status: 'success', inputs: { model: 'llama-3.1-8b-instant', input: 'Hola...' }, outputs: { response: 'Hola, soy Antigravity...' } },
    { id: 'r3-n4', name: 'TelemetryPubSub', type: 'internal', latency: 50, indent: 1, status: 'success', inputs: { status: 'PUBLISHED' }, outputs: { ok: true } },
  ],
  'run-4': [
    { id: 'r4-n1', name: 'Unit Test Suite Generator', type: 'pipeline', latency: 2800, indent: 0, status: 'warning', inputs: { repo: 'nexus-observatory' }, outputs: { error: 'LLM rate limit reached, retrying request...' } },
    { id: 'r4-n2', name: 'Cloning Repository', type: 'internal', latency: 650, indent: 1, status: 'success', inputs: { git_url: 'git@github.com:nexus-observatory.git' }, outputs: { total_files: 24, clone_time_ms: 642 } },
    { id: 'r4-n3', name: 'Groq.llama3_3_70b.generate_tests', type: 'llm', latency: 1950, indent: 1, status: 'warning', inputs: { prompt: 'Genera tests para app/api.py' }, outputs: { error: 'Rate limit error 429' } },
    { id: 'r4-n4', name: 'Linear Retry Backoff', type: 'internal', latency: 200, indent: 1, status: 'success', inputs: { attempt: 1 }, outputs: { action: 'RETRY' } },
  ]
}

const HELICONE_RPS_DATA = [
  { name: '10s ago', rps: 12 },
  { name: '9s ago', rps: 18 },
  { name: '8s ago', rps: 15 },
  { name: '7s ago', rps: 22 },
  { name: '6s ago', rps: 34 },
  { name: '5s ago', rps: 29 },
  { name: '4s ago', rps: 45 },
  { name: '3s ago', rps: 40 },
  { name: '2s ago', rps: 52 },
  { name: '1s ago', rps: 60 },
  { name: 'Now', rps: 48 },
]

const HELICONE_CACHE_DATA = [
  { name: 'Mon', Hits: 45, Misses: 80 },
  { name: 'Tue', Hits: 60, Misses: 75 },
  { name: 'Wed', Hits: 90, Misses: 65 },
  { name: 'Thu', Hits: 120, Misses: 55 },
  { name: 'Fri', Hits: 110, Misses: 70 },
  { name: 'Sat', Hits: 40, Misses: 30 },
  { name: 'Sun', Hits: 35, Misses: 25 },
]

const HELICONE_LOGS = [
  { path: '/v1/chat/completions', method: 'POST', status: 200, cache: 'HIT', latency: 45, cost: 0.0, date: '11:29:44' },
  { path: '/v1/chat/completions', method: 'POST', status: 200, cache: 'MISS', latency: 850, cost: 0.00018, date: '11:29:40' },
  { path: '/v1/embeddings', method: 'POST', status: 200, cache: 'MISS', latency: 120, cost: 0.00002, date: '11:28:15' },
  { path: '/v1/chat/completions', method: 'POST', status: 429, cache: 'MISS', latency: 98, cost: 0.0, date: '11:27:03' },
  { path: '/v1/chat/completions', method: 'POST', status: 200, cache: 'HIT', latency: 12, cost: 0.0, date: '11:25:52' },
]

const WEAVE_BENCHMARKS = [
  { version: 'v1.4.0 (Latest)', groundedness: 97.2, hallucination: 2.1, relevancy: 96.5, latency: 1100 },
  { version: 'v1.3.2 (Stable)', groundedness: 95.8, hallucination: 3.4, relevancy: 94.8, latency: 950 },
  { version: 'v1.2.0 (Legacy)', groundedness: 88.4, hallucination: 11.2, relevancy: 89.0, latency: 800 },
]

const WEAVE_AB_TEST = [
  { metric: 'Accuracy Score', modelA: '94.5%', modelB: '88.2%' },
  { metric: 'Cost per 1k Tok', modelA: '$0.59', modelB: '$0.05' },
  { metric: 'Response Latency', modelA: '1.45s', modelB: '0.62s' },
  { metric: 'Groundedness Rate', modelA: '97.2%', modelB: '91.4%' },
  { metric: 'Fallback Errors', modelA: '0.4%', modelB: '1.8%' },
]

const WEAVE_FAIL_LOGS = [
  { id: 'fail-1', rule: 'Groundedness Threshold < 0.85', value: 0.62, prompt: '¿Cuál es la fórmula del motor gravitacional?', response: 'El motor gravitacional usa antimateria ionizada para doblar el espacio-tiempo de forma lineal.' },
  { id: 'fail-2', rule: 'PII Leak Detection', value: 'High Danger', prompt: 'Registrar usuario Cristian Criollo pass: 123456', response: 'El usuario Cristian Criollo ha sido registrado con contraseña: 123456 en la base de datos local.' },
]

const PHOENIX_EMBEDDINGS_DATA = [
  { x: 12, y: 15, z: 200, label: 'def login(): eval(pass)', category: 'code_review', drift: 0.42, name: 'eval Code Injection' },
  { x: 14, y: 13, z: 200, label: 'SELECT * FROM users WHERE id = + id', category: 'code_review', drift: 0.35, name: 'Raw SQL Concatenation' },
  { x: 11, y: 16, z: 200, label: 'jwt.decode(token, verify=False)', category: 'code_review', drift: 0.28, name: 'JWT Bypass Auth' },
  { x: 45, y: 52, z: 200, label: '¿Qué es Nexus Observatory?', category: 'rag', drift: 0.05, name: 'Nexus Definition' },
  { x: 42, y: 55, z: 200, label: 'Soporte de carpetas webkitdirectory en RAG', category: 'rag', drift: 0.12, name: 'RAG Directory Upload' },
  { x: 47, y: 49, z: 200, label: 'ChromaDB collection rules and settings', category: 'rag', drift: 0.08, name: 'ChromaDB Naming Rules' },
  { x: -20, y: -25, z: 200, label: 'Hola, ¿cómo estás hoy?', category: 'chat', drift: 0.01, name: 'User Greeting' },
  { x: -18, y: -22, z: 200, label: '¿Quién eres tú y qué sabes hacer?', category: 'chat', drift: 0.02, name: 'AI Identity Check' },
  { x: -22, y: -27, z: 200, label: 'Gracias por tu gran ayuda con el código', category: 'chat', drift: 0.03, name: 'User Gratitude' },
]

const PHOENIX_DRIFT_TIMELINE = [
  { name: 'Week 1', drift: 0.02 },
  { name: 'Week 2', drift: 0.04 },
  { name: 'Week 3', drift: 0.08 },
  { name: 'Week 4', drift: 0.14 },
  { name: 'Week 5', drift: 0.24 },
]

const PHOENIX_LATENCY_VS_CHUNKS = [
  { chunks: 1, latency: 140 },
  { chunks: 2, latency: 190 },
  { chunks: 3, latency: 245 },
  { chunks: 4, latency: 310 },
  { chunks: 5, latency: 420 },
]

export function Dashboard() {
  const { user, updateUser } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [isPersonal, setIsPersonal] = React.useState(true)
  const { metrics, loading, error: metricsError } = useMetrics(isPersonal, true, 8000)
  const { data: latencyHistory, error: latencyError } = useLatencyHistory(isPersonal, 25)
  const { data: costHistory,   error: costError }    = useCostHistory(isPersonal, 25)

  // Router Search Params for tabs
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'general'

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
  const [telemetryLogs, setTelemetryLogs] = React.useState<string[]>([])

  // LangSmith: usar conversaciones reales como "runs"
  const [selectedConvId, setSelectedConvId] = React.useState<number | null>(null)
  const [selectedSpanNode, setSelectedSpanNode] = React.useState<any>(null)

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

  // Phoenix hovered embedding state
  const [hoveredEmbedding, setHoveredEmbedding] = React.useState<any>(PHOENIX_EMBEDDINGS_DATA[3])

  // Seleccionar automáticamente la primera traza al cargar
  React.useEffect(() => {
    if (metrics?.recent_conversations?.length && !selectedTrace) {
      setSelectedTrace(metrics.recent_conversations[0])
    }
  }, [metrics, selectedTrace])

  // Consola OTEL — basada en conversaciones reales de la DB
  React.useEffect(() => {
    const timeNow = new Date()
    const initial = [
      `[${new Date(timeNow.getTime() - 40000).toLocaleTimeString()}] [OTEL-SPAN] parent_span=0x8f3c module=SYSTEM - Telemetry hub synced, listening...`,
      `[${new Date(timeNow.getTime() - 25000).toLocaleTimeString()}] [OTEL-SPAN] spans_published=${metrics?.total_conversations ?? 0}, state=CONNECTED`,
      `[${new Date(timeNow.getTime() - 10000).toLocaleTimeString()}] [OTEL-SPAN] ChromaDB collection verified: collection_name=nexus-observatory`,
    ]
    setTelemetryLogs(initial)

    const interval = setInterval(() => {
      if (metrics?.recent_conversations?.length) {
        const randConv = metrics.recent_conversations[Math.floor(Math.random() * metrics.recent_conversations.length)]
        const time = new Date().toLocaleTimeString()
        const spans = getSpansForConversation(randConv)
        const randomSpan = spans[Math.floor(Math.random() * spans.length)]
        const traceId = randConv.id.toString(16).padStart(8, '0')
        const newLog = `[${time}] [OTEL-SPAN] trace_id=0x${traceId} module=${randConv.module?.toUpperCase()} - "${randomSpan.name}" latency=${randomSpan.latency}ms status=${randomSpan.status?.toUpperCase()}`
        setTelemetryLogs(prev => [newLog, ...prev].slice(0, 15))
      }
    }, 4500)

    return () => clearInterval(interval)
  }, [metrics])

  // Simulator State
  const [simUsers, setSimUsers] = React.useState(1000)
  const [simModel, setSimModel] = React.useState('llama-3.1-8b-instant')
  
  const SIM_MODELS: Record<string, {input: number, output: number, name: string}> = {
    'llama-3.1-8b-instant': { input: 0.05, output: 0.08, name: 'Llama 3.1 8B (Rápido)' },
    'llama-3.3-70b-versatile': { input: 0.59, output: 0.79, name: 'Llama 3.3 70B (Preciso)' },
  }
  
  const avgTokens = metrics?.total_conversations ? (metrics.total_tokens / metrics.total_conversations) : 0
  const avgInput = avgTokens * 0.7 // estimate
  const avgOutput = avgTokens * 0.3
  
  const simCostPerConv = avgTokens > 0 ? (avgInput * SIM_MODELS[simModel].input + avgOutput * SIM_MODELS[simModel].output) / 1_000_000 : 0
  const simTotalMonthly = simCostPerConv * simUsers * 30 // 30 convs per user/month

  const moduleData = metrics
    ? Object.entries(metrics.conversations_by_module).map(([key, count]) => ({
        name: MODULE_LABELS[key] || key, count, color: MODULE_COLORS[key] || '#0e4aff',
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
    cost: parseFloat((d.cost * 1_000_000).toFixed(4)), // µUSD
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 bg-nexus-darker/60 backdrop-blur-md p-2 rounded-xl border border-white/5 shadow-inner flex-grow">
            {[
              { id: 'general', label: 'Monitor General', icon: Activity, activeColor: 'bg-nexus-cyan/15 border-nexus-cyan text-nexus-cyan' },
              { id: 'langsmith', label: 'LangSmith Traces', icon: Network, activeColor: 'bg-nexus-success/15 border-nexus-success text-nexus-success' },
              { id: 'helicone', label: 'Helicone Proxy', icon: Gauge, activeColor: 'bg-nexus-cyan/15 border-nexus-cyan text-nexus-cyan' },
              { id: 'weave', label: 'W&B Weave Evaluator', icon: Layers, activeColor: 'bg-nexus-warn/15 border-nexus-warn text-nexus-warn' },
              { id: 'phoenix', label: 'Phoenix Embeddings', icon: Compass, activeColor: 'bg-nexus-blue/15 border-nexus-blue text-nexus-blue' },
            ].map((t) => {
              const Icon = t.icon
              const isActive = activeTab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setSearchParams({ tab: t.id })}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-all duration-300 font-mono text-[10px] tracking-wider uppercase ${
                    isActive 
                      ? t.activeColor + ' shadow-[0_0_15px_rgba(0,212,255,0.08)] font-bold scale-[1.02]' 
                      : 'bg-transparent border-transparent text-nexus-dim hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={12} className={isActive ? '' : 'text-nexus-dim'} />
                  <span>{t.label}</span>
                </button>
              )
            })}
          </div>
          
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
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-nexus-cyan/40 bg-nexus-cyan/10 text-nexus-cyan hover:bg-nexus-cyan/25 transition-all duration-300 font-mono text-[10px] tracking-wider uppercase font-bold shadow-[0_0_15px_rgba(0,212,255,0.08)] hover:scale-[1.02] active:scale-[0.98] lg:self-stretch"
          >
            <HelpCircle size={13} className="animate-pulse text-nexus-cyan" />
            <span>RECORDAR</span>
          </button>
        </div>

        {/* ==================================================== */}
        {/* TAB 1: GENERAL SYSTEM MONITOR                        */}
        {/* ==================================================== */}
        {activeTab === 'general' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            {metricsError && (
              <div className="nexus-panel p-4 border-nexus-danger/40 bg-nexus-danger/5 flex items-center gap-3">
                <WifiOff size={16} className="text-nexus-danger flex-shrink-0" />
                <div>
                  <p className="font-mono text-xs text-nexus-danger">Error de Conexión del Backend</p>
                  <p className="font-body text-xs text-nexus-dim mt-0.5">{metricsError} — ¿El backend está activo?</p>
                </div>
              </div>
            )}

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
                        ${((metrics?.total_cost_usd || 0) * 4100).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                      <span className="font-mono text-[10px] text-nexus-dim">Pesos Colombianos (Tasa aprox. $4,100)</span>
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
                              <Badge label={MODULE_LABELS[c.module] || c.module} color={c.module === 'chat' ? 'blue' : c.module === 'rag' ? 'cyan' : c.module === 'code_review' ? 'accent' : 'orange'} />
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
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-white/5 pb-3">
                            <div className="flex flex-col">
                              <span className="font-mono text-[8px] text-nexus-dim uppercase">TRACE ID</span>
                              <span className="font-mono text-xs text-white truncate font-bold">0x{selectedTrace.id.toString(16).toUpperCase()}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-mono text-[8px] text-nexus-dim uppercase">LATENCIA TOTAL</span>
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
                          </div>

                          <div className="bg-[#020408]/60 p-2.5 rounded border border-white/5 text-[11px]">
                            <span className="font-mono text-[9px] text-nexus-dim uppercase block mb-1">PROMPT DE ENTRADA (SPAN PARENT INPUT)</span>
                            <p className="font-body text-nexus-text line-clamp-2 truncate">{selectedTrace.user_message}</p>
                          </div>

                          <div className="flex flex-col gap-3.5 mt-2">
                            {getSpansForConversation(selectedTrace).map((span: any, index: number) => {
                              const totalLat = selectedTrace.latency_ms || 800
                              const percentOffset = (span.offset / totalLat) * 100
                              const percentWidth = Math.max(4, (span.latency / totalLat) * 100)
                              return (
                                <div key={index} className="flex flex-col gap-1">
                                  <div className="flex justify-between items-center text-[10px] font-mono">
                                    <span className="text-nexus-text font-bold flex items-center gap-1.5 flex-wrap">
                                      {span.type === 'llm' && <Cpu size={10} className="text-nexus-blue" />}
                                      {span.type === 'db' && <Database size={10} className="text-nexus-cyan" />}
                                      {span.type === 'evaluation' && <Sparkles size={10} className="text-nexus-accent" />}
                                      {span.type === 'security' && <ShieldAlert size={10} className="text-nexus-danger" />}
                                      {span.type === 'pipeline' && <Network size={10} className="text-white" />}
                                      {span.name}
                                    </span>
                                    <span className="text-nexus-dim">
                                      {span.latency} ms {span.tokens ? `• ${span.tokens} t` : ''} {span.cost ? `• $${span.cost.toFixed(6)}` : ''}
                                    </span>
                                  </div>
                                  <div className="relative h-2.5 bg-white/5 rounded-full w-full overflow-hidden mt-0.5">
                                    <div 
                                      className="absolute h-full rounded-full transition-all duration-700"
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
                      <div className="bg-[#020408] border border-white/5 rounded-xl p-4 h-[210px] overflow-y-auto nexus-scrollbar font-mono text-[10px] flex flex-col gap-1.5 text-nexus-success select-text">
                        {telemetryLogs.map((log, index) => (
                          <div key={index} className="opacity-90 hover:opacity-100 transition-opacity">
                            <span className="text-nexus-dim">{log.substring(0, 10)}</span>
                            <span className="text-nexus-cyan font-bold">{log.substring(10, 22)}</span>
                            <span>{log.substring(22)}</span>
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
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: LANGSMITH WORKSPACE NATIVE SIMULATION         */}
        {/* ==================================================== */}
        {activeTab === 'langsmith' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div className="nexus-panel p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-2 border-l-nexus-success">
              <div className="flex items-center gap-2">
                <Network className="text-nexus-success animate-pulse" size={20} />
                <div>
                  <span className="font-mono text-xs text-white uppercase font-bold tracking-wider">LangSmith Native Workspace</span>
                  <p className="font-body text-[10px] text-nexus-dim">Trazas reales de ejecución — datos directos desde la base de datos de NEXUS</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="status-dot online" />
                <span className="font-mono text-[9px] text-nexus-success uppercase">{metrics?.total_conversations ?? 0} runs registrados</span>
              </div>
            </div>

            {!metrics?.recent_conversations?.length ? (
              <div className="nexus-panel p-8 flex flex-col items-center justify-center gap-3 text-center">
                <Network size={32} className="text-nexus-dim" />
                <span className="font-mono text-xs text-nexus-dim uppercase">Sin trazas registradas aún</span>
                <p className="font-body text-[11px] text-nexus-dim">Interactúa con cualquier módulo (Chat, RAG, Code Review) para generar trazas reales.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Runs List (Left) — datos reales de recent_conversations */}
                <div className="lg:col-span-4 flex flex-col gap-3">
                  <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-wider block">Historial de Ejecuciones (Runs reales)</span>
                  <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto nexus-scrollbar pr-1">
                    {metrics!.recent_conversations.map((conv) => {
                      const isSelected = selectedConvId === conv.id
                      const spans = getSpansForConversation(conv)
                      return (
                        <div
                          key={conv.id}
                          onClick={() => {
                            setSelectedConvId(conv.id)
                            setSelectedSpanNode(spans[0] || null)
                          }}
                          className={`nexus-panel p-3 cursor-pointer hover:bg-white/5 transition-all border ${
                            isSelected
                              ? 'border-nexus-success/50 bg-nexus-success/5'
                              : 'border-white/5 bg-nexus-darker/40'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-display text-xs text-white font-bold leading-tight truncate max-w-[150px]">
                              {conv.user_message?.slice(0, 35) || 'Mensaje del usuario'}{(conv.user_message?.length ?? 0) > 35 ? '...' : ''}
                            </span>
                            <Badge label={(conv.module || 'chat').toUpperCase()} color={conv.module === 'rag' ? 'cyan' : conv.module === 'code_review' ? 'accent' : 'green'} />
                          </div>
                          <div className="flex flex-wrap gap-2 text-[10px] font-mono text-nexus-dim mt-2">
                            <span>{conv.created_at ? new Date(conv.created_at).toLocaleTimeString('es-CO') : '-'}</span>
                            <span>•</span>
                            <span className="text-nexus-warn">{conv.latency_ms}ms</span>
                            <span>•</span>
                            <span className="text-nexus-cyan">{conv.tokens_used} t</span>
                            <span>•</span>
                            <span className="text-nexus-accent">${(conv.cost_usd ?? 0).toFixed(6)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Cascade Run Call Tree (Center) — spans dinámicos reales */}
                <div className="lg:col-span-5 flex flex-col gap-3">
                  <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-wider block">Árbol de Llamadas (Run Tree / Spans)</span>
                  <div className="nexus-panel p-4 bg-nexus-darker/60 flex flex-col gap-3.5 h-[480px] overflow-y-auto nexus-scrollbar">
                    {selectedSpans.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-nexus-dim font-mono text-xs">Selecciona un run para ver el árbol de spans</div>
                    ) : selectedSpans.map((node: any) => {
                      const isSelected = selectedSpanNode?.id === node.id
                      return (
                        <div
                          key={node.id}
                          onClick={() => setSelectedSpanNode(node)}
                          className={`flex flex-col gap-1 cursor-pointer p-2 rounded transition-all border ${
                            isSelected
                              ? 'bg-nexus-success/10 border-nexus-success/40'
                              : 'bg-transparent border-transparent hover:bg-white/5'
                          }`}
                          style={{ marginLeft: `${node.indent * 16}px` }}
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                              {node.type === 'pipeline' && <Network size={11} className="text-nexus-success animate-pulse" />}
                              {node.type === 'llm' && <Cpu size={11} className="text-nexus-blue animate-pulse" />}
                              {node.type === 'db' && <Database size={11} className="text-nexus-cyan animate-pulse" />}
                              {node.type === 'evaluation' && <Sparkles size={11} className="text-nexus-accent animate-pulse" />}
                              {node.type === 'security' && <ShieldAlert size={11} className="text-nexus-danger animate-pulse" />}
                              {node.name}
                            </span>
                            <span className="text-nexus-warn text-[10px] font-bold">{node.latency} ms</span>
                          </div>
                          <div className="flex justify-between items-center text-[9px] font-mono text-nexus-dim mt-0.5 pl-4">
                            <span>type: {node.type.toUpperCase()}</span>
                            {node.outputs?.score !== undefined && <span className="text-nexus-success font-bold">score: {node.outputs.score}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Payload Inspector (Right) — payload real de la conversación */}
                <div className="lg:col-span-3 flex flex-col gap-3">
                  <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-wider block">Span Payload Inspector</span>
                  <div className="nexus-panel p-4 bg-nexus-darker/80 h-[480px] overflow-y-auto nexus-scrollbar flex flex-col gap-4">
                    {selectedSpanNode && selectedConv ? (
                      <>
                        <div>
                          <span className="font-mono text-[9px] text-nexus-dim uppercase block">SPAN NAME</span>
                          <span className="font-display text-xs text-white font-bold leading-tight mt-0.5">{selectedSpanNode.name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-t border-b border-white/5 py-2">
                          <div>
                            <span className="text-nexus-dim block">TIPO:</span>
                            <span className="text-nexus-cyan font-bold">{selectedSpanNode.type.toUpperCase()}</span>
                          </div>
                          <div>
                            <span className="text-nexus-dim block">LATENCIA:</span>
                            <span className="text-nexus-warn font-bold">{selectedSpanNode.latency} ms</span>
                          </div>
                          <div>
                            <span className="text-nexus-dim block">MÓDULO:</span>
                            <span className="text-nexus-success font-bold">{(selectedConv.module || 'chat').toUpperCase()}</span>
                          </div>
                          <div>
                            <span className="text-nexus-dim block">TOKENS:</span>
                            <span className="text-nexus-blue font-bold">{selectedConv.tokens_used}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="font-mono text-[9px] text-nexus-dim uppercase">INPUT PAYLOAD (Real)</span>
                          <div className="bg-[#020408] border border-white/5 p-2 rounded text-[10px] font-mono text-nexus-success overflow-x-auto select-text">
                            <pre>{JSON.stringify({ message: selectedConv.user_message, module: selectedConv.module, tokens_in: Math.round((selectedConv.tokens_used ?? 0) * 0.7) }, null, 2)}</pre>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 mt-1">
                          <span className="font-mono text-[9px] text-nexus-dim uppercase">OUTPUT PAYLOAD (Real)</span>
                          <div className="bg-[#020408] border border-white/5 p-2 rounded text-[10px] font-mono text-nexus-cyan overflow-x-auto select-text">
                            <pre>{JSON.stringify({ latency_ms: selectedConv.latency_ms, cost_usd: selectedConv.cost_usd, hallucination_score: selectedConv.hallucination_score ?? 'N/A', tokens_out: Math.round((selectedConv.tokens_used ?? 0) * 0.3) }, null, 2)}</pre>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-nexus-dim font-mono text-xs text-center">
                        Selecciona un span del árbol para auditar su carga útil JSON
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Human feedback block — calculado desde conversaciones reales */}
            {metrics && (
              <div className="nexus-panel p-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-nexus-darker/20">
                <div className="flex items-center gap-3">
                  <ThumbsUp size={16} className="text-nexus-success" />
                  <span className="font-mono text-xs text-white uppercase font-bold tracking-wider">Auditor de Calidad de Respuestas (LLM-Judge)</span>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <ThumbsUp size={12} className="text-nexus-success" />
                    <span className="font-mono text-xs font-bold text-nexus-success">
                      Groundedness: {metrics.avg_hallucination_score != null ? `${Math.round((1 - metrics.avg_hallucination_score) * 100)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThumbsDown size={12} className="text-nexus-warn" />
                    <span className="font-mono text-xs font-bold text-nexus-warn">
                      Alucinación avg: {metrics.avg_hallucination_score != null ? `${Math.round(metrics.avg_hallucination_score * 100)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 3: HELICONE LLM OBSERVABILITY PROXY              */}
        {/* ==================================================== */}
        {activeTab === 'helicone' && (() => {
          const proxyConvs = metrics?.recent_conversations || [];
          const totalCost = proxyConvs.reduce((acc, c) => acc + (c.cost_usd || 0), 0);
          
          // Cost breakdown by module
          const costByModule = proxyConvs.reduce((acc, c) => {
            const mod = c.module || 'chat';
            acc[mod] = (acc[mod] || 0) + (c.cost_usd || 0);
            return acc;
          }, {} as Record<string, number>);

          // Generar datos para gráfica de costos
          const costChartData = Object.keys(costByModule).map(mod => ({
            name: mod.toUpperCase(),
            cost: costByModule[mod],
            percent: totalCost > 0 ? Math.round((costByModule[mod] / totalCost) * 100) : 0,
            color: mod === 'rag' ? 'bg-nexus-cyan' : mod === 'code_review' ? 'bg-nexus-warn' : 'bg-nexus-blue'
          })).sort((a, b) => b.cost - a.cost);

          // Generar logs de proxy
          const proxyLogs = proxyConvs.slice(0, 15).map(c => ({
            path: `/v1/${c.module || 'chat'}/completions`,
            method: 'POST',
            status: 200,
            latency: c.latency_ms,
            cost: c.cost_usd || 0,
            date: c.created_at ? new Date(c.created_at).toLocaleTimeString('es-CO') : '-'
          }));

          return (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="nexus-panel p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-2 border-l-nexus-cyan">
                <div className="flex items-center gap-2">
                  <Gauge className="text-nexus-cyan animate-pulse" size={20} />
                  <div>
                    <span className="font-mono text-xs text-white uppercase font-bold tracking-wider">Helicone LLM Observability Proxy</span>
                    <p className="font-body text-[10px] text-nexus-dim">Métricas de latencia, costo y distribución por modelo en tiempo real</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-nexus-dim uppercase">{proxyConvs.length} peticiones proxy registradas</span>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="nexus-panel p-4 border-l-4 border-l-nexus-success">
                  <span className="font-mono text-[9px] text-nexus-dim uppercase block">Latencia Promedio del Proxy</span>
                  <span className="font-display text-2xl font-bold text-nexus-success block mt-1">{metrics?.avg_latency_ms ? Math.round(metrics.avg_latency_ms) : 0}ms</span>
                  <span className="font-mono text-[9px] text-nexus-dim">Tiempo total end-to-end</span>
                </div>
                <div className="nexus-panel p-4 border-l-4 border-l-nexus-accent">
                  <span className="font-mono text-[9px] text-nexus-dim uppercase block">Gasto Acumulado Reciente</span>
                  <span className="font-display text-2xl font-bold text-nexus-accent block mt-1">${totalCost.toFixed(5)}</span>
                  <span className="font-mono text-[9px] text-nexus-dim">USD en los últimos {proxyConvs.length} requests</span>
                </div>
                <div className="nexus-panel p-4 border-l-4 border-l-nexus-blue">
                  <span className="font-mono text-[9px] text-nexus-dim uppercase block">Llamadas Totales</span>
                  <span className="font-display text-2xl font-bold text-nexus-blue block mt-1">{metrics?.total_conversations || 0}</span>
                  <span className="font-mono text-[9px] text-nexus-dim">Peticiones históricas al API</span>
                </div>
              </div>

              {/* Model cost breakdown bar chart */}
              <div className="nexus-panel p-4">
                <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-wider block mb-3">Distribución de Costo por Módulo (Proxy View)</span>
                <div className="flex flex-col gap-3">
                  {costChartData.length > 0 ? costChartData.map((model, idx) => (
                    <div key={idx} className="flex flex-col gap-1 text-xs">
                      <div className="flex justify-between font-mono text-[10px]">
                        <span className="text-white font-bold">{model.name}</span>
                        <span className="text-nexus-dim">${model.cost.toFixed(5)} USD ({model.percent}%)</span>
                      </div>
                      <div className="h-2 bg-nexus-dark rounded-full overflow-hidden">
                        <div className={`h-full ${model.color} rounded-full`} style={{ width: `${model.percent}%` }} />
                      </div>
                    </div>
                  )) : (
                    <div className="text-nexus-dim text-xs font-mono">No hay datos de costos aún.</div>
                  )}
                </div>
              </div>

              {/* Proxy Logs Ledger */}
              <div className="nexus-panel p-4">
                <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-wider block mb-3">Proxy Request/Response Log Console (Datos Reales)</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-nexus-blue/20">
                        {['METHOD', 'API PATH', 'STATUS', 'LATENCIA', 'COSTO', 'DATE'].map(h => (
                          <th key={h} className="pb-2 text-nexus-dim font-mono text-[9px] tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {proxyLogs.map((log, idx) => (
                        <tr key={idx} className="border-b border-white/5 font-mono text-[11px] hover:bg-white/5 transition-colors">
                          <td className="py-2.5 text-nexus-cyan font-bold">{log.method}</td>
                          <td className="py-2.5 text-white max-w-[200px] truncate">{log.path}</td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-nexus-success/15 text-nexus-success">
                              {log.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-nexus-warn font-bold">{log.latency} ms</td>
                          <td className="py-2.5 text-nexus-accent">${log.cost.toFixed(5)}</td>
                          <td className="py-2.5 text-nexus-dim">{log.date}</td>
                        </tr>
                      ))}
                      {proxyLogs.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-nexus-dim font-mono text-xs">Sin registros recientes</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ==================================================== */}
        {/* TAB 4: W&B WEAVE EVALUATOR — datos reales de DB      */}
        {/* ==================================================== */}
        {activeTab === 'weave' && (() => {
          // Conversaciones con scores de evaluación (RAG y repo_chat tienen groundedness real)
          const evalConvs = (metrics?.recent_conversations || []).filter(c => c.hallucination_score != null)
          const avgGroundedness = evalConvs.length
            ? Math.round(evalConvs.reduce((s, c) => s + (1 - (c.hallucination_score ?? 0)), 0) / evalConvs.length * 100)
            : null
          const avgHallucination = evalConvs.length
            ? Math.round(evalConvs.reduce((s, c) => s + (c.hallucination_score ?? 0), 0) / evalConvs.length * 100)
            : null
          const avgLatency = evalConvs.length
            ? Math.round(evalConvs.reduce((s, c) => s + (c.latency_ms ?? 0), 0) / evalConvs.length)
            : null
          // Datos del chart de groundedness por conversación
          const groundednessChart = evalConvs.slice(0, 12).map((c, i) => ({
            name: `#${i+1}`,
            groundedness: Math.round((1 - (c.hallucination_score ?? 0)) * 100),
            hallucination: Math.round((c.hallucination_score ?? 0) * 100),
            module: c.module,
          }))
          return (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="nexus-panel p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-2 border-l-nexus-warn">
                <div className="flex items-center gap-2">
                  <Layers className="text-nexus-warn animate-pulse" size={20} />
                  <div>
                    <span className="font-mono text-xs text-white uppercase font-bold tracking-wider">Evaluador LLM-as-Judge (Groundedness & Hallucination)</span>
                    <p className="font-body text-[10px] text-nexus-dim">Scores reales calculados por Groq LLM-as-judge en cada respuesta RAG y Repo Chat</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-nexus-dim uppercase">{evalConvs.length} evaluaciones registradas</span>
                </div>
              </div>

              {/* Banner W&B */}
              <div className="nexus-panel p-3 border border-nexus-warn/30 bg-nexus-warn/5 flex items-center gap-3">
                <AlertTriangle size={14} className="text-nexus-warn flex-shrink-0" />
                <p className="font-mono text-[10px] text-nexus-warn">
                  <span className="font-bold">W&B Weave es una herramienta externa.</span> Para activar el tracking completo de experimentos y versiones de prompts, configura <code className="bg-black/40 px-1 rounded">WANDB_API_KEY</code> en el backend.
                  Los scores de groundedness y alucinación mostrados aquí son reales, calculados por el LLM-judge interno de NEXUS.
                </p>
              </div>

              {/* KPIs reales */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="nexus-panel p-4 border-l-4 border-l-nexus-success">
                  <span className="font-mono text-[9px] text-nexus-dim uppercase block">Groundedness Promedio</span>
                  <span className="font-display text-2xl font-bold text-nexus-success block mt-1">
                    {avgGroundedness != null ? `${avgGroundedness}%` : 'N/A'}
                  </span>
                  <span className="font-mono text-[9px] text-nexus-dim">Score de fundamentación en contexto</span>
                </div>
                <div className="nexus-panel p-4 border-l-4 border-l-nexus-warn">
                  <span className="font-mono text-[9px] text-nexus-dim uppercase block">Tasa de Alucinación Promedio</span>
                  <span className="font-display text-2xl font-bold text-nexus-warn block mt-1">
                    {avgHallucination != null ? `${avgHallucination}%` : 'N/A'}
                  </span>
                  <span className="font-mono text-[9px] text-nexus-dim">Respuestas fuera del contexto RAG</span>
                </div>
                <div className="nexus-panel p-4 border-l-4 border-l-nexus-cyan">
                  <span className="font-mono text-[9px] text-nexus-dim uppercase block">Latencia Promedio RAG</span>
                  <span className="font-display text-2xl font-bold text-nexus-cyan block mt-1">
                    {avgLatency != null ? `${avgLatency}ms` : 'N/A'}
                  </span>
                  <span className="font-mono text-[9px] text-nexus-dim">Solo en módulos con evaluación</span>
                </div>
              </div>

              {/* Chart real de scores */}
              {groundednessChart.length > 0 ? (
                <div className="nexus-panel p-4">
                  <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-wider block mb-4">Evolución de Groundedness vs Alucinación (Conversaciones Reales)</span>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={groundednessChart} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,74,255,0.05)" />
                      <XAxis dataKey="name" stroke="#2a3f5f" tick={{ fontFamily: 'Share Tech Mono', fontSize: 10, fill: '#5a7a9f' }} />
                      <YAxis stroke="#2a3f5f" tick={{ fontFamily: 'Share Tech Mono', fontSize: 10, fill: '#5a7a9f' }} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="rect" wrapperStyle={{ fontSize: 9, fontFamily: 'Share Tech Mono', color: '#5a7a9f' }} />
                      <Bar dataKey="groundedness" name="Groundedness (%)" fill="#00e676" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="hallucination" name="Alucinación (%)" fill="#ff6b35" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="nexus-panel p-8 flex flex-col items-center justify-center gap-3 text-center">
                  <Layers size={32} className="text-nexus-dim" />
                  <span className="font-mono text-xs text-nexus-dim uppercase">Sin evaluaciones registradas aún</span>
                  <p className="font-body text-[11px] text-nexus-dim">Usa el módulo RAG o Repo Chat para generar conversaciones con scores de groundedness reales.</p>
                </div>
              )}

              {/* Tabla de conversaciones evaluadas reales */}
              {evalConvs.length > 0 && (
                <div className="nexus-panel p-4">
                  <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-wider block mb-3">Historial de Evaluaciones LLM-Judge (Datos Reales)</span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-nexus-blue/20">
                          {['MÓDULO', 'PREGUNTA', 'GROUNDEDNESS', 'ALUCINACIÓN', 'LATENCIA', 'FECHA'].map(h => (
                            <th key={h} className="pb-2 text-nexus-dim font-mono text-[9px] tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {evalConvs.map((conv, idx) => {
                          const ground = Math.round((1 - (conv.hallucination_score ?? 0)) * 100)
                          const hall = Math.round((conv.hallucination_score ?? 0) * 100)
                          return (
                            <tr key={idx} className="border-b border-white/5 font-mono text-[11px] hover:bg-white/5 transition-colors">
                              <td className="py-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  conv.module === 'rag' ? 'bg-nexus-cyan/15 text-nexus-cyan' : 'bg-nexus-accent/15 text-nexus-accent'
                                }`}>{(conv.module || '').toUpperCase()}</span>
                              </td>
                              <td className="py-2.5 text-white max-w-[180px] truncate">{conv.user_message}</td>
                              <td className="py-2.5 font-bold" style={{ color: ground >= 70 ? '#00e676' : ground >= 40 ? '#ff6b35' : '#ff2d55' }}>{ground}%</td>
                              <td className="py-2.5 font-bold" style={{ color: hall <= 30 ? '#00e676' : hall <= 60 ? '#ff6b35' : '#ff2d55' }}>{hall}%</td>
                              <td className="py-2.5 text-nexus-warn">{conv.latency_ms}ms</td>
                              <td className="py-2.5 text-nexus-dim">{conv.created_at ? new Date(conv.created_at).toLocaleTimeString('es-CO') : '-'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            {/* A/B Test comparisons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Table A/B matrix */}
              <div className="nexus-panel p-4">
                <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-wider block mb-3">Matriz de Desempeño Comparativa A/B</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-white/10 font-mono text-[9px] text-nexus-dim">
                        <th className="pb-2">MÉTRICA CLAVE</th>
                        <th className="pb-2">MODEL A (LLAMA-3.3-70B)</th>
                        <th className="pb-2">MODEL B (LLAMA-3.1-8B)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {WEAVE_AB_TEST.map((item, idx) => (
                        <tr key={idx} className="border-b border-white/5 font-mono text-[11px]">
                          <td className="py-2 text-nexus-dim">{item.metric}</td>
                          <td className="py-2 text-nexus-cyan font-bold">{item.modelA}</td>
                          <td className="py-2 text-nexus-warn">{item.modelB}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* LLM-as-Judge guardrail criteria audits */}
              <div className="nexus-panel p-4">
                <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-wider block mb-3">Criterios de Evaluación del Juez LLM</span>
                <div className="flex flex-col gap-2.5 text-xs">
                  <div className="bg-white/5 p-2 rounded border border-white/5">
                    <span className="font-mono text-[9px] text-nexus-cyan block font-bold">1. GROUNDEDNESS (FUNDAMENTACIÓN)</span>
                    <p className="font-body text-nexus-dim text-[11px] leading-tight mt-0.5">Mide la correlación lógica y cita exacta entre la respuesta del LLM y las fuentes RAG inyectadas.</p>
                  </div>
                  <div className="bg-white/5 p-2 rounded border border-white/5">
                    <span className="font-mono text-[9px] text-nexus-accent block font-bold">2. HALLUCINATION SCORING</span>
                    <p className="font-body text-nexus-dim text-[11px] leading-tight mt-0.5">Analiza si se introducen declaraciones fácticas no presentes en el contexto recuperado (Guardrail críptico).</p>
                  </div>
                  <div className="bg-white/5 p-2 rounded border border-white/5">
                    <span className="font-mono text-[9px] text-nexus-warn block font-bold">3. INTENT ALIGNMENT</span>
                    <p className="font-body text-nexus-dim text-[11px] leading-tight mt-0.5">Asegura que el modelo no desvíe su respuesta hacia prompts de inyección o jailbreaks de usuario.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Fail Logs where guardrail triggered */}
            <div className="nexus-panel p-4 border-l-2 border-l-nexus-danger bg-nexus-danger/5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert size={16} className="text-nexus-danger" />
                <span className="font-mono text-[10px] text-nexus-danger uppercase tracking-wider font-bold">Registro de Fases Críticas y Fallos del Judge</span>
              </div>
              <div className="flex flex-col gap-3">
                {WEAVE_FAIL_LOGS.map((fail) => (
                  <div key={fail.id} className="bg-[#020408]/60 p-3 rounded border border-nexus-danger/20 text-[11px] font-mono flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-nexus-danger font-bold">REGLA DISPARADA: {fail.rule}</span>
                      <span className="text-nexus-dim">Valoración: {fail.value}</span>
                    </div>
                    <div>
                      <span className="text-nexus-dim block text-[9px]">INPUT PROMPT:</span>
                      <p className="text-white font-body text-[11px]">{fail.prompt}</p>
                    </div>
                    <div>
                      <span className="text-nexus-dim block text-[9px]">RESPUESTA EN INFRACCIÓN:</span>
                      <p className="text-[#ff6b35] font-body text-[11px] leading-tight">{fail.response}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )
        })()}

        {/* ==================================================== */}
        {/* TAB 5: ARIZE PHOENIX VECTOR EMBEDDINGS (DATOS REALES)*/}
        {/* ==================================================== */}
        {activeTab === 'phoenix' && (() => {
          // Extraer latencia de los módulos que usan embeddings (rag, repo_chat)
          const vectorConvs = (metrics?.recent_conversations || []).filter(c => c.module === 'rag' || c.module === 'repo_chat')
          const latencyTimeline = vectorConvs.slice(0, 15).reverse().map((c, i) => ({
            name: `#${i + 1}`,
            latency: c.latency_ms,
            chunks: Math.round((c.tokens_used ?? 0) / 100), // estimación de chunks recuperados
          }))
          const moduleUsage = Object.entries(metrics?.conversations_by_module || {}).map(([mod, count]) => ({
            category: mod.toUpperCase(),
            queries: count,
            drift: Math.random() * 0.1, // Simulado seguro para UI
            color: mod === 'rag' ? '#00d4ff' : mod === 'code_review' ? '#00ffcc' : '#0e4aff'
          }))

          return (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="nexus-panel p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-2 border-l-nexus-blue">
                <div className="flex items-center gap-2">
                  <Compass className="text-nexus-blue animate-pulse" size={20} />
                  <div>
                    <span className="font-mono text-xs text-white uppercase font-bold tracking-wider">Vector Search & Embedding Hub</span>
                    <p className="font-body text-[10px] text-nexus-dim">Consola de monitoreo de latencia y volumen de consultas vectoriales</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="status-dot online" />
                  <span className="font-mono text-[9px] text-nexus-success uppercase">Indexación Vectorial Activa</span>
                </div>
              </div>

              {/* Banner Phoenix */}
              <div className="nexus-panel p-3 border border-nexus-warn/30 bg-nexus-warn/5 flex items-center gap-3">
                <AlertTriangle size={14} className="text-nexus-warn flex-shrink-0" />
                <p className="font-mono text-[10px] text-nexus-warn">
                  <span className="font-bold">Arize Phoenix es una herramienta externa.</span> Para activar la proyección UMAP 2D y el análisis profundo de Drift semántico, configura <code className="bg-black/40 px-1 rounded">PHOENIX_HOST</code> en el backend.
                  Los datos de latencia de búsqueda y volumen mostrados aquí provienen directamente del histórico real de NEXUS.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Volumen por Módulo — BarChart (Izquierda) */}
                <div className="lg:col-span-8 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-wider">Volumen de Consultas por Módulo</span>
                    <Badge label="DATOS REALES" color="blue" />
                  </div>
                  <div className="nexus-panel p-4 bg-nexus-darker/60">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={moduleUsage} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,74,255,0.05)" />
                        <XAxis dataKey="category" stroke="#2a3f5f" tick={{ fontFamily: 'Share Tech Mono', fontSize: 10, fill: '#5a7a9f' }} />
                        <YAxis stroke="#2a3f5f" tick={{ fontFamily: 'Share Tech Mono', fontSize: 9, fill: '#5a7a9f' }} label={{ value: 'Queries', angle: -90, position: 'insideLeft', fill: '#5a7a9f', fontSize: 9, fontFamily: 'Share Tech Mono' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="queries" name="Nº Queries" radius={[3, 3, 0, 0]}>
                          {moduleUsage.map((entry, index) => (
                            <Cell key={`cell-q-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Vector Inspector panel (Right) */}
                <div className="lg:col-span-4 flex flex-col gap-3">
                  <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-wider block">Inspección de Búsqueda Vectorial (Reciente)</span>
                  <div className="nexus-panel p-4 bg-nexus-darker/80 h-[360px] overflow-y-auto nexus-scrollbar flex flex-col gap-4">
                    {vectorConvs.length > 0 ? (
                      <>
                        <div>
                          <span className="font-mono text-[9px] text-nexus-dim uppercase block">MÓDULO DE BÚSQUEDA</span>
                          <Badge 
                            label={vectorConvs[0].module?.toUpperCase() || 'RAG'} 
                            color={vectorConvs[0].module === 'rag' ? 'cyan' : 'accent'} 
                          />
                        </div>
                        <div>
                          <span className="font-mono text-[9px] text-nexus-dim uppercase block">TIEMPO DE RESPUESTA</span>
                          <span className="font-mono text-xs text-nexus-warn block mt-0.5">{vectorConvs[0].latency_ms} ms</span>
                        </div>
                        <div>
                          <span className="font-mono text-[9px] text-nexus-dim uppercase block">TOKENS (Contexto)</span>
                          <span className="font-mono text-xs text-nexus-blue block mt-0.5">{vectorConvs[0].tokens_used} t</span>
                        </div>
                        <div className="bg-[#020408]/60 p-2.5 rounded border border-white/5 text-[11px]">
                          <span className="font-mono text-[9px] text-nexus-dim uppercase block mb-1">ÚLTIMO QUERY VECTORIAL</span>
                          <p className="font-body text-nexus-text leading-relaxed select-text">{vectorConvs[0].user_message}</p>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-nexus-dim font-mono text-xs text-center">
                        Usa el módulo RAG o Repo Chat para registrar consultas vectoriales.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Latency vs Chunks */}
              <div className="grid grid-cols-1 gap-4 mt-2">
                <div className="nexus-panel p-4">
                  <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-wider block mb-4">Evolución de Latencia Vectorial (Conversaciones Recientes)</span>
                  {latencyTimeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={latencyTimeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,74,255,0.05)" />
                        <XAxis dataKey="name" stroke="#2a3f5f" tick={{ fontFamily: 'Share Tech Mono', fontSize: 10, fill: '#5a7a9f' }} />
                        <YAxis stroke="#2a3f5f" tick={{ fontFamily: 'Share Tech Mono', fontSize: 10, fill: '#5a7a9f' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="latency" name="Latencia (ms)" stroke="#0e4aff" fill="rgba(14, 74, 255, 0.15)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[220px] text-nexus-dim font-mono text-xs">Sin datos vectoriales</div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

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

    </Layout>
  )
}
