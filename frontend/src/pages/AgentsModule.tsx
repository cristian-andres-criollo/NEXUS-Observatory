import React, { useState, useEffect } from "react";
import { Bot, Plus, RefreshCw, Trash2, Power, Copy, Check, Key, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { adminAPI, ProjectOut } from "../lib/api";
import toast from "react-hot-toast";
import { Spinner } from "../components/ui/Spinner";
import { formatCurrency } from "../lib/currency";

const FUNCIONES_OPCIONES = [
  "Chat Interactivo", "Análisis de Documentos", "Generación de Código",
  "Revisión de Código", "Agente de Soporte", "Extracción de Datos",
  "Traducción de Textos", "Resumen de Contenido", "Generación de Imágenes",
  "Análisis de Sentimiento", "Moderación de Contenido", "Asistente de Ventas",
  "Búsqueda Web", "Análisis Financiero", "Redacción SEO", "Otro (Específico)",
];

export function AgentsModule() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "", description: "", plan: "starter",
    budget_cop: 50000, functions: [] as string[],
    llm_provider: "groq", llm_api_key: "",
  });
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    setProjectsLoading(true);
    try {
      const res = await adminAPI.getDashboard();
      setProjects(res.data.projects || []);
    } catch { toast.error("Error al cargar los agentes"); }
    finally { setProjectsLoading(false); }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await adminAPI.createProject(newProject);
      setNewKey(res.data.api_key);
      toast.success("Agente creado exitosamente");
      setIsProjectModalOpen(false);
      setNewProject({ name: "", description: "", plan: "starter", budget_cop: 50000, functions: [], llm_provider: "groq", llm_api_key: "" });
      fetchProjects();
    } catch (err: any) { toast.error(err.response?.data?.detail || "Error al crear el agente"); }
  };

  const handleResetKey = async (id: number) => {
    if (!confirm("Rotar la API Key dejará inválida la clave actual. ¿Continuar?")) return;
    try {
      const res = await adminAPI.resetProjectKey(id);
      setNewKey(res.data.new_api_key);
      toast.success("API Key rotada");
    } catch { toast.error("Error al rotar la API Key"); }
  };

  const handleDeactivateProject = async (id: number) => {
    try { await adminAPI.deactivateProject(id); toast.success("Agente desactivado"); fetchProjects(); }
    catch { toast.error("Error al desactivar el agente"); }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm("ATENCION: Borrar PERMANENTEMENTE este agente? Esta accion NO se puede deshacer.")) return;
    try { await adminAPI.deleteProject(id); toast.success("Agente eliminado"); fetchProjects(); }
    catch { toast.error("Error al eliminar el agente"); }
  };

  const copyToClipboard = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("API Key copiada al portapapeles");
    }
  };

  const toggleFn = (f: string, checked: boolean) =>
    setNewProject(prev => ({
      ...prev,
      functions: checked ? [...prev.functions, f] : prev.functions.filter(x => x !== f),
    }));

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">Acceso restringido</h2>
          <p className="text-slate-500">Solo los administradores pueden gestionar agentes de IA.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
              <Bot className="w-6 h-6 text-white" />
            </div>
            Agentes de IA
          </h1>
          <p className="text-slate-500 mt-1 ml-[52px]">
            Crea, configura y supervisa tus agentes controlados con BYOK.
          </p>
        </div>
        <button
          onClick={() => setIsProjectModalOpen(true)}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg whitespace-nowrap"
        >
          <Plus className="w-5 h-5" /> Nuevo Agente
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          <h2 className="font-bold text-slate-800 text-lg">Agentes Registrados</h2>
          <span className="ml-auto text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
            {projects.filter(p => p.is_active).length} activos
          </span>
        </div>
        {projectsLoading ? (
          <div className="flex justify-center p-12"><Spinner size={36} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[800px]">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Proveedor</th>
                  <th className="px-6 py-4">API Prefix</th>
                  <th className="px-6 py-4">Presupuesto</th>
                  <th className="px-6 py-4">Consumo</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Bot className="w-10 h-10 text-slate-200" />
                        <p className="text-slate-400 font-medium">No hay agentes registrados</p>
                        <button onClick={() => setIsProjectModalOpen(true)} className="text-blue-600 font-semibold hover:underline text-sm">
                          + Crear el primer agente
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : projects.map(p => (
                  <tr key={p.id} className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{p.name}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs uppercase">{p.llm_provider || "groq"}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{p.api_key_prefix}...</td>
                    <td className="px-6 py-4 font-medium">{formatCurrency(p.budget_cop, "COP")}</td>
                    <td className="px-6 py-4 font-medium text-slate-600">{formatCurrency(p.spent_cop, "COP")}</td>
                    <td className="px-6 py-4">
                      {p.is_active
                        ? <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-bold uppercase">Activo</span>
                        : <span className="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-lg text-xs font-bold uppercase">Inactivo</span>
                      }
                    </td>
                    <td className="px-6 py-4 flex items-center justify-end gap-1.5">
                      <button onClick={() => handleResetKey(p.id)} title="Rotar API Key" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      {p.is_active && (
                        <button onClick={() => handleDeactivateProject(p.id)} title="Kill Switch" className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border border-transparent hover:border-orange-200">
                          <Power className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDeleteProject(p.id)} title="Borrar Definitivamente" className="p-2 text-rose-400 hover:text-white hover:bg-rose-600 rounded-lg transition-colors border border-rose-200 hover:border-rose-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Nuevo Agente */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Registrar Nuevo Agente</h2>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Nombre del Agente</label>
                <input required type="text" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder="Ej. Aegis-Bot" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Descripcion</label>
                <input type="text" value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} placeholder="Agente para servicio al cliente" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Presupuesto Mensual (COP)</label>
                <input required type="number" min="0" value={newProject.budget_cop} onChange={e => setNewProject({...newProject, budget_cop: parseInt(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Funciones</label>
                <div className="w-full max-h-40 overflow-y-auto p-3 rounded-xl border border-slate-200 grid grid-cols-1 gap-2">
                  {FUNCIONES_OPCIONES.map(f => (
                    <label key={f} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600" checked={newProject.functions.includes(f)} onChange={e => toggleFn(f, e.target.checked)} />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">Proveedor de IA (BYOK)</label>
                  <select required value={newProject.llm_provider} onChange={e => setNewProject({...newProject, llm_provider: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none">
                    <option value="groq">Groq (Rapido / Llama)</option>
                    <option value="openai">OpenAI (GPT-4o)</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="google">Google (Gemini)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">API Key del Proveedor</label>
                  <input required type="password" value={newProject.llm_api_key} onChange={e => setNewProject({...newProject, llm_api_key: e.target.value})} placeholder="sk-..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none" />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsProjectModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors">Crear Agente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: API Key generada */}
      {newKey && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">API Key Generada</h2>
            <p className="text-slate-500 mb-6 text-sm">Copia esta credencial ahora. Por razones de seguridad, <strong>no volvera a mostrarse</strong>.</p>
            <div className="flex items-center gap-2 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
              <code className="text-sm flex-1 text-slate-800 font-mono select-all overflow-hidden text-ellipsis">{newKey}</code>
              <button onClick={copyToClipboard} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <button onClick={() => setNewKey(null)} className="w-full px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors">
              He copiado la clave
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
