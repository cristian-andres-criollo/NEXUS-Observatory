import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMetrics, useCostHistory, useLatencyHistory } from '../hooks/useMetrics';
import { adminAPI, AdminDashboardData, ProjectOut } from '../lib/api';
import toast from 'react-hot-toast';
import { formatCurrency, convertUsdTo } from '../lib/currency';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, Cell
} from 'recharts';
import { Activity, Server, Clock, DollarSign, Filter, Search, Users, Edit2, Save, X, Sparkles } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-200 text-sm">
        <p className="font-semibold text-slate-700 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const NEXUS_PALETTE = ['#6366f1', '#4f46e5', '#818cf8', '#4338ca', '#a5b4fc'];

export function Dashboard() {
  const { user } = useAuth();
  
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  
  // Custom metrics hooks with dynamic project_id
  const [metrics, setMetrics] = useState<any>(null);
  const [latencyHistory, setLatencyHistory] = useState<any[]>([]);
  const [costHistory, setCostHistory] = useState<any[]>([]);
  const [traces, setTraces] = useState<any[]>([]);
  const [projectUsers, setProjectUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingLimit, setEditingLimit] = useState<string>('');
  
  // Ref para no spamear toasts
  const [notifiedLevel, setNotifiedLevel] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminData();
  }, []);
  
  useEffect(() => {
    // When selected agent changes, fetch specific metrics
    fetchMetrics(selectedAgentId);
    if (selectedAgentId) fetchProjectUsers(selectedAgentId);
    else setProjectUsers([]);
  }, [selectedAgentId]);

  const fetchAdminData = async () => {
    try {
      const res = await adminAPI.getDashboard();
      setAdminData(res.data);
      if (res.data.projects) {
        setProjects(res.data.projects);
      }
    } catch (e) {
      console.log('Error admin data', e);
    }
  };
  
  const fetchMetrics = async (projectId: number | null) => {
     try {
       const token = localStorage.getItem('nexus_token');
       const headers = { Authorization: `Bearer ${token}` };
       
       const query = projectId ? `?project_id=${projectId}` : '';
       
       const metricsRes = await fetch(`http://127.0.0.1:8000/api/v1/metrics/${query}`, { headers });
       const metricsData = await metricsRes.json();
       setMetrics(metricsData);
       
       const latencyRes = await fetch(`http://127.0.0.1:8000/api/v1/metrics/latency${query}`, { headers });
       setLatencyHistory(await latencyRes.json());
       
       const costRes = await fetch(`http://127.0.0.1:8000/api/v1/metrics/cost${query}`, { headers });
       setCostHistory(await costRes.json());
       
       if (projectId) {
         setTraces(metricsData.recent_conversations || []);
       } else {
         setTraces([]);
       }
     } catch (e) {
         console.error("Error fetching dynamic metrics", e);
     }
  };

  const fetchProjectUsers = async (projectId: number) => {
    setLoadingUsers(true);
    try {
      const res = await adminAPI.listProjectUsers(projectId);
      setProjectUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      setProjectUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAutoDistribute = async () => {
    if (!selectedAgentId) return;
    try {
      const res = await adminAPI.autoDistributeProjectUsers(selectedAgentId);
      toast.success(res.data.message);
      fetchProjectUsers(selectedAgentId);
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Error al distribuir presupuesto");
    }
  };

  const saveUserLimit = async (u: any) => {
    if (!selectedAgentId) return;
    try {
      const budget = parseFloat(editingLimit);
      if (isNaN(budget) || budget < 0) {
        toast.error("Presupuesto inválido");
        return;
      }
      
      if (u.id) {
        await adminAPI.updateProjectUserLimit(selectedAgentId, u.id, budget);
      } else {
        await adminAPI.createProjectUserLimit(selectedAgentId, u.user_identifier, budget);
      }
      toast.success("Límite actualizado");
      setEditingUserId(null);
      fetchProjectUsers(selectedAgentId);
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Error al actualizar límite");
    }
  };

  // Cálculos de presupuesto y tokens
  const tokensUsed = metrics?.total_tokens ?? 0;
  const costUsd = metrics?.total_cost_usd ?? 0;
  
  // Moneda y costo total (dinámico)
  const targetCurrency = (user?.currency as string) || 'COP';
  const trmRates = adminData?.trm_rates || {};
  const costInCurrency = convertUsdTo(costUsd, targetCurrency, trmRates);
  
  // Si estamos viendo un agente, el budget es el del agente. Si es global, es el de adminData.
  let budgetInCurrency = adminData?.budget_cop || 100000; 
  if (selectedAgentId) {
      const proj = projects.find(p => p.id === selectedAgentId);
      if (proj) {
          budgetInCurrency = proj.budget_cop;
      }
  }
  
  if (targetCurrency !== 'COP') {
    // Si cambia de moneda, deducimos el budget original (COP) a USD, y luego a la nueva moneda.
    const trmCop = adminData?.trm_usd_cop || 4000;
    const budgetUsd = budgetInCurrency / trmCop;
    budgetInCurrency = convertUsdTo(budgetUsd, targetCurrency, trmRates);
  }
  
  const percentageUsed = budgetInCurrency > 0 ? (costInCurrency / budgetInCurrency) * 100 : 0;
  const percentageAvailable = Math.max(0, 100 - percentageUsed);
  const estimatedTotalTokens = percentageUsed > 0 
    ? Math.floor(tokensUsed / (percentageUsed / 100)) 
    : (adminData ? Math.floor((adminData.budget_cop / adminData.trm_usd_cop) / adminData.groq_cost_per_million * 1_000_000) : 0);
  
  // Semáforo:
  let statusColor = 'bg-slate-200';
  let textColor = 'text-slate-500';
  let currentLevel = 'neutral';
  
  if (percentageAvailable > 50) {
    statusColor = 'bg-emerald-500'; textColor = 'text-emerald-600'; currentLevel = 'verde';
  } else if (percentageAvailable > 10) {
    statusColor = 'bg-yellow-400'; textColor = 'text-yellow-600'; currentLevel = 'amarillo';
  } else if (percentageAvailable > 0) {
    statusColor = 'bg-orange-500'; textColor = 'text-orange-600'; currentLevel = 'naranja';
  } else {
    statusColor = 'bg-rose-500'; textColor = 'text-rose-600'; currentLevel = 'rojo';
  }

  // Lógica de notificaciones
  useEffect(() => {
    if (percentageAvailable <= 0) return; // Evitar disparar al inicio sin cargar

    if (currentLevel === 'naranja' && notifiedLevel !== 'naranja') {
      toast.error(`¡Atención! Queda menos del 50% del presupuesto disponible.`, { icon: '⚠️' });
      setNotifiedLevel('naranja');
    } else if (currentLevel === 'rojo' && notifiedLevel !== 'rojo') {
      toast.error('¡ALERTA CRÍTICA! Presupuesto casi agotado (<10%).', { icon: '🚨', duration: 8000 });
      setNotifiedLevel('rojo');
    } else if (currentLevel === 'verde' && notifiedLevel && notifiedLevel !== 'verde') {
      toast.success('El presupuesto ha vuelto a un nivel óptimo.');
      setNotifiedLevel('verde');
    }
  }, [currentLevel, percentageAvailable]);


  const moduleData = metrics?.conversations_by_module
    ? Object.entries(metrics.conversations_by_module)
        .filter(([_, count]) => (count as number) > 0)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .map(([key, count], i) => {
          let fName = key;
          if (key === 'chat') fName = 'Chat Normal';
          else if (key === 'code_review') fName = 'Code Review';
          else if (key === 'repo_agent') fName = 'Repo Agent';
          else if (key.startsWith('proxy_')) {
            // Remove 'proxy_' and capitalize
            fName = key.replace('proxy_', '').replace(/_/g, ' ');
            fName = fName.replace(/\b\w/g, l => l.toUpperCase());
            // Si el nombre del agente es igual al modulo, mostrar "Chat Normal (Agente)" o algo,
            // pero para ser fieles a lo que pide, si es proxy_agente_de_prueba mostrará "Agente De Prueba".
            // Para futuras peticiones con X-Nexus-Function, se verán directamente los nombres.
          }

          // Ajuste especial si resulta en el nombre del agente debido a registros anteriores
          if (selectedAgentId) {
             const proj = projects.find(p => p.id === selectedAgentId);
             if (proj && fName.toLowerCase() === proj.name.toLowerCase()) {
                 fName = 'Chat Normal';
             }
          }

          return {
            name: fName,
            count,
            color: NEXUS_PALETTE[i % NEXUS_PALETTE.length],
          };
        })
    : [];

  let chartData = (metrics?.recent_conversations || [])
    .slice()
    .reverse()
    .map((trace: any) => {
      let dateObj = new Date();
      if (trace.created_at) {
         // Fix for Safari/Firefox: remove microseconds and ensure proper ISO format
         const cleanDate = trace.created_at.replace('Z', '').split('.')[0].replace(' ', 'T') + 'Z';
         dateObj = new Date(cleanDate);
      }
      const isValid = !isNaN(dateObj.getTime());
      
      return {
        name: isValid ? dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A',
        Tokens: trace.tokens_used || 0,
      };
    });
  


  // VISTA 1: LISTA DE AGENTES (Cuando no hay ninguno seleccionado)
  if (!selectedAgentId) {
    return (
      <div className="h-full bg-slate-50 text-slate-800 font-sans p-4 lg:p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Agentes de IA</h1>
        <p className="text-slate-500 mb-8">Selecciona un agente para ver sus métricas detalladas y trazas de comportamiento.</p>

        {projects.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
              <Server className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Ningún Agente Conectado</h3>
            <p className="text-slate-500 max-w-md">No tienes agentes de IA registrados. Ve a los ajustes para registrar tu primer agente y generar una API Key.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(p => (
              <div 
                key={p.id}
                onClick={() => setSelectedAgentId(p.id)}
                className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-blue-300 hover:shadow-lg cursor-pointer transition-all duration-300 group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                    <Activity className="w-6 h-6" />
                  </div>
                  {p.is_active ? 
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ACTIVO
                    </span>
                  : 
                    <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold">INACTIVO</span>
                  }
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-1">{p.name}</h3>
                <p className="text-slate-500 text-sm mb-4 line-clamp-2 min-h-[40px]">{p.description || 'Agente sin descripción.'}</p>
                
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-slate-400">Presupuesto:</span><br/>
                    <strong className="text-slate-700">{formatCurrency(targetCurrency !== 'COP' ? convertUsdTo(p.budget_cop / (adminData?.trm_usd_cop || 4000), targetCurrency, trmRates) : p.budget_cop, targetCurrency)}</strong>
                  </div>
                  <div className="text-sm text-right">
                    <span className="text-slate-400">Consumo:</span><br/>
                    <strong className="text-slate-700">{formatCurrency(targetCurrency !== 'COP' ? convertUsdTo(p.spent_cop / (adminData?.trm_usd_cop || 4000), targetCurrency, trmRates) : p.spent_cop, targetCurrency)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // VISTA 2: DASHBOARD DETALLADO DEL AGENTE SELECCIONADO
  return (
    <div className="h-full bg-slate-50 text-slate-800 font-sans p-4 lg:p-8 overflow-y-auto">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedAgentId(null)}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500"
                title="Volver a la lista"
              >
                ← Volver
              </button>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-blue-600" />
                  Métricas: {projects.find(p => p.id === selectedAgentId)?.name}
              </h1>
          </div>
      </div>

      {/* Grid Layout Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* COLUMNA IZQUIERDA */}
        <div className="flex flex-col gap-6">
          
          {/* Razones de los tokens (Uso por módulo) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
             <h2 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Distribución de Peticiones</h2>
             <div className="h-48">
              {moduleData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={moduleData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={120} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                      {moduleData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sin datos para mostrar</div>
              )}
             </div>
          </div>

          {/* Gráficas de Uso */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-6">
             <div>
               <h2 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Tendencia de Uso (Tokens)</h2>
               <div className="h-48">
                  {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                          <Bar dataKey="Tokens" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                  ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sin historial de uso</div>
                  )}
               </div>
               <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-500">Total de Peticiones Registradas:</span>
                  <span className="font-bold text-slate-800 text-base">{metrics?.total_conversations || 0}</span>
               </div>
             </div>
          </div>

        </div>

        {/* COLUMNA DERECHA */}
        <div className="flex flex-col gap-6">

          {/* Cantidad de Tokens y Presupuesto */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
             <h2 className="text-lg font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2">Control de Presupuesto</h2>
             
             <div className="grid grid-cols-3 gap-3 mb-6">
               <div className="p-3 bg-slate-50 rounded-2xl text-center border border-slate-100">
                  <div className="text-xs font-semibold text-slate-500 mb-1">Tokens Consumidos</div>
                  <div className="text-xl font-bold text-slate-800">{tokensUsed.toLocaleString()}</div>
               </div>
               <div className="p-3 bg-slate-50 rounded-2xl text-center border border-slate-100">
                  <div className="text-xs font-semibold text-slate-500 mb-1">Tokens Totales (Est.)</div>
                  <div className="text-xl font-bold text-slate-600">{estimatedTotalTokens.toLocaleString()}</div>
               </div>
               <div className="p-3 bg-slate-50 rounded-2xl text-center border border-slate-100">
                  <div className="text-xs font-semibold text-slate-500 mb-1">Presupuesto Restante</div>
                  <div className={`text-xl font-bold ${textColor}`}>{percentageAvailable.toFixed(1)}%</div>
               </div>
             </div>

             <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-5">
                    <DollarSign className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                    <div className="text-sm font-semibold text-slate-500 mb-2">Asignación en {targetCurrency}</div>
                    <div className="text-3xl font-bold text-slate-800 mb-1">{formatCurrency(budgetInCurrency, targetCurrency)}</div>
                    <div className="text-sm font-bold text-slate-700 mt-2">Gastado: <span className="text-rose-600">{formatCurrency(costInCurrency, targetCurrency)}</span></div>
                    
                    {/* Barra de progreso */}
                    <div className="w-full bg-slate-200 rounded-full h-3 mt-4 overflow-hidden">
                    <div 
                        className={`h-3 rounded-full transition-all duration-500 ${percentageAvailable > 50 ? 'bg-emerald-500' : percentageAvailable > 10 ? 'bg-orange-500' : 'bg-rose-500'}`} 
                        style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                    ></div>
                    </div>
                </div>
             </div>
          </div>

          {/* Nivel de Colores (Semáforo) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex-1">
             <h2 className="text-lg font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2">Estado de Salud</h2>
             
             <div className="flex flex-col gap-4">
                <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${currentLevel === 'verde' ? 'border-emerald-300 bg-emerald-50 shadow-sm' : 'border-slate-100 bg-slate-50 opacity-50'}`}>
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-inner">
                      {currentLevel === 'verde' && <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>}
                  </div>
                  <div>
                    <div className="font-bold text-emerald-800">Óptimo (Verde)</div>
                    <div className="text-xs text-emerald-600/80">&gt; 50% del presupuesto disponible.</div>
                  </div>
                </div>

                <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${currentLevel === 'amarillo' ? 'border-yellow-300 bg-yellow-50 shadow-sm' : 'border-slate-100 bg-slate-50 opacity-50'}`}>
                  <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center shrink-0 shadow-inner">
                      {currentLevel === 'amarillo' && <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>}
                  </div>
                  <div>
                    <div className="font-bold text-yellow-800">Precaución (Amarillo)</div>
                    <div className="text-xs text-yellow-600/80">10% - 50% del presupuesto disponible.</div>
                  </div>
                </div>

                <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${currentLevel === 'naranja' ? 'border-orange-300 bg-orange-50 shadow-sm' : 'border-slate-100 bg-slate-50 opacity-50'}`}>
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shrink-0 shadow-inner">
                      {currentLevel === 'naranja' && <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>}
                  </div>
                  <div>
                    <div className="font-bold text-orange-800">Alerta (Naranja)</div>
                    <div className="text-xs text-orange-600/80">&lt; 10% del presupuesto. Acciones limitadas.</div>
                  </div>
                </div>
                
                <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${currentLevel === 'rojo' ? 'border-rose-300 bg-rose-50 shadow-sm' : 'border-slate-100 bg-slate-50 opacity-50'}`}>
                  <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center shrink-0 shadow-inner">
                      {currentLevel === 'rojo' && <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>}
                  </div>
                  <div>
                    <div className="font-bold text-rose-800">Bloqueado (Rojo)</div>
                    <div className="text-xs text-rose-600/80">Presupuesto agotado. Peticiones bloqueadas.</div>
                  </div>
                </div>
             </div>
          </div>

        </div>

      </div>

      {/* SECCIÓN DE TRAZAS (Solo visible si hay un agente seleccionado) */}
      {/* Tabla de Usuarios */}
      <div className="mt-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 border-b border-slate-100 pb-4 gap-3">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Usuarios del Agente
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoDistribute}
              className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl px-4 py-2 transition-colors flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Distribuir en Igualdad
            </button>
            <button
              onClick={() => fetchProjectUsers(selectedAgentId!)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 rounded-xl px-4 py-2 transition-colors"
            >
              Actualizar
            </button>
          </div>
        </div>

        {loadingUsers ? (
          <div className="flex justify-center py-8 text-slate-400">Cargando usuarios...</div>
        ) : projectUsers.length === 0 ? (
          <div className="text-center text-slate-400 py-8 border-2 border-dashed border-slate-100 rounded-2xl">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="font-semibold text-sm">Sin usuarios registrados</p>
            <p className="text-xs mt-1">Las peticiones con <code className="bg-slate-100 px-1 rounded">X-Nexus-End-User-ID</code> aparecerán aquí automáticamente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tokens Gastados (COP est.)</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Límite</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">% Uso</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {projectUsers.map((u: any, i: number) => {
                  const trm = adminData?.trm_usd_cop || 4000;
                  const spentCop = u.spent_cop || 0;
                  const limitCop = u.budget_cop || null;
                  const pct = limitCop && limitCop > 0 ? Math.min((spentCop / limitCop) * 100, 100) : null;
                  return (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0">
                            {u.user_identifier?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span className="font-medium text-slate-700 truncate max-w-[250px]">{u.user_identifier}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800">
                        {formatCurrency(convertUsdTo(spentCop / trm, targetCurrency, trmRates), targetCurrency)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {editingUserId === u.user_identifier ? (
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="number"
                              value={editingLimit}
                              onChange={e => setEditingLimit(e.target.value)}
                              className="w-24 text-right px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-100"
                              placeholder="COP"
                              autoFocus
                            />
                            <button onClick={() => saveUserLimit(u)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                              <Save className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingUserId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-3 group/edit">
                            {limitCop ? formatCurrency(convertUsdTo(limitCop / trm, targetCurrency, trmRates), targetCurrency) : <span className="text-slate-300">Sin límite</span>}
                            <button 
                              onClick={() => { setEditingUserId(u.user_identifier); setEditingLimit(limitCop ? limitCop.toString() : ''); }}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shadow-sm"
                              title="Editar límite"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {pct !== null ? (
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-1.5 rounded-full ${pct > 80 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-xs font-bold ${pct > 80 ? 'text-rose-600' : 'text-slate-500'}`}>{pct.toFixed(0)}%</span>
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                          u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {u.is_active ? 'Activo' : 'Bloqueado'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trazas */}
      <div className="mt-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-500" />
                  Trazas Recientes del Agente
              </h2>
              <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">En tiempo real</span>
          </div>
          
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                      <tr>
                          <th className="px-4 py-3 rounded-tl-lg">Fecha/Hora</th>
                          <th className="px-4 py-3 w-1/3">Prompt Enviado</th>
                          <th className="px-4 py-3 w-1/3">Respuesta (Extracto)</th>
                          <th className="px-4 py-3 text-center">Tokens</th>
                          <th className="px-4 py-3 text-center">Latencia</th>
                          <th className="px-4 py-3 rounded-tr-lg text-right">Costo (USD)</th>
                      </tr>
                  </thead>
                  <tbody>
                      {traces.length === 0 ? (
                          <tr>
                              <td colSpan={6} className="text-center py-8 text-slate-400">
                                  No hay trazas registradas para este agente aún.
                              </td>
                          </tr>
                      ) : traces.map((trace, idx) => (
                          <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 align-top">
                              <td className="px-4 py-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                                  {(() => {
                                     if (!trace.created_at) return 'N/A';
                                     const cleanDate = trace.created_at.replace('Z', '').split('.')[0].replace(' ', 'T') + 'Z';
                                     const d = new Date(cleanDate);
                                     return !isNaN(d.getTime()) ? d.toLocaleString() : 'N/A';
                                  })()}
                              </td>
                              <td className="px-4 py-4 text-slate-700">
                                  <div className="max-h-20 overflow-y-auto text-xs bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                                      {trace.user_message}
                                  </div>
                              </td>
                              <td className="px-4 py-4 text-slate-700">
                                  <div className="max-h-20 overflow-y-auto text-xs bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                                      {trace.assistant_message}
                                  </div>
                              </td>
                              <td className="px-4 py-4 text-center font-bold text-blue-600">{trace.tokens_used}</td>
                              <td className="px-4 py-4 text-center text-slate-500">{trace.latency_ms}ms</td>
                              <td className="px-4 py-4 text-right font-medium text-emerald-600">${(trace.cost_usd || 0).toFixed(4)}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
}
