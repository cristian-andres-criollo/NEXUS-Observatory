import React, { useEffect, useState } from 'react';
import { DollarSign, Save, Wallet, TrendingDown, PieChart, Info, Server, ArrowLeft } from 'lucide-react';
import { adminAPI, AdminDashboardData } from '../lib/api';
import { useMetrics, useCostHistory } from '../hooks/useMetrics';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, convertUsdTo } from '../lib/currency';
import toast from 'react-hot-toast';
import { Spinner } from '../components/ui/Spinner';

export function FinOpsModule() {
  const { user } = useAuth();
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [localCurrency, setLocalCurrency] = useState<string>(user?.currency || 'COP');

  const { metrics, loading: loadingMetrics } = useMetrics(false, true, 10000, selectedAgentId || undefined);
  const { data: costHistory } = useCostHistory(false, 25, selectedAgentId || undefined);
  
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [error, setError] = useState('');

  // Estados de presupuesto
  const [newBudgetInput, setNewBudgetInput] = useState('');
  const [newTrm, setNewTrm] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  const fetchFinopsData = async () => {
    try {
      const adminRes = await adminAPI.getDashboard();
      setAdminData(adminRes.data);
      if (adminRes.data) {
        setNewTrm(formatDecimal(Number(adminRes.data.trm_usd_cop).toFixed(2)));
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error cargando datos de FinOps');
    } finally {
      setLoadingAdmin(false);
    }
  };

  useEffect(() => {
    fetchFinopsData();
  }, []);

  useEffect(() => {
    if (selectedAgentId && adminData?.projects) {
      const proj = adminData.projects.find(p => p.id === selectedAgentId);
      if (proj) {
        let b = proj.budget_cop;
        if (localCurrency !== 'COP') {
          const usd = b / (adminData.trm_usd_cop || 4000);
          b = convertUsdTo(usd, localCurrency, adminData.trm_rates);
        }
        setNewBudgetInput(Math.round(b).toString());
      }
    }
  }, [selectedAgentId, adminData, localCurrency]);

  const formatCOP = (raw: string) => {
    const digits = raw.replace(/\./g, '');
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const formatDecimal = (raw: string) => {
    let val = raw.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
    const [intPart, decimalPart] = val.split('.');
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decimalPart !== undefined ? `${formattedInt}.${decimalPart}` : formattedInt;
  };

  const updateBudget = async () => {
    if (!selectedAgentId) return;
    const inputVal = parseInt(newBudgetInput.replace(/\D/g, '') || '0');
    if (inputVal <= 0) { 
      toast.error('Ingresa un presupuesto válido'); 
      return; 
    }

    let finalCop = inputVal;
    if (localCurrency !== 'COP') {
      let usd = inputVal;
      if (localCurrency !== 'USD') {
        // Obtenemos la tasa de la moneda local hacia USD (para revertir)
        const rate = adminData?.trm_rates?.[localCurrency];
        // si no hay rate (raro), hacemos fallback simple
        usd = rate ? inputVal / rate : inputVal / 20; 
      }
      finalCop = Math.round(usd * (parseFloat(newTrm.replace(/,/g, '')) || adminData?.trm_usd_cop || 4000));
    }

    const proj = adminData?.projects?.find(p => p.id === selectedAgentId);
    if (!proj) return;

    setSavingBudget(true);
    try {
      // Actualizamos el proyecto específico
      await adminAPI.updateProject(selectedAgentId, proj.name, proj.description || '', proj.plan, finalCop, proj.functions);
      // Actualizamos la TRM global
      await adminAPI.updateSettings(adminData?.budget_cop || 0, parseFloat(newTrm.replace(/,/g, '')) || undefined);
      
      toast.success('Presupuesto del Agente actualizado');
      fetchFinopsData();
    } catch (err: any) {
      toast.error('Error al actualizar el presupuesto');
    } finally {
      setSavingBudget(false);
    }
  };

  if (loadingAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-50 text-slate-500">
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-rose-600 bg-slate-50 min-h-screen flex items-center justify-center">
        Hubo un problema: {error}
      </div>
    );
  }

  // VISTA 1: Seleccionar Agente
  if (!selectedAgentId) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Finanzas por Agente</h1>
          <p className="text-slate-500 mt-1">Selecciona un Agente de IA para gestionar su presupuesto y monitorear sus costos.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(adminData?.projects || []).map(proj => (
            <div 
              key={proj.id} 
              onClick={() => setSelectedAgentId(proj.id)}
              className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <Server className="w-6 h-6" />
                </div>
                {proj.is_active ? 
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold uppercase">Activo</span>
                  : 
                  <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold uppercase">Inactivo</span>
                }
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-1">{proj.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-4">{proj.description || 'Sin descripción'}</p>
              
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <div className="text-sm font-semibold text-slate-700">Presupuesto:</div>
                <div className="text-sm font-bold text-slate-900">{formatCurrency(user?.currency !== 'COP' ? convertUsdTo(proj.budget_cop / (adminData?.trm_usd_cop || 4000), user?.currency || 'COP', adminData?.trm_rates) : proj.budget_cop, user?.currency || 'COP')}</div>
              </div>
            </div>
          ))}
          {(!adminData?.projects || adminData.projects.length === 0) && (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 border-dashed">
              No hay agentes registrados. Ve a "Ajustes" para crear uno.
            </div>
          )}
        </div>



      </div>
    );
  }

  // VISTA 2: Finanzas del Agente
  const activeProject = adminData?.projects.find(p => p.id === selectedAgentId);

  // Cálculos de presupuesto usando multimoneda local
  const targetCurrency = localCurrency;
  const costUsd = metrics?.total_cost_usd || 0;
  const trmCop = adminData?.trm_usd_cop || 4000;
  const trmRates = adminData?.trm_rates || {};
  
  // Costo convertido
  const costInCurrency = convertUsdTo(costUsd, targetCurrency, trmRates);
  
  // Presupuesto convertido (usamos el del proyecto)
  let budgetInCurrency = activeProject?.budget_cop || 0;
  if (targetCurrency !== 'COP') {
    const budgetUsd = budgetInCurrency / trmCop;
    budgetInCurrency = convertUsdTo(budgetUsd, targetCurrency, trmRates);
  }

  const percentUsed = budgetInCurrency > 0 ? (costInCurrency / budgetInCurrency) * 100 : 0;
  const remainingInCurrency = budgetInCurrency - costInCurrency;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-10">
      {/* Header */}
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <button 
            onClick={() => setSelectedAgentId(null)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Volver a Agentes
          </button>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            Finanzas: {activeProject?.name}
          </h1>
          <p className="text-slate-500 mt-1">Administra los gastos y el límite de consumo de este agente.</p>
        </div>
        
        {/* Selector de Moneda Local */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-bold text-slate-600">Moneda:</label>
          <select 
            value={localCurrency}
            onChange={(e) => setLocalCurrency(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value="COP">COP (Pesos Col)</option>
            <option value="USD">USD (Dólares)</option>
            <option value="MXN">MXN (Pesos Mex)</option>
            <option value="ARS">ARS (Pesos Arg)</option>
            <option value="CLP">CLP (Pesos Chi)</option>
            <option value="PEN">PEN (Soles)</option>
          </select>
        </div>
      </header>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl">
              <Wallet className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Presupuesto M.</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-slate-800">{formatCurrency(budgetInCurrency, targetCurrency)}</h3>
            <p className="text-sm text-slate-500 mt-1">Límite mensual ({targetCurrency})</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl">
              <PieChart className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Gasto Actual</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-slate-800">{formatCurrency(costInCurrency, targetCurrency)}</h3>
            <p className="text-sm text-slate-500 mt-1">Consumo acumulado ({targetCurrency})</p>
          </div>
        </div>

        <div className={`p-6 rounded-3xl shadow-sm border flex flex-col justify-between ${percentUsed > 80 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl bg-white ${percentUsed > 80 ? 'text-rose-500' : 'text-emerald-500'}`}>
              <TrendingDown className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold uppercase opacity-70">Restante</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold">{formatCurrency(remainingInCurrency, targetCurrency)}</h3>
            <div className="w-full bg-black/5 rounded-full h-2 mt-3 mb-1 overflow-hidden">
              <div 
                className={`h-2 rounded-full ${percentUsed > 80 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs opacity-70">{percentUsed.toFixed(1)}% consumido</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configurar Presupuesto e Info Proveedores */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-bold mb-2 text-slate-800">Presupuesto del Agente</h2>
            <p className="text-sm text-slate-500 mb-6">Define el límite de gasto en la moneda principal y ajusta la tasa de conversión.</p>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Presupuesto ({targetCurrency})</label>
                  <p className="text-[10px] text-slate-400 mb-2 leading-tight">Nota: El límite a nivel de sistema siempre se define y guarda en pesos colombianos (COP).</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="text"
                      value={formatCOP(newBudgetInput)}
                      onChange={e => setNewBudgetInput(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Tasa de Cambio ({targetCurrency}/USD)</label>
                  <p className="text-[10px] text-slate-400 mb-2 leading-tight">Valor usado para convertir los cobros en USD al presupuesto base.</p>
                  {targetCurrency === 'COP' ? (
                    <input
                      type="text"
                      value={newTrm}
                      onChange={e => setNewTrm(formatDecimal(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                    />
                  ) : (
                    <input
                      type="text"
                      value={adminData?.trm_rates?.[targetCurrency] || 'N/A'}
                      disabled
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 outline-none cursor-not-allowed"
                    />
                  )}
                </div>
              </div>
              
              <button 
                onClick={updateBudget} 
                disabled={savingBudget}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {savingBudget ? 'Guardando...' : <><Save className="w-5 h-5" /> Guardar Cambios</>}
              </button>
            </div>
          </div>

          <div className="bg-slate-100 rounded-3xl border border-slate-200 p-8">
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-2"><Info className="w-4 h-4" /> Tarifas de Proveedores (USD / 1M Tokens)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
               <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                 <div className="text-lg font-bold text-blue-600">${adminData?.groq_cost_per_million}</div>
                 <div className="text-xs text-slate-500 font-semibold">GROQ</div>
               </div>
               <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                 <div className="text-lg font-bold text-purple-600">${adminData?.anthropic_cost_per_million}</div>
                 <div className="text-xs text-slate-500 font-semibold">ANTHROPIC</div>
               </div>
               <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                 <div className="text-lg font-bold text-green-600">${adminData?.openai_cost_per_million}</div>
                 <div className="text-xs text-slate-500 font-semibold">OPENAI</div>
               </div>
               <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                 <div className="text-lg font-bold text-cyan-600">${adminData?.google_cost_per_million}</div>
                 <div className="text-xs text-slate-500 font-semibold">GOOGLE</div>
               </div>
            </div>
          </div>
        </div>

        {/* Historial Corto */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 flex flex-col">
          <h2 className="text-xl font-bold mb-6 text-slate-800">Últimos Gastos Registrados</h2>
          
          <div className="space-y-3 overflow-y-auto pr-2 flex-1 max-h-[400px]">
            {loadingMetrics ? (
              <div className="flex justify-center p-4"><Spinner size={24} /></div>
            ) : (costHistory || []).map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                    <DollarSign className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-700">{new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString()}</div>
                    <div className="text-xs text-slate-500 capitalize">{item.module || 'Operación'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-800">
                    {formatCurrency(convertUsdTo(item.cost_usd, targetCurrency, trmRates), targetCurrency)}
                  </div>
                  <div className="text-[10px] text-slate-400">{item.tokens} tks</div>
                </div>
              </div>
            ))}
            {!loadingMetrics && costHistory.length === 0 && (
              <div className="text-center text-slate-500 py-6">No hay gastos registrados para este agente.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
