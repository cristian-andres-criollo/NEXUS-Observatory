import React, { useState, useEffect, useRef } from 'react';
import { User as UserIcon, Shield, Sparkles, Bell, Lock, Globe, Server, Users, Key, Plus, Trash2, RefreshCw, Copy, Check, Power, FileText, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI, adminAPI, metricsAPI, ProjectOut } from '../lib/api';
import toast from 'react-hot-toast';
import { Spinner } from '../components/ui/Spinner';

import { formatCurrency } from '../lib/currency';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

export function SettingsModule() {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'ollama' | 'users' | 'reports' | 'agents'>('profile');

  // Profile
  const [profileName, setProfileName] = useState(user?.full_name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileAvatar, setProfileAvatar] = useState(user?.profile_picture || '');
  const [language, setLanguage] = useState(user?.language || 'es');
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Avatar UI state
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('La imagen es demasiado grande. Máximo 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileAvatar(reader.result as string);
        toast.success('Imagen cargada (recuerda Guardar Cambios)');
        setIsAvatarMenuOpen(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const FUNCIONES_OPCIONES = [
    'Chat Interactivo', 'Análisis de Documentos', 'Generación de Código', 
    'Revisión de Código', 'Agente de Soporte', 'Extracción de Datos', 
    'Traducción de Textos', 'Resumen de Contenido', 'Generación de Imágenes', 
    'Análisis de Sentimiento', 'Moderación de Contenido', 'Asistente de Ventas', 
    'Búsqueda Web', 'Análisis Financiero', 'Redacción SEO', 'Otro (Específico)'
  ];

  // Translations dictionary
  const t = {
    settings: language === 'en' ? 'Settings' : 'Configuración',
    profile: language === 'en' ? 'My Profile' : 'Mi Perfil',
    preferences: language === 'en' ? 'Preferences' : 'Preferencias',
    admin: language === 'en' ? 'Administration' : 'Administración',
    agents: language === 'en' ? 'AI Agents' : 'Agentes de IA',
  };

  // Projects (Agents)
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', plan: 'starter', budget_cop: 50000, functions: [] as string[], llm_provider: 'groq', llm_api_key: '' });
  const [newKey, setNewKey] = useState<string | null>(null); // For displaying the generated key
  const [copied, setCopied] = useState(false);

  // Reports
  const [reportPeriod, setReportPeriod] = useState('mensual');
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Passkey
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'users' && user?.role === 'admin') {
      fetchProjects();
    }
  }, [activeTab]);

  const fetchProjects = async () => {
    setProjectsLoading(true);
    try {
      const res = await adminAPI.listProjects();
      setProjects(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setProjectsLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const functionsStr = newProject.functions.join(', ');
      const res = await adminAPI.createProject(newProject.name, newProject.description, newProject.plan, newProject.budget_cop, functionsStr, newProject.llm_provider, newProject.llm_api_key);
      toast.success('Agente creado exitosamente');
      setNewKey((res.data as any).api_key);
      fetchProjects();
      setIsProjectModalOpen(false);
      setNewProject({ name: '', description: '', plan: 'starter', budget_cop: 50000, functions: [], llm_provider: 'groq', llm_api_key: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Error al crear el agente');
    }
  };

  const handleResetKey = async (id: number) => {
    if (!confirm('¿Estás seguro? La API Key anterior dejará de funcionar inmediatamente.')) return;
    try {
      const res = await adminAPI.resetProjectKey(id);
      toast.success('API Key rotada exitosamente');
      setNewKey(res.data.api_key);
      fetchProjects();
    } catch (e) {
      toast.error('Error al rotar la API Key');
    }
  };

  const handleDeactivateProject = async (id: number) => {
    if (!confirm('¿Desactivar agente? Dejará de procesar peticiones.')) return;
    try {
      await adminAPI.deactivateProject(id);
      toast.success('Agente desactivado');
      fetchProjects();
    } catch (e) {
      toast.error('Error al desactivar el agente');
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm('🚨 ATENCIÓN 🚨\n¿Borrar PERMANENTEMENTE este agente de la base de datos?\nEsta acción NO se puede deshacer.')) return;
    try {
      await adminAPI.deleteProject(id);
      toast.success('Agente eliminado permanentemente');
      fetchProjects();
    } catch (e) {
      toast.error('Error al eliminar el agente');
    }
  };

  const copyToClipboard = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('API Key copiada al portapapeles');
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await authAPI.updateProfile({ full_name: profileName, language, email: profileEmail, profile_picture: profileAvatar });
      updateUser({ full_name: profileName, language, email: profileEmail, profile_picture: profileAvatar });
      toast.success('Perfil actualizado correctamente');
    } catch (err) {
      toast.error('Error al actualizar el perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePreviewReport = async () => {
    setReportGenerating(true);
    try {
      // Usamos metricsAPI
      const res = await metricsAPI.global();
      const metrics = res.data;
      
      const resAdmin = await adminAPI.getDashboard();
      const adminData = resAdmin.data;
      
      setReportData({ metrics, adminData });
      setIsReportModalOpen(true);
      toast.success('Reporte generado en el sistema');
      
    } catch (err) {
      toast.error('Error al generar el reporte');
      console.error(err);
    } finally {
      setReportGenerating(false);
    }
  };

  const downloadPDF = async () => {
    if (!reportData) return;
    try {
      const loadingToast = toast.loading('Generando reporte PDF...');
      const element = document.getElementById('report-preview-content');
      if (!element) {
        toast.error('No se encontró el contenido para exportar', { id: loadingToast });
        return;
      }

      // Hide scrollbars temporarily for a cleaner capture
      const originalOverflow = element.style.overflow;
      element.style.overflow = 'hidden';

      const canvas = await html2canvas(element, {
        scale: 2, // High resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      element.style.overflow = originalOverflow;

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      
      const margin = 0;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = (imgProps.height * contentWidth) / imgProps.width;
      
      if (contentHeight <= pdfHeight) {
        pdf.addImage(imgData, 'JPEG', margin, 0, contentWidth, contentHeight);
      } else {
        const scaledWidth = (imgProps.width * pdfHeight) / imgProps.height;
        pdf.addImage(imgData, 'JPEG', (pdfWidth - scaledWidth) / 2, 0, scaledWidth, pdfHeight);
      }

      pdf.save(`Nexus_Reporte_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Reporte descargado exitosamente', { id: loadingToast });
      
    } catch (err) {
      toast.error('Error al generar el PDF');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-10 flex flex-col md:flex-row gap-8">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 shrink-0">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-8">{t.settings}</h1>
        
        <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 scrollbar-hide w-full">
          <button onClick={() => setActiveTab('profile')} className={`flex items-center gap-2 md:gap-3 px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab === 'profile' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
            <UserIcon className="w-5 h-5" /> {t.profile}
          </button>
          <button onClick={() => setActiveTab('preferences')} className={`flex items-center gap-2 md:gap-3 px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab === 'preferences' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Sparkles className="w-5 h-5" /> {t.preferences}
          </button>
          
          <div className="hidden md:block h-px bg-slate-200 my-2"></div>
          
          <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-2 md:gap-3 px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab === 'reports' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Server className="w-5 h-5" /> Reportes (PDF)
          </button>
          {user?.role === 'admin' && (
            <>
              <div className="hidden md:block h-px bg-slate-200 my-2"></div>
              <p className="hidden md:block px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t.admin}</p>
              <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 md:gap-3 px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Users className="w-5 h-5" /> {t.agents}
              </button>
            </>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">Información Personal</h2>
              <div className="flex flex-col sm:flex-row gap-6 items-start relative">
                <div className="relative">
                  <div 
                    onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
                    className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 text-3xl font-bold shrink-0 overflow-hidden shadow-sm cursor-pointer hover:ring-4 hover:ring-blue-100 transition-all"
                  >
                    {profileAvatar ? <img src={profileAvatar} alt="Avatar" className="w-full h-full object-cover" /> : (profileName?.[0]?.toUpperCase() || profileEmail?.[0]?.toUpperCase() || 'U')}
                  </div>
                  
                  {isAvatarMenuOpen && (
                    <div className="absolute top-[105%] left-0 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                      <button onClick={() => { setIsAvatarModalOpen(true); setIsAvatarMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100">👁️ Ver imagen de perfil</button>
                      <button onClick={() => { fileInputRef.current?.click(); setIsAvatarMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors">📤 Actualizar imagen</button>
                    </div>
                  )}
                  
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                </div>
                
                {isAvatarModalOpen && profileAvatar && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4" onClick={() => setIsAvatarModalOpen(false)}>
                    <div className="relative max-w-2xl w-full max-h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setIsAvatarModalOpen(false)} className="absolute -top-12 right-0 text-white hover:text-slate-300">
                        Cerrar ✕
                      </button>
                      <img src={profileAvatar} alt="Avatar en grande" className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain" />
                    </div>
                  </div>
                )}
                
                <div className="flex-1 space-y-4 w-full">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-1">Nombre Completo</label>
                    <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Tu Nombre" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-1">Correo Electrónico</label>
                    <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} placeholder="tu@correo.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" />
                  </div>
                  <div className="pt-2">
                    <button onClick={handleSaveProfile} disabled={savingProfile} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-70">
                      {savingProfile ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                  </div>
                </div>
              </div>
            </div>


          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Ajustes Generales</h2>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Tema Visual</label>
                <select 
                  value={user?.theme_color || 'light'} 
                  onChange={e => {
                    updateUser({ theme_color: e.target.value });
                    toast.success(`Tema actualizado`);
                  }} 
                  className="w-full md:w-1/2 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none transition-all cursor-pointer bg-white"
                >
                  <option value="light">Claro (Predeterminado)</option>
                  <option value="dark">Oscuro</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="text-sm font-semibold text-slate-700 block mb-2">Idioma de la Interfaz</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full md:w-1/2 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none transition-all cursor-pointer bg-white">
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                <label className="text-sm font-semibold text-slate-700 block mb-2">Moneda Principal (Visualización)</label>
                <p className="text-xs text-slate-500 mb-3">Los costos de IA se generan en dólares (USD). Esta configuración convierte los valores en la interfaz usando tasas de referencia.</p>
                <select 
                  value={user?.currency || 'COP'} 
                  onChange={e => {
                    updateUser({ currency: e.target.value });
                    toast.success(`Moneda cambiada a ${e.target.value}`);
                  }} 
                  className="w-full md:w-1/2 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none transition-all cursor-pointer bg-white"
                >
                  <option value="COP">Peso Colombiano (COP)</option>
                  <option value="MXN">Peso Mexicano (MXN)</option>
                  <option value="ARS">Peso Argentino (ARS)</option>
                  <option value="CLP">Peso Chileno (CLP)</option>
                  <option value="PEN">Sol Peruano (PEN)</option>
                  <option value="USD">Dólar (USD)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="text-sm font-semibold text-slate-700 block mb-2">Umbral de Alerta de Presupuesto (%)</label>
                <p className="text-xs text-slate-500 mb-3">Notificar cuando el consumo del presupuesto supere este porcentaje.</p>
                <select 
                  value={user?.budget_alert_threshold || 80} 
                  onChange={e => {
                    updateUser({ budget_alert_threshold: parseInt(e.target.value) });
                    toast.success(`Umbral actualizado a ${e.target.value}%`);
                  }} 
                  className="w-full md:w-1/2 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none transition-all cursor-pointer bg-white"
                >
                  <option value={50}>50%</option>
                  <option value={80}>80%</option>
                  <option value={90}>90%</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                  Alertas por Correo Electrónico
                </label>
                <p className="text-xs text-slate-500 mb-3">Recibir correos de seguridad cuando se alcance el umbral de alerta.</p>
                <button
                  onClick={() => {
                    const newValue = !(user?.email_alerts ?? true);
                    updateUser({ email_alerts: newValue });
                    toast.success(newValue ? 'Alertas activadas' : 'Alertas desactivadas');
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    (user?.email_alerts ?? true) ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      (user?.email_alerts ?? true) ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                  Autenticación en Dos Pasos (2FA)
                </label>
                <p className="text-xs text-slate-500 mb-3">Aumenta la seguridad de tu cuenta solicitando un código enviado a tu correo al iniciar sesión.</p>
                <button
                  onClick={async () => {
                    const newValue = !(user?.two_factor_enabled ?? false);
                    try {
                      await authAPI.toggle2FA(newValue);
                      updateUser({ two_factor_enabled: newValue });
                      toast.success(newValue ? 'Autenticación 2FA activada' : 'Autenticación 2FA desactivada');
                    } catch (err) {
                      toast.error('Error al actualizar 2FA');
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    (user?.two_factor_enabled ?? false) ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      (user?.two_factor_enabled ?? false) ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 animate-in fade-in duration-300">
            <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Server className="w-6 h-6 text-blue-500" /> Reportes y Trazabilidad
            </h2>
            <p className="text-slate-500 mb-8">Exporta los logs de sistema y métricas de consumo en formato PDF profesional para auditoría o facturación.</p>

            <div className="space-y-6 max-w-lg">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Período del Reporte</label>
                <select 
                  value={reportPeriod} 
                  onChange={e => setReportPeriod(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none transition-all cursor-pointer bg-white"
                >
                  <option value="diario">Diario</option>
                  <option value="semanal">Semanal</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual</option>
                  <option value="custom">Fechas personalizadas...</option>
                </select>
              </div>

              {reportPeriod === 'custom' && (
                <div className="flex gap-4 animate-in slide-in-from-top-2">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Fecha de Inicio</label>
                    <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Fecha de Fin</label>
                    <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none" />
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-slate-100">
                <button 
                  onClick={handlePreviewReport} 
                  disabled={reportGenerating || (reportPeriod === 'custom' && (!reportStartDate || !reportEndDate))}
                  className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  {reportGenerating ? <Spinner size={20} /> : null}
                  {reportGenerating ? 'Generando Reporte...' : 'Generar Reporte (Vista Previa)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && user?.role === 'admin' && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
             <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Users className="w-6 h-6 text-blue-500" /> Agentes de IA Controlados</h2>
                <button onClick={() => setIsProjectModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors">
                  <Plus className="w-4 h-4" /> Nuevo Agente
                </button>
             </div>
             
             {projectsLoading ? (
               <div className="flex justify-center p-8"><Spinner size={32} /></div>
             ) : (
               <div className="overflow-x-auto rounded-xl border border-slate-200">
                 <table className="w-full text-sm text-left min-w-[800px]">
                   <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                     <tr>
                       <th className="px-4 py-3 rounded-tl-lg">Nombre</th>
                       <th className="px-4 py-3">Proveedor</th>
                       <th className="px-4 py-3">API Prefix</th>
                       <th className="px-4 py-3">Presupuesto</th>
                       <th className="px-4 py-3">Consumo</th>
                       <th className="px-4 py-3">Estado</th>
                       <th className="px-4 py-3 rounded-tr-lg text-right">Acciones</th>
                     </tr>
                   </thead>
                   <tbody>
                     {projects.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-6 text-slate-400">No hay agentes registrados</td></tr>
                     ) : projects.map(p => (
                       <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                         <td className="px-4 py-4 font-bold text-slate-800">{p.name}</td>
                         <td className="px-4 py-4 text-slate-500 font-mono text-xs uppercase">{p.llm_provider || 'groq'}</td>
                         <td className="px-4 py-4 text-slate-500 font-mono text-xs">{p.api_key_prefix}...</td>
                         <td className="px-4 py-4 font-medium">{formatCurrency(p.budget_cop, 'COP')}</td>
                         <td className="px-4 py-4 font-medium text-slate-600">{formatCurrency(p.spent_cop, 'COP')}</td>
                         <td className="px-4 py-4">
                            {p.is_active ? 
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold uppercase">ACTIVO</span>
                              : 
                              <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold uppercase">INACTIVO</span>
                            }
                         </td>
                         <td className="px-4 py-4 flex items-center justify-end gap-2">
                           <button onClick={() => handleResetKey(p.id)} title="Rotar API Key" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                             <RefreshCw className="w-4 h-4" />
                           </button>
                           {p.is_active && (
                             <button onClick={() => handleDeactivateProject(p.id)} title="Apagar Kill Switch" className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border border-transparent hover:border-orange-200">
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
        )}
      </main>

      {/* Modal Nuevo Agente */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Registrar Nuevo Agente</h2>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Nombre del Agente</label>
                <input required type="text" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder="Ej. Aegis-Bot" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Descripción</label>
                <input type="text" value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} placeholder="Agente para servicio al cliente" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Presupuesto Mensual (COP)</label>
                <input required type="number" min="0" value={newProject.budget_cop} onChange={e => setNewProject({...newProject, budget_cop: parseInt(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Funciones (Selecciona 1 o más)</label>
                <div className="w-full max-h-40 overflow-y-auto p-3 rounded-xl border border-slate-200 bg-white grid grid-cols-1 gap-2">
                  {FUNCIONES_OPCIONES.map(f => (
                    <label key={f} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={newProject.functions.includes(f)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewProject({...newProject, functions: [...newProject.functions, f]});
                          } else {
                            setNewProject({...newProject, functions: newProject.functions.filter(x => x !== f)});
                          }
                        }}
                      />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">Proveedor de IA (BYOK)</label>
                  <select required value={newProject.llm_provider} onChange={e => setNewProject({...newProject, llm_provider: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none">
                    <option value="groq">Groq (Rápido / Llama)</option>
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

      {/* Modal Mostrar API Key (Solo se muestra una vez) */}
      {newKey && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">API Key Generada</h2>
            <p className="text-slate-500 mb-6 text-sm">Copia esta credencial ahora. Por razones de seguridad, <strong>no volverá a mostrarse</strong>.</p>
            
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

      {/* Modal Vista Previa de Reporte */}
      {isReportModalOpen && reportData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl md:rounded-3xl w-full max-w-5xl max-h-[95vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-50 shrink-0 gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 md:w-6 md:h-6 text-blue-600" /> Vista Previa del Reporte
                </h2>
                <p className="text-xs md:text-sm text-slate-500 mt-1">Período Seleccionado: {reportPeriod === 'custom' ? `${reportStartDate} a ${reportEndDate}` : reportPeriod}</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button onClick={() => setIsReportModalOpen(false)} className="px-4 py-2 md:px-5 md:py-2.5 text-sm md:text-base text-slate-600 hover:bg-slate-200 bg-slate-100 font-semibold rounded-xl transition-colors">
                  Cerrar
                </button>
                <button onClick={downloadPDF} className="px-4 py-2 md:px-5 md:py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm md:text-base font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap">
                  <Download className="w-4 h-4 md:w-5 md:h-5" /> Descargar PDF
                </button>
              </div>
            </div>

            {/* Contenido del Reporte (Estilo A4 PDF) */}
            <div className="flex-1 overflow-auto bg-slate-300 p-2 sm:p-4 md:p-8 flex justify-center items-start">
              
              <div id="report-preview-content" className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl flex flex-col shrink-0 relative" style={{ boxSizing: 'border-box' }}>
                
                {/* Header Empresarial */}
                <div className="bg-[#1E3A8A] w-full px-6 md:px-14 py-8 flex flex-col justify-center">
                   <h1 className="text-white text-2xl md:text-3xl font-bold m-0 tracking-wide font-sans">NEXUS OBSERVATORY</h1>
                   <p className="text-white/90 text-xs md:text-sm mt-1 font-light">Inteligencia Artificial y Trazabilidad de Consumo</p>
                </div>

                <div className="px-6 md:px-14 py-10 flex-1 flex flex-col">
                  {/* Meta Data y Fechas */}
                  <div className="mb-10">
                    <h2 className="text-[#323232] text-xl md:text-2xl font-bold mb-3">Reporte Ejecutivo del Sistema</h2>
                    <div className="h-px w-full bg-slate-300 mb-5"></div>
                    <div className="flex flex-col sm:flex-row sm:justify-between items-start text-xs md:text-sm text-slate-600 gap-2">
                      <div>
                        <p>Fecha de Generación: {new Date().toLocaleString()}</p>
                        <p className="mt-1">Período Seleccionado: {reportPeriod === 'custom' ? `${reportStartDate} a ${reportEndDate}` : reportPeriod.toUpperCase()}</p>
                      </div>
                      <div className="sm:text-right">
                        <p>Generado por: {user?.full_name || user?.email || 'Administrador'}</p>
                      </div>
                    </div>
                  </div>

                  {/* KPIs - Tarjetas Visuales */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    <div className="bg-indigo-50 border border-indigo-600 rounded p-4">
                      <p className="text-[10px] font-bold text-slate-500 mb-2">TOTAL AGENTES</p>
                      <p className="text-xl font-bold text-indigo-600">{reportData.adminData?.projects?.filter((p: any) => p.is_active)?.length || 0}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-600 rounded p-4">
                      <p className="text-[10px] font-bold text-slate-500 mb-2">TOKENS USADOS</p>
                      <p className="text-xl font-bold text-emerald-600">{(reportData.metrics.total_tokens || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-600 rounded p-4">
                      <p className="text-[10px] font-bold text-slate-500 mb-2">COSTO EST. (COP)</p>
                      <p className="text-xl font-bold text-purple-600 truncate">{formatCurrency((reportData.metrics.total_cost_usd || 0) * 4000, 'COP')}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-600 rounded p-4">
                      <p className="text-[10px] font-bold text-slate-500 mb-2">PETICIONES</p>
                      <p className="text-xl font-bold text-amber-600">{(reportData.metrics.total_conversations || 0).toString()}</p>
                    </div>
                  </div>

                  {/* Tabla de Trazas */}
                  <div className="mb-8 overflow-x-auto">
                    <h3 className="text-[#323232] text-lg md:text-xl font-bold mb-4">Desglose de Peticiones Recientes</h3>
                    <table className="w-full text-xs md:text-sm border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-[#1E3A8A] text-white">
                          <th className="py-2.5 px-3 text-left font-bold border border-[#1E3A8A]">Fecha y Hora</th>
                          <th className="py-2.5 px-3 text-left font-bold border border-[#1E3A8A] text-center">Agente</th>
                          <th className="py-2.5 px-3 text-left font-bold border border-[#1E3A8A]">Módulo</th>
                          <th className="py-2.5 px-3 text-right font-bold border border-[#1E3A8A]">Tokens</th>
                          <th className="py-2.5 px-3 text-right font-bold border border-[#1E3A8A]">Costo (COP)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.metrics.recent_conversations?.length ? (
                          reportData.metrics.recent_conversations.map((t: any, i: number) => (
                            <tr key={i} className={i % 2 !== 0 ? 'bg-slate-50' : 'bg-white'}>
                              <td className="py-2 px-3 border border-slate-200 text-slate-600 whitespace-nowrap">{t.created_at ? t.created_at.replace('Z', '').split('.')[0].replace('T', ' ') : 'N/A'}</td>
                              <td className="py-2 px-3 border border-slate-200 text-slate-800 font-bold text-center">{t.project_name || 'Global'}</td>
                              <td className="py-2 px-3 border border-slate-200 text-slate-600">{t.module || 'Desconocido'}</td>
                              <td className="py-2 px-3 border border-slate-200 text-slate-600 text-right">{t.tokens_used?.toString() || '0'}</td>
                              <td className="py-2 px-3 border border-slate-200 text-slate-600 text-right">{formatCurrency(t.cost_usd * 4000 || 0, 'COP')}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={5} className="py-8 text-center text-slate-400 border border-slate-200">No hay trazas registradas</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Spacer for pushing footer down */}
                  <div className="flex-1"></div>

                  {/* Footer (Página) */}
                  <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] md:text-xs text-slate-400">
                    <span className="w-16 md:w-20">Página 1</span>
                    <span className="flex-1 text-center">Reporte confidencial generado por Nexus Observatory.</span>
                    <span className="w-16 md:w-20 text-right"></span>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
