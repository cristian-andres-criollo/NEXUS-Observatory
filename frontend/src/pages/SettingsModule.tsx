import React, { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Settings, Fingerprint, Palette, Trash2, Plus, MonitorSmartphone, User as UserIcon, Shield, Key, Sparkles, Cpu, Globe, Database, Users, Edit2, X, Eye, EyeOff, ChevronDown, Power } from 'lucide-react'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../context/AuthContext'
import { useTheme, ThemeColor } from '../context/ThemeContext'
import { adminAPI, webauthnAPI, authAPI, AdminDashboardData } from '../lib/api'
import { registerPasskey } from '../lib/webauthn'
import toast from 'react-hot-toast'

interface PasskeyItem {
  id: string
  device_name: string
  created_at: string
}

const THEME_OPTIONS: { id: ThemeColor; name: string; desc: string; colors: string[] }[] = [
  { id: 'default', name: 'NEXUS Original', desc: 'Azul profundo y cyan brillante', colors: ['#0e4aff', '#00d4ff'] },
  { id: 'matrix',  name: 'Cyber Matrix',   desc: 'Verde terminal y neón', colors: ['#008f11', '#00ff41'] },
  { id: 'amber',   name: 'Solar Flare',    desc: 'Naranja ámbar y oro', colors: ['#d93e0a', '#ffae00'] },
  { id: 'purple',  name: 'Neon Synth',     desc: 'Púrpura y magenta', colors: ['#6a0dad', '#ff00ff'] },
]

export function SettingsModule() {
  const { user, updateUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'security' | 'integrations' | 'system_specs'>('preferences')
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([])
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [registering, setRegistering] = useState(false)

  // User Profile State
  const [profileName, setProfileName] = useState(user?.full_name || '')
  const [profilePic, setProfilePic] = useState(user?.profile_picture || '')
  const [customInstructions, setCustomInstructions] = useState(user?.custom_ai_instructions || '')
  const [language, setLanguage] = useState(user?.language || 'es')
  const [hardwareSpecs, setHardwareSpecs] = useState(user?.hardware_specs || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [showPaymentGateway, setShowPaymentGateway] = useState(false)
  const [buyType, setBuyType] = useState<'documents' | 'repositories' | 'plan'>('documents')
  const [buyQuantity, setBuyQuantity] = useState<number>(1)

  // Admin Dashboard State
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null)
  const [newBudgetCop, setNewBudgetCop] = useState('')
  const [newTrm, setNewTrm] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)
  
  // LLM Config State
  const [newLlmProvider, setNewLlmProvider] = useState('groq')
  const [newOllamaUrl, setNewOllamaUrl] = useState('http://localhost:11434')
  const [newOllamaModel, setNewOllamaModel] = useState('llama3')
  const [savingLlm, setSavingLlm] = useState(false)
  const [showOllamaModal, setShowOllamaModal] = useState(false)
  
  // Ollama Server Control State
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'running' | 'stopped'>('checking')
  const [startingOllama, setStartingOllama] = useState(false)
  const [stoppingOllama, setStoppingOllama] = useState(false)

  // Admin Create User State
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('developer')
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false)
  const [newPlan, setNewPlan] = useState('enterprise')
  const [creatingUser, setCreatingUser] = useState(false)

  // Estados de edición de usuario
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('user')
  const [editPlan, setEditPlan] = useState('community')
  const [editPassword, setEditPassword] = useState('')
  const [updatingUser, setUpdatingUser] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)
  // Computed: tokens comprables con el presupuesto actual en el input
  const previewTokens = (() => {
    const b = parseInt(newBudgetCop.replace(/\./g, '') || '0')
    const t = parseFloat(newTrm || String(adminData?.trm_usd_cop || 4200))
    const c = adminData?.groq_cost_per_million || 0.69
    if (!b || !t || !c) return 0
    return Math.floor((b / t / c) * 1_000_000)
  })()

  // Formatea un número con puntos como separadores de miles (ej: 1500000 → 1.500.000)
  const formatCOP = (raw: string) => {
    const digits = raw.replace(/\./g, '')
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  // Typography state
  const [fontFamily, setFontFamily] = useState(localStorage.getItem('nexus_font_family') || 'inter')
  const [fontSize, setFontSize] = useState(localStorage.getItem('nexus_font_size') || '16px')

  // Apply typography
  useEffect(() => {
    localStorage.setItem('nexus_font_family', fontFamily)
    localStorage.setItem('nexus_font_size', fontSize)

    document.documentElement.style.setProperty('--nexus-text-size', fontSize)

    if (fontFamily === 'inter') {
      document.documentElement.style.setProperty('--font-sans', "'Inter', sans-serif")
      document.documentElement.style.setProperty('--font-display', "'Outfit', sans-serif")
    } else if (fontFamily === 'roboto') {
      document.documentElement.style.setProperty('--font-sans', "'Roboto', sans-serif")
      document.documentElement.style.setProperty('--font-display', "'Roboto', sans-serif")
    } else if (fontFamily === 'space') {
      document.documentElement.style.setProperty('--font-sans', "'Space Grotesk', sans-serif")
      document.documentElement.style.setProperty('--font-display', "'Space Grotesk', sans-serif")
    }
  }, [fontFamily, fontSize])

  useEffect(() => {
    if (activeTab === 'security') {
      fetchPasskeys()
    } else if (activeTab === 'system_specs' && user?.role === 'admin') {
      fetchAdminData()
    }
  }, [activeTab])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await authAPI.updateProfile({
        full_name: profileName,
        profile_picture: profilePic,
        custom_ai_instructions: customInstructions,
        language,
        hardware_specs: hardwareSpecs
      })
      updateUser({
        full_name: profileName,
        profile_picture: profilePic,
        custom_ai_instructions: customInstructions,
        language,
        hardware_specs: hardwareSpecs,
        plan: (res as any).data.plan
      })
      toast.success('Perfil actualizado correctamente')
    } catch (err) {
      toast.error('Error al actualizar el perfil')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 256
          const MAX_HEIGHT = 256
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
          setProfilePic(dataUrl)
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  const fetchAdminData = async () => {
    try {
      const res = await adminAPI.getDashboard()
      setAdminData(res.data)
      setNewBudgetCop(res.data.budget_cop.toString())
      setNewTrm(res.data.trm_usd_cop.toString())
      setNewLlmProvider(res.data.llm_provider || 'groq')
      setNewOllamaUrl(res.data.ollama_base_url || 'http://localhost:11434')
      setNewOllamaModel(res.data.ollama_model || 'llama3')
      
      // Also check ollama status if it's selected (or just in general)
      try {
        const ollamaRes = await adminAPI.checkOllamaStatus()
        setOllamaStatus(ollamaRes.data.status as any)
      } catch (err) {
        setOllamaStatus('stopped')
      }
      
    } catch (err: any) {
      toast.error('Error al cargar dashboard de administrador')
    }
  }

  const handleStartOllama = async () => {
    setStartingOllama(true)
    try {
      await adminAPI.startOllama()
      toast.success('Iniciando servidor local Ollama...')
      // Poll para verificar si ya arrancó
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const res = await adminAPI.checkOllamaStatus()
        if (res.data.status === 'running') {
          setOllamaStatus('running')
          toast.success('Servidor Ollama en línea exitosamente')
          break
        }
      }
    } catch (err: any) {
      toast.error('Falló el encendido del servidor Ollama. ¿Está instalado correctamente?')
    } finally {
      setStartingOllama(false)
    }
  }

  const handleStopOllama = async () => {
    setStoppingOllama(true)
    try {
      await adminAPI.stopOllama()
      toast.success('Servidor Ollama detenido')
      setOllamaStatus('stopped')
    } catch (err: any) {
      toast.error('No se pudo detener el servidor local')
    } finally {
      setStoppingOllama(false)
    }
  }

  const updateBudget = async () => {
    const cop = parseInt(newBudgetCop.replace(/\D/g, '') || '0')
    if (cop <= 0) { toast.error('Ingresa un presupuesto válido'); return }
    setSavingBudget(true)
    try {
      await adminAPI.updateSettings(cop, parseFloat(newTrm) || undefined)
      toast.success('Presupuesto actualizado exitosamente')
      fetchAdminData()
    } catch (err: any) {
      toast.error('Error al actualizar el presupuesto')
    } finally {
      setSavingBudget(false)
    }
  }

  const handleUpdateLlm = async () => {
    setSavingLlm(true)
    try {
      await adminAPI.updateLLMSettings(newLlmProvider, newOllamaUrl, newOllamaModel)
      toast.success('Configuración de IA actualizada exitosamente')
      fetchAdminData()
    } catch (err: any) {
      toast.error('Error al actualizar la configuración de IA')
    } finally {
      setSavingLlm(false)
    }
  }

  const fetchPasskeys = async () => {
    setLoadingKeys(true)
    try {
      const res = await webauthnAPI.listPasskeys()
      setPasskeys(res.data)
    } catch (err: any) {
      toast.error('Error al cargar credenciales')
    } finally {
      setLoadingKeys(false)
    }
  }

  const handleRegisterPasskey = async () => {
    setRegistering(true)
    try {
      await registerPasskey()
      toast.success('Dispositivo registrado correctamente')
      fetchPasskeys()
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar la huella')
    } finally {
      setRegistering(false)
    }
  }

  const handleDeletePasskey = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta huella/dispositivo?')) return
    try {
      await webauthnAPI.deletePasskey(id)
      toast.success('Credencial eliminada')
      fetchPasskeys()
    } catch (err: any) {
      toast.error('Error al eliminar credencial')
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || !newPassword) return toast.error('Rellena email y contraseña')
    setCreatingUser(true)
    try {
      await adminAPI.createUser(newEmail, newPassword, newRole, newPlan)
      toast.success('Usuario creado exitosamente')
      setNewEmail('')
      setNewPassword('')
      setNewRole('developer')
      setNewPlan('enterprise')
      fetchAdminData()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Error creando usuario')
    } finally {
      setCreatingUser(false)
    }
  }

  const handleStartEdit = (u: any) => {
    setEditingUser(u.email)
    setEditRole(u.role)
    setEditPlan(u.plan)
    setEditPassword('')
  }

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setUpdatingUser(true)
    try {
      await adminAPI.updateUser(editingUser, {
        role: editRole,
        plan: editPlan,
        password: editPassword || undefined
      })
      toast.success('Usuario actualizado correctamente')
      setEditingUser(null)
      fetchAdminData()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Error al actualizar usuario')
    } finally {
      setUpdatingUser(false)
    }
  }

  const handleDeleteUser = async (email: string) => {
    if (email === user?.email) {
      toast.error('No puedes eliminar tu propia sesión actual')
      return
    }
    if (!confirm(`¿Estás completamente seguro de eliminar a ${email}?\nEsta acción es irreversible y borrará todo su historial.`)) return
    
    try {
      await adminAPI.deleteUser(email)
      toast.success('Usuario eliminado permanentemente')
      fetchAdminData()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Error al eliminar usuario')
    }
  }

  return (
    <Layout title="CONFIGURACIONES" subtitle="MÓDULO DE AJUSTES Y PREFERENCIAS">
      <div className="h-full flex flex-col md:flex-row p-4 sm:p-6 overflow-hidden gap-4 sm:gap-8 animate-fade-in-up">
        
        {/* SIDEBAR TABS (Mejora de simetría) */}
        <div className="w-full md:w-64 flex flex-col shrink-0 border-b md:border-b-0 md:border-r border-white/5 pb-4 md:pb-0 md:pr-6 h-auto md:h-full overflow-y-auto md:overflow-visible">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-nexus-blue/10 border border-nexus-cyan/30 rounded-xl">
                <Settings className="text-nexus-cyan" size={24} />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-white tracking-widest glow-text-cyan">
                  AJUSTES
                </h1>
                <p className="font-mono text-[10px] text-nexus-dim tracking-wider uppercase truncate max-w-[140px]">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setActiveTab('account')}
              className={`text-left px-4 py-3 rounded-lg font-display text-xs tracking-widest transition-all ${
                activeTab === 'account' 
                  ? 'bg-nexus-cyan/10 text-nexus-cyan border border-nexus-cyan/30 shadow-[0_0_15px_rgba(0,212,255,0.15)]' 
                  : 'text-nexus-dim hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              CUENTA Y PERFIL
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`text-left px-4 py-3 rounded-lg font-display text-xs tracking-widest transition-all ${
                activeTab === 'preferences' 
                  ? 'bg-nexus-cyan/10 text-nexus-cyan border border-nexus-cyan/30 shadow-[0_0_15px_rgba(0,212,255,0.15)]' 
                  : 'text-nexus-dim hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              PREFERENCIAS
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`text-left px-4 py-3 rounded-lg font-display text-xs tracking-widest transition-all ${
                activeTab === 'security' 
                  ? 'bg-nexus-cyan/10 text-nexus-cyan border border-nexus-cyan/30 shadow-[0_0_15px_rgba(0,212,255,0.15)]' 
                  : 'text-nexus-dim hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              BIOMETRÍA Y PASSKEYS
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`text-left px-4 py-3 rounded-lg font-display text-xs tracking-widest transition-all ${
                activeTab === 'integrations' 
                  ? 'bg-nexus-cyan/10 text-nexus-cyan border border-nexus-cyan/30 shadow-[0_0_15px_rgba(0,212,255,0.15)]' 
                  : 'text-nexus-dim hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              INTEGRACIONES API
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('system_specs')}
                className={`text-left px-4 py-3 mt-4 rounded-lg font-display text-xs tracking-widest transition-all ${
                  activeTab === 'system_specs' 
                    ? 'bg-nexus-warn/10 text-nexus-warn border border-nexus-warn/30 shadow-[0_0_15px_rgba(255,174,0,0.15)]' 
                    : 'text-nexus-dim hover:bg-white/5 hover:text-white border border-transparent'
                }`}
              >
                ESPECIFICACIONES DEL SISTEMA
              </button>
            )}
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto nexus-scrollbar pr-4 h-full">
          {activeTab === 'account' && (
            <div className="nexus-panel p-6 max-w-3xl space-y-8">
              {/* Información Básica */}
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg text-white mb-6">
                  <UserIcon className="text-nexus-cyan" size={20} />
                  INFORMACIÓN DE CUENTA
                </h2>
                
                <div className="flex items-start gap-4 p-4 bg-black/40 border border-white/5 rounded-xl">
                  <div className="relative group cursor-pointer w-16 h-16 rounded-full bg-nexus-blue/20 flex items-center justify-center border border-nexus-cyan/30 overflow-hidden shrink-0 shadow-[0_0_15px_rgba(0,212,255,0.1)]">
                    {profilePic ? (
                      <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-2xl text-nexus-cyan">
                        {profileName?.[0]?.toUpperCase() || user?.email?.[0].toUpperCase() || 'U'}
                      </span>
                    )}
                    <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all">
                       <Edit2 size={16} className="text-white" />
                    </div>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageUpload} />
                  </div>
                  <div className="flex-1">
                    <input 
                      type="text" 
                      value={profileName} 
                      onChange={e => setProfileName(e.target.value)} 
                      placeholder="Tu Nombre Completo" 
                      className="bg-transparent text-white font-display text-xl border-b border-white/10 focus:border-nexus-cyan outline-none w-full mb-1 pb-1 transition-colors"
                    />
                    <div className="text-nexus-dim font-mono text-xs mb-2">{user?.email}</div>
                    <div className="flex items-center gap-2">
                      <Shield size={12} className={user?.role === 'admin' ? 'text-nexus-warn' : 'text-nexus-success'} />
                      <span className="text-[10px] font-mono tracking-widest uppercase text-nexus-dim bg-white/5 px-2 py-0.5 rounded">
                        Rol: {user?.role || 'Usuario'}
                      </span>
                    </div>
                  </div>
                  <button onClick={handleSaveProfile} disabled={savingProfile} className="nexus-btn-primary self-start">
                     {savingProfile ? <Spinner size={14} /> : 'Guardar'}
                  </button>
                </div>

                <div className="mt-6 p-4 bg-black/20 border border-white/5 rounded-xl">
                  <label className="flex items-center gap-2 text-xs text-nexus-dim uppercase tracking-widest font-mono mb-2">
                    <Sparkles size={14} className="text-nexus-cyan" /> Instrucciones de Sistema (Comportamiento IA)
                  </label>
                  <textarea
                    value={customInstructions}
                    onChange={e => setCustomInstructions(e.target.value)}
                    placeholder="Ejemplo: Responde siempre en español formal, no uses emojis, enfócate en código limpio."
                    className="nexus-input w-full min-h-[80px] text-sm resize-y"
                  />
                  <div className="flex justify-end mt-3">
                    <button onClick={handleSaveProfile} disabled={savingProfile} className="nexus-btn-primary text-xs px-4 py-1.5">
                      Guardar Instrucciones
                    </button>
                  </div>
                </div>
              </div>

              {/* Membresía y Recursos */}
              <div className="pt-6 border-t border-white/5">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="flex items-center gap-2 font-display text-lg text-white">
                    <Sparkles className="text-nexus-cyan" size={20} />
                    MEMBRESÍA Y RECURSOS
                  </h2>
                  <span className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                    user?.plan === 'enterprise' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                      : user?.plan === 'team' ? 'bg-nexus-warn/20 text-nexus-warn border border-nexus-warn/30'
                      : 'bg-nexus-cyan/20 text-nexus-cyan border border-nexus-cyan/30'
                  }`}>
                    Plan Actual: {user?.plan === 'enterprise' ? 'Enterprise' : user?.plan === 'team' ? 'Team' : 'Community'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Uso de Documentos */}
                  <div className="p-4 bg-black/40 border border-white/10 rounded-xl relative overflow-hidden group hover:border-nexus-cyan/30 transition-all opacity-0 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-nexus-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-white font-medium">Uso de Documentos (RAG)</span>
                        <span className="text-xs text-nexus-dim font-mono">0 / {user?.plan === 'enterprise' ? '∞' : user?.plan === 'team' ? '100' : '10'}</span>
                      </div>
                      <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-nexus-cyan w-[0%] relative">
                          <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                      </div>
                      <div className="text-[10px] text-nexus-dim mt-2">Consultas y documentos analizados este mes.</div>
                    </div>
                  </div>

                  {/* Uso de Repositorios */}
                  <div className="p-4 bg-black/40 border border-white/10 rounded-xl relative overflow-hidden group hover:border-nexus-warn/30 transition-all opacity-0 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-nexus-warn/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-white font-medium">Uso de Repositorios</span>
                        <span className="text-xs text-nexus-dim font-mono">0 / {user?.plan === 'enterprise' ? '∞' : user?.plan === 'team' ? '50' : '5'}</span>
                      </div>
                      <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-nexus-warn w-[0%] relative">
                           <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                      </div>
                      <div className="text-[10px] text-nexus-dim mt-2">Análisis de código y PRs este mes.</div>
                    </div>
                  </div>

                  {/* Usuarios de Colaboración */}
                  <div className="p-4 bg-black/40 border border-white/10 rounded-xl relative overflow-hidden group hover:border-purple-500/30 transition-all opacity-0 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-white font-medium">Usuarios en Workspace</span>
                        <span className="text-xs text-nexus-dim font-mono">1 / {user?.plan === 'community' ? '1' : user?.plan === 'team' ? '100' : '∞'}</span>
                      </div>
                      <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5">
                        <div className={`h-full bg-purple-500 relative transition-all ${user?.plan === 'community' ? 'w-[100%]' : user?.plan === 'team' ? 'w-[1%]' : 'w-[5%]'}`}>
                          <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                      </div>
                      <div className="text-[10px] text-nexus-dim mt-2">Cuentas con acceso a tu entorno de métricas.</div>
                    </div>
                  </div>

                  {/* Campañas A/B Testing */}
                  <div className="p-4 bg-black/40 border border-white/10 rounded-xl relative overflow-hidden group hover:border-nexus-blue/30 transition-all opacity-0 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-nexus-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-white font-medium">Campañas A/B Testing</span>
                        <span className="text-xs text-nexus-dim font-mono">0 / {user?.plan === 'community' ? '0' : user?.plan === 'team' ? '100' : '∞'}</span>
                      </div>
                      <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5">
                        <div className={`h-full bg-nexus-blue w-[0%] relative ${user?.plan === 'community' ? 'bg-red-500 w-[100%]' : ''}`}>
                          <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                      </div>
                      <div className="text-[10px] text-nexus-dim mt-2">Pruebas activas de optimización de prompts.</div>
                    </div>
                  </div>

                  {/* Code Reviews Automatizados */}
                  <div className="p-4 bg-black/40 border border-white/10 rounded-xl relative overflow-hidden group hover:border-green-500/30 transition-all opacity-0 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-white font-medium">Code Reviews (Avanzado)</span>
                        <span className="text-xs text-nexus-dim font-mono">0 / {user?.plan === 'community' ? '0' : user?.plan === 'team' ? '100' : '∞'}</span>
                      </div>
                      <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5">
                        <div className={`h-full bg-green-500 w-[0%] relative ${user?.plan === 'community' ? 'bg-red-500 w-[100%]' : ''}`}>
                          <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                      </div>
                      <div className="text-[10px] text-nexus-dim mt-2">Revisiones de código utilizando IA avanzada.</div>
                    </div>
                  </div>

                  {/* Almacenamiento DB */}
                  <div className="p-4 bg-black/40 border border-white/10 rounded-xl relative overflow-hidden group hover:border-orange-500/30 transition-all opacity-0 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-white font-medium">Almacenamiento de Logs</span>
                        <span className="text-xs text-nexus-dim font-mono">0.1GB / {user?.plan === 'community' ? '1GB (Local)' : user?.plan === 'team' ? '50GB (Cloud)' : '∞ (VPC)'}</span>
                      </div>
                      <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-orange-500 w-[2%] relative">
                          <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                      </div>
                      <div className="text-[10px] text-nexus-dim mt-2">Espacio ocupado por trazas y métricas.</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => { setBuyType('plan'); setShowPaymentGateway(true); }} className="flex-1 p-3 bg-gradient-to-r from-nexus-cyan/20 to-nexus-blue/20 hover:from-nexus-cyan/30 hover:to-nexus-blue/30 border border-nexus-cyan/30 hover:border-nexus-cyan rounded-xl transition-all text-white font-bold text-xs tracking-widest text-center shadow-[0_0_15px_rgba(0,212,255,0.1)] hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]">
                    <Sparkles className="inline-block mr-2 -mt-1 text-nexus-cyan" size={14} />
                    MEJORAR PLAN
                  </button>
                  <button onClick={() => { setBuyType('documents'); setShowPaymentGateway(true); }} className="flex-1 p-3 bg-black/40 hover:bg-white/5 border border-white/10 hover:border-nexus-dim rounded-xl transition-all text-white font-bold text-xs tracking-widest text-center">
                    <Database className="inline-block mr-2 -mt-1 text-nexus-dim" size={14} />
                    COMPRAR MÁS USOS
                  </button>
                </div>
              </div>

              {/* Pasarela de Pagos (Mock) */}
              {showPaymentGateway && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                  <div className="nexus-panel p-6 max-w-md w-full relative animate-fade-in-up border border-nexus-cyan/30 shadow-[0_0_30px_rgba(0,212,255,0.15)]">
                    <button onClick={() => setShowPaymentGateway(false)} className="absolute right-4 top-4 text-nexus-dim hover:text-white transition-colors"><X size={20}/></button>
                    <h3 className="font-display text-lg text-white mb-2 flex items-center gap-2">
                      <Sparkles className="text-nexus-cyan" />
                      PASARELA DE PAGOS
                    </h3>
                    <p className="text-xs text-nexus-dim mb-4">Completa los datos para adquirir más recursos o mejorar tu plan.</p>
                    
                    {/* Selector de Compra */}
                    <div className="mb-4 space-y-3 p-3 bg-black/40 border border-white/5 rounded-xl">
                       <div>
                         <label className="text-[10px] text-nexus-dim uppercase tracking-widest block mb-1">Tipo de Compra</label>
                         <select 
                           value={buyType} 
                           onChange={(e) => setBuyType(e.target.value as any)}
                           className="nexus-input w-full text-sm bg-black/60 cursor-pointer text-white"
                         >
                           <option value="documents" className="bg-black text-white">Uso de Documentos (RAG)</option>
                           <option value="repositories" className="bg-black text-white">Uso de Repositorios</option>
                           <option value="plan" className="bg-black text-white">Mejorar Plan (Premium)</option>
                         </select>
                       </div>
                       
                       {buyType !== 'plan' && (
                         <div>
                           <label className="text-[10px] text-nexus-dim uppercase tracking-widest block mb-1">Cantidad de Usos Extra</label>
                           <input 
                             type="number" 
                             min="1" 
                             value={buyQuantity} 
                             onChange={(e) => setBuyQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                             className="nexus-input w-full text-sm bg-black/60" 
                           />
                         </div>
                       )}

                       <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                         <span className="text-xs text-nexus-dim uppercase tracking-widest">Total a Pagar:</span>
                         <div className="text-right">
                           <div className="text-nexus-cyan font-mono font-bold text-lg">
                             {buyType === 'plan' ? '$75.00 USD' : `$${(buyQuantity * 3.5).toFixed(2)} USD`}
                           </div>
                           <div className="text-[10px] text-nexus-dim">
                             {buyType === 'plan' ? '~ 299.000 COP' : `~ ${(buyQuantity * 10000).toLocaleString('es-CO')} COP`}
                           </div>
                         </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] text-nexus-dim uppercase tracking-widest">Número de Tarjeta</label>
                        <input type="text" placeholder="0000 0000 0000 0000" className="nexus-input w-full text-sm mt-1 font-mono tracking-widest bg-black/60" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                           <label className="text-[10px] text-nexus-dim uppercase tracking-widest">Vencimiento</label>
                           <input type="text" placeholder="MM/YY" className="nexus-input w-full text-sm mt-1 font-mono bg-black/60" />
                         </div>
                         <div>
                           <label className="text-[10px] text-nexus-dim uppercase tracking-widest">CVC</label>
                           <input type="text" placeholder="123" className="nexus-input w-full text-sm mt-1 font-mono bg-black/60" />
                         </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-nexus-dim uppercase tracking-widest">Nombre del Titular</label>
                        <input type="text" placeholder="Tu Nombre" className="nexus-input w-full text-sm mt-1 bg-black/60" />
                      </div>
                      <button onClick={() => {toast.success('Compra simulada procesada con éxito'); setShowPaymentGateway(false)}} className="nexus-btn-primary w-full mt-4 bg-gradient-to-r from-nexus-cyan/80 to-nexus-blue/80 border-0">
                        CONFIRMAR PAGO
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Acciones Rápidas */}
              <div className="pt-6 border-t border-white/5">
                <h3 className="font-display text-sm text-nexus-dim mb-4 tracking-widest uppercase">Acciones de Seguridad</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button className="p-4 bg-black/40 border border-white/10 hover:border-nexus-cyan/40 rounded-xl transition-all text-left group">
                    <Key size={20} className="text-nexus-dim group-hover:text-nexus-cyan mb-2 transition-colors" />
                    <div className="text-sm text-white font-medium">Cambiar Contraseña</div>
                    <div className="text-xs text-nexus-dim mt-1">Actualiza tus credenciales de acceso tradicionales.</div>
                  </button>
                  <button className="p-4 bg-black/40 border border-white/10 hover:border-nexus-cyan/40 rounded-xl transition-all text-left group">
                    <Globe size={20} className="text-nexus-dim group-hover:text-nexus-cyan mb-2 transition-colors" />
                    <div className="text-sm text-white font-medium">Exportar Datos</div>
                    <div className="text-xs text-nexus-dim mt-1">Descarga un reporte con toda tu actividad en JSON.</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="nexus-panel p-6 max-w-3xl space-y-8">
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg text-white mb-6">
                  <Palette className="text-nexus-cyan" size={20} />
                  TEMA DEL SISTEMA
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {THEME_OPTIONS.map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => setTheme(opt.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                        theme === opt.id 
                          ? 'bg-nexus-cyan/10 border-nexus-cyan shadow-[0_0_15px_rgba(0,212,255,0.2)]' 
                          : 'bg-black/40 border-white/10 hover:border-nexus-dim hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={`font-display font-bold ${theme === opt.id ? 'text-nexus-cyan' : 'text-white'}`}>
                          {opt.name}
                        </span>
                        {theme === opt.id && (
                          <span className="text-[10px] bg-nexus-cyan/20 text-nexus-cyan px-2 py-0.5 rounded uppercase tracking-wider">
                            ACTIVO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-nexus-dim mb-4">{opt.desc}</p>
                      <div className="flex gap-2">
                        {opt.colors.map((c, i) => (
                          <div 
                            key={i} 
                            className="w-6 h-6 rounded-full shadow-lg" 
                            style={{ backgroundColor: c, boxShadow: `0 0 10px ${c}80` }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <h2 className="flex items-center gap-2 font-display text-lg text-white mb-6">
                  <UserIcon className="text-nexus-cyan" size={20} />
                  TIPOGRAFÍA Y LECTURA
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tipo de Letra */}
                  <div className="space-y-3">
                    <label className="text-xs text-nexus-dim uppercase tracking-widest font-mono">Familia Tipográfica</label>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => setFontFamily('inter')}
                        className={`p-3 text-left rounded-xl border transition-all ${fontFamily === 'inter' ? 'bg-nexus-cyan/10 border-nexus-cyan text-nexus-cyan' : 'bg-black/40 border-white/10 text-white hover:border-nexus-dim'}`}
                      >
                        <span style={{ fontFamily: 'Inter, sans-serif' }}>NEXUS Original (Inter)</span>
                      </button>
                      <button 
                        onClick={() => setFontFamily('roboto')}
                        className={`p-3 text-left rounded-xl border transition-all ${fontFamily === 'roboto' ? 'bg-nexus-cyan/10 border-nexus-cyan text-nexus-cyan' : 'bg-black/40 border-white/10 text-white hover:border-nexus-dim'}`}
                      >
                        <span style={{ fontFamily: 'Roboto, sans-serif' }}>Clásica (Roboto)</span>
                      </button>
                      <button 
                        onClick={() => setFontFamily('space')}
                        className={`p-3 text-left rounded-xl border transition-all ${fontFamily === 'space' ? 'bg-nexus-cyan/10 border-nexus-cyan text-nexus-cyan' : 'bg-black/40 border-white/10 text-white hover:border-nexus-dim'}`}
                      >
                        <span style={{ fontFamily: 'Space Grotesk, sans-serif' }}>CyberTech (Space)</span>
                      </button>
                    </div>
                  </div>

                  {/* Tamaño */}
                  <div className="space-y-3">
                    <label className="text-xs text-nexus-dim uppercase tracking-widest font-mono">Tamaño de Interfaz</label>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => setFontSize('14px')}
                        className={`p-3 text-left rounded-xl border transition-all ${fontSize === '14px' ? 'bg-nexus-cyan/10 border-nexus-cyan text-nexus-cyan' : 'bg-black/40 border-white/10 text-white hover:border-nexus-dim'}`}
                      >
                        Pequeño (14px)
                      </button>
                      <button 
                        onClick={() => setFontSize('16px')}
                        className={`p-3 text-left rounded-xl border transition-all ${fontSize === '16px' ? 'bg-nexus-cyan/10 border-nexus-cyan text-nexus-cyan' : 'bg-black/40 border-white/10 text-white hover:border-nexus-dim'}`}
                      >
                        Estándar (16px)
                      </button>
                      <button 
                        onClick={() => setFontSize('18px')}
                        className={`p-3 text-left rounded-xl border transition-all ${fontSize === '18px' ? 'bg-nexus-cyan/10 border-nexus-cyan text-nexus-cyan' : 'bg-black/40 border-white/10 text-white hover:border-nexus-dim'}`}
                      >
                        Grande (18px)
                      </button>
                    </div>
                  </div>

                  {/* Idioma */}
                  <div className="space-y-3">
                    <label className="text-xs text-nexus-dim uppercase tracking-widest font-mono">Idioma de Preferencia</label>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => {setLanguage('es'); setTimeout(handleSaveProfile, 100)}}
                        className={`p-3 text-left rounded-xl border transition-all ${language === 'es' ? 'bg-nexus-cyan/10 border-nexus-cyan text-nexus-cyan' : 'bg-black/40 border-white/10 text-white hover:border-nexus-dim'}`}
                      >
                        Español (es)
                      </button>
                      <button 
                        onClick={() => {setLanguage('en'); setTimeout(handleSaveProfile, 100)}}
                        className={`p-3 text-left rounded-xl border transition-all ${language === 'en' ? 'bg-nexus-cyan/10 border-nexus-cyan text-nexus-cyan' : 'bg-black/40 border-white/10 text-white hover:border-nexus-dim'}`}
                      >
                        English (en)
                      </button>
                    </div>
                  </div>

                  {/* Hardware Specs */}
                  <div className="space-y-3">
                    <label className="text-xs text-nexus-dim uppercase tracking-widest font-mono">Especificaciones Técnicas</label>
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={hardwareSpecs}
                        onChange={e => setHardwareSpecs(e.target.value)}
                        placeholder="Ej: MacBook Pro M2, 64GB RAM, macOS"
                        className="nexus-input w-full min-h-[100px] text-sm resize-none"
                      />
                      <button onClick={handleSaveProfile} disabled={savingProfile} className="nexus-btn-primary text-xs w-full py-2">
                        {savingProfile ? <Spinner size={14} /> : 'Guardar Specs'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <h2 className="flex items-center gap-2 font-display text-lg text-white mb-6">
                  <Sparkles className="text-nexus-cyan" size={20} />
                  EFECTOS VISUALES
                </h2>
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl cursor-pointer hover:border-white/10">
                    <div>
                      <div className="text-sm text-white font-medium">Animaciones de Interfaz</div>
                      <div className="text-xs text-nexus-dim mt-1">Activa transiciones suaves y efectos de pulso.</div>
                    </div>
                    <div className="w-10 h-5 bg-nexus-cyan/20 rounded-full relative">
                      <div className="absolute right-1 top-1 w-3 h-3 bg-nexus-cyan rounded-full shadow-[0_0_8px_#00d4ff]" />
                    </div>
                  </label>
                  <label className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl cursor-pointer hover:border-white/10">
                    <div>
                      <div className="text-sm text-white font-medium">Fondo de Partículas</div>
                      <div className="text-xs text-nexus-dim mt-1">Mostrar grilla animada en el fondo (consume más GPU).</div>
                    </div>
                    <div className="w-10 h-5 bg-nexus-cyan/20 rounded-full relative">
                      <div className="absolute right-1 top-1 w-3 h-3 bg-nexus-cyan rounded-full shadow-[0_0_8px_#00d4ff]" />
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="nexus-panel p-6 max-w-3xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-lg text-white mb-2">
                    <Fingerprint className="text-nexus-cyan" size={20} />
                    HUELLAS Y DISPOSITIVOS (PASSKEYS)
                  </h2>
                  <p className="text-xs text-nexus-dim">
                    Puedes registrar hasta 5 dispositivos (PC, teléfono, tablet) para iniciar sesión sin contraseña.
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-2xl text-white">{passkeys.length}</span>
                  <span className="text-nexus-dim"> / 5</span>
                </div>
              </div>

              {loadingKeys ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin w-6 h-6 border-2 border-nexus-cyan border-t-transparent rounded-full" />
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {passkeys.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-nexus-dim/30 rounded-xl bg-black/20">
                      <Fingerprint className="text-nexus-dim/50 mx-auto mb-2" size={32} />
                      <p className="text-sm text-nexus-dim">No tienes ninguna huella o dispositivo registrado.</p>
                    </div>
                  ) : (
                    passkeys.map(pk => (
                      <div key={pk.id} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl hover:border-nexus-cyan/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-nexus-blue/10 rounded-lg">
                            <MonitorSmartphone className="text-nexus-cyan" size={18} />
                          </div>
                          <div>
                            <div className="text-sm text-white font-medium">{pk.device_name}</div>
                            <div className="text-[10px] text-nexus-dim">
                              Registrado: {new Date(pk.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeletePasskey(pk.id)}
                          className="p-2 text-nexus-dim hover:text-nexus-danger hover:bg-nexus-danger/10 rounded-lg transition-colors"
                          title="Eliminar dispositivo"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              <button
                onClick={handleRegisterPasskey}
                disabled={registering || passkeys.length >= 5}
                className="nexus-btn-primary w-full"
              >
                {registering ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Plus size={16} />
                )}
                {passkeys.length >= 5 ? 'LÍMITE ALCANZADO (5/5)' : 'REGISTRAR NUEVO DISPOSITIVO'}
              </button>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="nexus-panel p-6 max-w-3xl">
              <h2 className="flex items-center gap-2 font-display text-lg text-white mb-6">
                <Cpu className="text-nexus-cyan" size={20} />
                PROVEEDORES Y CLAVES API
              </h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-black/40 border border-white/5 rounded-xl">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-[#10a37f]/20 text-[#10a37f] rounded-lg flex items-center justify-center font-bold">O</div>
                      <span className="text-white font-medium">OpenAI API Key</span>
                    </div>
                    <span className="px-2 py-1 bg-nexus-success/10 text-nexus-success text-[10px] rounded uppercase tracking-widest">Conectado</span>
                  </div>
                  <input type="password" value="sk-1234567890abcdef1234567890abcdef" readOnly className="nexus-input w-full text-xs text-nexus-dim" />
                </div>

                <div className="p-4 bg-black/40 border border-white/5 rounded-xl">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-[#f5dfb8]/20 text-[#f5dfb8] rounded-lg flex items-center justify-center font-bold">A</div>
                      <span className="text-white font-medium">Anthropic API Key</span>
                    </div>
                    <span className="px-2 py-1 bg-white/10 text-nexus-dim text-[10px] rounded uppercase tracking-widest">Sin Configurar</span>
                  </div>
                  <div className="flex gap-2">
                    <input type="password" placeholder="sk-ant-..." className="nexus-input flex-1 text-xs" />
                    <button className="nexus-btn-primary text-xs px-4">Guardar</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'system_specs' && user?.role === 'admin' && (
            <div className="space-y-6 max-w-4xl">
              
              {/* ── Header ────────────────────────────────────────────── */}
              <div className="nexus-panel p-6">
                <h2 className="flex items-center gap-2 font-display text-lg text-white mb-1">
                  <Database className="text-nexus-warn" size={20} />
                  MEMBRESÍA ENTERPRISE
                </h2>
                <p className="text-xs text-nexus-dim mb-6">El sistema calcula automáticamente cuántos tokens se pueden comprar con el presupuesto en COP, usando la TRM y las tarifas reales de Groq.</p>

                {/* Stats rápidas */}
                {adminData && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="p-3 bg-black/40 border border-nexus-warn/20 rounded-xl text-center">
                      <div className="text-nexus-warn text-lg font-bold font-mono">
                        ${adminData.budget_cop.toLocaleString('es-CO')}
                      </div>
                      <div className="text-[10px] text-nexus-dim uppercase tracking-wider mt-1">Presupuesto COP</div>
                    </div>
                    <div className="p-3 bg-black/40 border border-nexus-cyan/20 rounded-xl text-center">
                      <div className="text-nexus-cyan text-lg font-bold font-mono">
                        {adminData.total_tokens_purchased.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-nexus-dim uppercase tracking-wider mt-1">Tokens Comprados</div>
                    </div>
                    <div className="p-3 bg-black/40 border border-nexus-success/20 rounded-xl text-center">
                      <div className="text-nexus-success text-lg font-bold font-mono">
                        {adminData.token_limit_per_user.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-nexus-dim uppercase tracking-wider mt-1">Tokens / Usuario</div>
                    </div>
                    <div className="p-3 bg-black/40 border border-white/10 rounded-xl text-center">
                      <div className="text-white text-lg font-bold font-mono">{adminData.total_users}</div>
                      <div className="text-[10px] text-nexus-dim uppercase tracking-wider mt-1">Usuarios del Sistema</div>
                    </div>
                  </div>
                )}

                {newLlmProvider === 'ollama' ? (
                  <div className="p-4 bg-nexus-success/10 border border-nexus-success/20 rounded-xl mt-4">
                    <p className="text-nexus-success text-sm flex items-center gap-2">
                      <Shield size={16} />
                      <strong>Facturación Desactivada:</strong> El sistema está utilizando el Motor On-Premise local (Ollama). 
                      El consumo de tokens es ilimitado y gratuito.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Inputs de presupuesto */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 mt-4">
                      <div className="md:col-span-2">
                        <label className="text-xs text-nexus-dim uppercase tracking-widest font-mono mb-2 block">Presupuesto Enterprise ($ COP)</label>
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
                        <label className="text-xs text-nexus-dim uppercase tracking-widest font-mono mb-2 block">TRM (COP/USD)</label>
                        <input
                          type="text"
                          value={formatCOP(newTrm)}
                          onChange={e => setNewTrm(e.target.value.replace(/[^0-9]/g, ''))}
                          className="nexus-input w-full tracking-wider"
                          placeholder="4.200"
                        />
                      </div>
                    </div>

                    {/* Preview en tiempo real */}
                    {parseInt(newBudgetCop || '0') > 0 && (
                      <div className="p-3 mb-4 bg-nexus-warn/5 border border-nexus-warn/20 rounded-xl flex items-center justify-between">
                        <span className="text-xs text-nexus-dim">
                          <span className="text-white font-bold">${parseInt(newBudgetCop.replace(/\./g, '') || '0').toLocaleString('es-CO')} COP</span>
                          {' → '}
                          <span className="text-nexus-dim">(÷ TRM ${parseFloat(newTrm || '4200').toLocaleString()} ÷ ${adminData?.groq_cost_per_million || 0.69}/M tokens)</span>
                        </span>
                        <span className="text-nexus-warn font-bold font-mono text-sm">
                          ≈ {previewTokens.toLocaleString()} tokens
                        </span>
                      </div>
                    )}

                    <button onClick={updateBudget} disabled={savingBudget} className="nexus-btn-primary w-full">
                      {savingBudget ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Database size={16} />}
                      APLICAR PRESUPUESTO
                    </button>
                  </>
                )}
              </div>

              {/* ── Configuración de Motor de IA ───────────────────────── */}
              {adminData && (
                <div className="nexus-panel p-6">
                  <h3 className="flex items-center gap-2 font-display text-md text-white mb-4">
                    <Cpu className="text-nexus-cyan" size={18} />
                    MOTOR DE INTELIGENCIA ARTIFICIAL
                  </h3>
                  <p className="text-xs text-nexus-dim mb-4">
                    Selecciona el proveedor de inferencia a nivel de sistema. Al cambiar a modo On-Premise, se desconectarán las APIs externas y se garantizará el 100% de privacidad local para todos los usuarios.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-nexus-dim uppercase tracking-widest font-mono mb-2 block">Proveedor de IA</label>
                      <select 
                        value={newLlmProvider} 
                        onChange={(e) => {
                          const val = e.target.value
                          setNewLlmProvider(val)
                          if (val === 'ollama') setShowOllamaModal(true)
                        }}
                        className="nexus-input w-full md:w-1/2 bg-[#0e1117] text-white"
                      >
                        <option className="bg-[#0e1117] text-white" value="groq">☁️ Groq (Cloud - Rápido)</option>
                        <option className="bg-[#0e1117] text-white" value="ollama">🔒 Ollama (On-Premise - Privado)</option>
                      </select>
                      
                      {newLlmProvider === 'ollama' && (
                        <div className="mt-3 flex items-center gap-3">
                          <span className="text-[10px] text-nexus-dim font-mono uppercase tracking-widest">ESTADO:</span>
                          {ollamaStatus === 'checking' && <span className="text-[10px] bg-nexus-warn/20 text-nexus-warn px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">COMPROBANDO...</span>}
                          {ollamaStatus === 'running' && <span className="text-[10px] bg-nexus-success/20 text-nexus-success px-2 py-0.5 rounded uppercase tracking-wider">🟢 EN LÍNEA</span>}
                          {ollamaStatus === 'stopped' && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded uppercase tracking-wider">🔴 APAGADO</span>}
                          
                          {ollamaStatus === 'stopped' && (
                            <button 
                              onClick={handleStartOllama} 
                              disabled={startingOllama}
                              className="ml-auto text-xs px-3 py-1 bg-nexus-success text-black font-bold rounded hover:bg-nexus-success/80 transition-all flex items-center gap-2"
                            >
                              {startingOllama ? <div className="animate-spin w-3 h-3 border-2 border-black border-t-transparent rounded-full" /> : <Cpu size={12} />}
                              ENCENDER SERVIDOR
                            </button>
                          )}

                          {ollamaStatus === 'running' && (
                            <button 
                              onClick={handleStopOllama} 
                              disabled={stoppingOllama}
                              className="ml-auto text-xs px-3 py-1 bg-red-500 text-white font-bold rounded hover:bg-red-600 transition-all flex items-center gap-2"
                            >
                              {stoppingOllama ? <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> : <Power size={12} />}
                              APAGAR SERVIDOR
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {newLlmProvider === 'ollama' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up">
                        <div>
                          <label className="text-xs text-nexus-dim uppercase tracking-widest font-mono mb-2 block">Ollama Base URL</label>
                          <input 
                            type="text" 
                            value={newOllamaUrl}
                            onChange={(e) => setNewOllamaUrl(e.target.value)}
                            className="nexus-input w-full"
                            placeholder="http://localhost:11434"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-nexus-dim uppercase tracking-widest font-mono mb-2 block">Modelo (Ollama)</label>
                          <input 
                            type="text" 
                            value={newOllamaModel}
                            onChange={(e) => setNewOllamaModel(e.target.value)}
                            className="nexus-input w-full"
                            placeholder="llama3"
                          />
                        </div>
                      </div>
                    )}
                    
                    <button onClick={handleUpdateLlm} disabled={savingLlm} className="nexus-btn-primary mt-4">
                      {savingLlm ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Shield size={16} />}
                      GUARDAR CONFIGURACIÓN DE IA
                    </button>
                  </div>
                </div>
              )}

              {/* ── Tarjetas de Crédito ───────────────────────────────── */}
              {adminData && adminData.payment_methods.length > 0 && newLlmProvider !== 'ollama' && (
                <div className="nexus-panel p-6">
                  <h3 className="flex items-center gap-2 font-display text-md text-white mb-4">
                    <Sparkles className="text-nexus-cyan" size={18} />
                    CUENTAS VINCULADAS (SIMULADAS)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {adminData.payment_methods.map((card, idx) => (
                      <div
                        key={card.id}
                        className={`relative p-5 rounded-2xl overflow-hidden border transition-all opacity-0 animate-fade-in-up ${
                          card.is_active ? 'border-white/20 shadow-lg' : 'border-white/5 opacity-50'
                        }`}
                        style={{
                          animationDelay: `${idx * 0.15}s`,
                          background: `linear-gradient(135deg, ${card.color_from}33, ${card.color_to}22)`,
                          boxShadow: card.is_active ? `0 0 20px ${card.color_from}40` : 'none'
                        }}
                      >
                        {/* Gradiente decorativo */}
                        <div className="absolute inset-0 opacity-10" style={{ background: `linear-gradient(135deg, ${card.color_from}, ${card.color_to})` }} />
                        
                        <div className="relative">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="text-[10px] text-white/60 uppercase tracking-widest">{card.bank_name}</div>
                              <div className="font-display font-bold text-white">{card.card_type}</div>
                            </div>
                            {card.is_active
                              ? <span className="text-[9px] bg-nexus-success/20 text-nexus-success px-2 py-0.5 rounded uppercase tracking-wider">ACTIVA</span>
                              : <span className="text-[9px] bg-white/10 text-nexus-dim px-2 py-0.5 rounded uppercase tracking-wider">INACTIVA</span>
                            }
                          </div>
                          <div className="font-mono text-white tracking-[4px] mb-3 text-sm">•••• •••• •••• {card.last_four}</div>
                          <div className="text-nexus-warn font-bold font-mono text-lg">
                            ${card.available_balance_cop.toLocaleString('es-CO')}
                            <span className="text-[10px] text-white/40 font-normal ml-1">COP disponible</span>
                          </div>
                          <div className="text-[10px] text-white/40 mt-1">{card.card_holder}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Distribución por usuario ──────────────────────────── */}
              {adminData && (
                <div className="nexus-panel p-6 !overflow-visible">
                  <h3 className="flex items-center gap-2 font-display text-md text-white mb-4">
                    <Users className="text-nexus-cyan" size={18} />
                    GESTIÓN DE USUARIOS Y DISTRIBUCIÓN
                  </h3>

                  {/* ── Formulario de Creación de Usuarios ── */}
                  <form onSubmit={handleCreateUser} className="mb-6 p-4 bg-nexus-cyan/5 border border-nexus-cyan/20 rounded-xl space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <h4 className="font-mono text-xs text-nexus-cyan tracking-widest uppercase">Crear Nueva Cuenta</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block font-mono text-[9px] text-nexus-dim uppercase tracking-widest mb-1">Email</label>
                        <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="nexus-input w-full text-xs py-1.5 px-2" placeholder="usuario@empresa.com" />
                      </div>
                      <div>
                        <label className="block font-mono text-[9px] text-nexus-dim uppercase tracking-widest mb-1">Contraseña</label>
                        <div className="relative">
                          <input 
                            type={showNewPassword ? 'text' : 'password'} 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)} 
                            required 
                            className="nexus-input w-full text-xs py-1.5 px-2 pr-8" 
                            placeholder="••••••••" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-nexus-dim hover:text-white transition-colors"
                            tabIndex={-1}
                          >
                            {showNewPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <label className="block font-mono text-[9px] text-nexus-dim uppercase tracking-widest mb-1">Rol</label>
                        <div 
                          className="nexus-input w-full text-xs py-1.5 px-2 flex justify-between items-center cursor-pointer"
                          onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                        >
                          <span>
                            {newRole === 'admin' ? 'Administrador' : 
                             newRole === 'developer' ? 'Desarrollador' :
                             newRole === 'analyst' ? 'Analista de Datos' :
                             newRole === 'viewer' ? 'Auditor / Lector' : 'Seleccionar...'}
                          </span>
                          <ChevronDown size={12} className={`transition-transform text-nexus-cyan ${isRoleDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>
                        
                        {isRoleDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsRoleDropdownOpen(false)} />
                            <div className="absolute top-[calc(100%+4px)] left-0 min-w-[240px] bg-[#0F172A] border border-nexus-cyan/30 rounded-lg shadow-xl z-50 overflow-hidden divide-y divide-white/5 animate-pop-in">
                              <div 
                                className={`p-3 cursor-pointer hover:bg-nexus-cyan/10 transition-colors ${newRole === 'admin' ? 'bg-nexus-cyan/5 text-nexus-cyan' : 'text-white'}`}
                                onClick={() => { setNewRole('admin'); setIsRoleDropdownOpen(false); }}
                              >
                                <div className="font-medium text-xs">Administrador</div>
                                <div className="text-[10px] text-nexus-dim/80 mt-0.5">Control total del sistema Enterprise</div>
                              </div>
                              <div 
                                className={`p-3 cursor-pointer hover:bg-nexus-cyan/10 transition-colors ${newRole === 'developer' ? 'bg-nexus-cyan/5 text-nexus-cyan' : 'text-white'}`}
                                onClick={() => { setNewRole('developer'); setIsRoleDropdownOpen(false); }}
                              >
                                <div className="font-medium text-xs">Desarrollador</div>
                                <div className="text-[10px] text-nexus-dim/80 mt-0.5">Acceso a repositorios y despliegues</div>
                              </div>
                              <div 
                                className={`p-3 cursor-pointer hover:bg-nexus-cyan/10 transition-colors ${newRole === 'analyst' ? 'bg-nexus-cyan/5 text-nexus-cyan' : 'text-white'}`}
                                onClick={() => { setNewRole('analyst'); setIsRoleDropdownOpen(false); }}
                              >
                                <div className="font-medium text-xs">Analista de Datos</div>
                                <div className="text-[10px] text-nexus-dim/80 mt-0.5">Gestión de métricas, RAG y finanzas</div>
                              </div>
                              <div 
                                className={`p-3 cursor-pointer hover:bg-nexus-cyan/10 transition-colors ${newRole === 'viewer' ? 'bg-nexus-cyan/5 text-nexus-cyan' : 'text-white'}`}
                                onClick={() => { setNewRole('viewer'); setIsRoleDropdownOpen(false); }}
                              >
                                <div className="font-medium text-xs">Auditor / Lector</div>
                                <div className="text-[10px] text-nexus-dim/80 mt-0.5">Rol de solo lectura para reportes</div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <div>
                        <label className="block font-mono text-[9px] text-nexus-dim uppercase tracking-widest mb-1">Plan</label>
                        <select value={newPlan} disabled className="nexus-input w-full text-xs py-1.5 px-2 bg-white/5 opacity-80 cursor-not-allowed">
                          <option value="enterprise">Enterprise (On-Premise)</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" disabled={creatingUser} className="nexus-btn-primary text-xs py-1.5 px-4 flex items-center gap-2">
                        {creatingUser ? <Spinner size={12} /> : <><Plus size={12} /> Crear Cuenta</>}
                      </button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    {adminData.users.map((u, i) => (
                      <div 
                        key={u.email} 
                        className="group p-4 bg-black/40 border border-white/5 rounded-xl transition-all hover:border-nexus-cyan/30 relative opacity-0 animate-fade-in-up"
                        style={{ animationDelay: `${0.2 + (i * 0.05)}s` }}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white font-medium truncate max-w-[200px]">{u.email}</span>
                            <span className={`px-2 py-0.5 text-[9px] rounded uppercase tracking-widest shrink-0 ${
                              u.role === 'admin' ? 'bg-nexus-warn/20 text-nexus-warn' : 'bg-nexus-success/20 text-nexus-success'
                            }`}>{u.role}</span>
                            <span className={`px-2 py-0.5 text-[9px] rounded uppercase tracking-widest shrink-0 ${
                              u.plan === 'enterprise' ? 'bg-purple-500/20 text-purple-400' 
                                : u.plan === 'team' ? 'bg-nexus-warn/20 text-nexus-warn'
                                : 'bg-white/10 text-nexus-dim'
                            }`}>
                              {u.plan === 'enterprise' ? '★ Enterprise' : u.plan === 'team' ? '👥 Team' : 'Community'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="hidden group-hover:flex items-center gap-2 mr-2">
                              <button onClick={() => handleStartEdit(u)} className="p-1.5 rounded-lg bg-nexus-cyan/10 text-nexus-cyan hover:bg-nexus-cyan/20 transition-colors" title="Editar">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDeleteUser(u.email)} className="p-1.5 rounded-lg bg-nexus-danger/10 text-nexus-danger hover:bg-nexus-danger/20 transition-colors" title="Eliminar">
                                <Trash2 size={14} />
                              </button>
                            </div>

                            <div className="text-xs font-mono shrink-0">
                              {u.plan === 'community' ? (
                                <span className="text-nexus-dim">Plan gratuito</span>
                              ) : (
                                <>
                                  <span className={u.usage_percentage >= 100 ? 'text-nexus-danger font-bold' : 'text-white'}>
                                    {u.tokens_used.toLocaleString()}
                                  </span>
                                  <span className="text-nexus-dim"> / {u.token_limit.toLocaleString()} tokens</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {u.plan !== 'community' && (
                          <>
                            <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                              <div
                                className={`h-full transition-all duration-700 rounded-full ${
                                  u.usage_percentage >= 100
                                    ? 'bg-nexus-danger shadow-[0_0_8px_rgba(255,50,50,0.6)]'
                                    : u.usage_percentage > 80
                                    ? 'bg-nexus-warn'
                                    : 'bg-nexus-cyan'
                                }`}
                                style={{ width: `${Math.min(100, u.usage_percentage)}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-nexus-dim text-right mt-1">{u.usage_percentage}% del límite de bolsa compartida</div>
                          </>
                        )}
                        {u.plan === 'community' && (
                          <div className="text-[10px] text-nexus-dim mt-1 flex items-center gap-3">
                            <span>💬 Chat: ∞</span>
                            <span>📄 Docs: 10/mes</span>
                            <span>🔧 Repos: 5/mes</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Modal de Edición de Usuario */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="nexus-panel max-w-md w-full bg-[#0a1628] border-nexus-cyan p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-white text-lg flex items-center gap-2">
                <Edit2 size={18} className="text-nexus-cyan" />
                Editar Usuario
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-nexus-dim hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] text-nexus-dim uppercase tracking-widest mb-1">Email</label>
                <input type="email" value={editingUser} disabled className="nexus-input w-full text-sm py-2 px-3 opacity-50 cursor-not-allowed" />
              </div>
              
              <div>
                <label className="block font-mono text-[10px] text-nexus-dim uppercase tracking-widest mb-1">Nueva Contraseña (Opcional)</label>
                <div className="relative">
                  <input 
                    type={showEditPassword ? 'text' : 'password'} 
                    value={editPassword} 
                    onChange={e => setEditPassword(e.target.value)} 
                    className="nexus-input w-full text-sm py-2 px-3 pr-10" 
                    placeholder="Dejar en blanco para no cambiar" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-nexus-dim hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[10px] text-nexus-dim uppercase tracking-widest mb-1">Rol</label>
                  <select value={editRole} onChange={e => setEditRole(e.target.value)} className="nexus-input w-full text-sm py-2 px-3">
                    <option value="user">Usuario</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-nexus-dim uppercase tracking-widest mb-1">Plan</label>
                  <select value={editPlan} onChange={e => setEditPlan(e.target.value)} className="nexus-input w-full text-sm py-2 px-3">
                    <option value="community">Community</option>
                    <option value="team">Team</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 rounded-xl text-nexus-dim border border-transparent hover:border-white/10 hover:bg-white/5 transition-all text-sm font-mono uppercase tracking-wider">
                  Cancelar
                </button>
                <button type="submit" disabled={updatingUser} className="nexus-btn-primary flex items-center gap-2 py-2 px-6">
                  {updatingUser ? <Spinner size={16} /> : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showOllamaModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="nexus-panel p-8 max-w-lg w-full relative animate-fade-in-up border-nexus-success/30 shadow-[0_0_50px_rgba(16,185,129,0.15)]">
            <h3 className="text-xl font-display text-white mb-4 flex items-center gap-3">
              <Shield className="text-nexus-success" size={28} />
              Motor On-Premise Activado
            </h3>
            <p className="text-sm text-nexus-dim mb-4 leading-relaxed">
              Al guardar esta configuración, NEXUS utilizará <strong>exclusivamente tu infraestructura local</strong> a través de Ollama.
            </p>
            <div className="bg-black/50 border border-white/5 p-4 rounded-xl mb-6">
              <ul className="text-sm text-nexus-dim space-y-3">
                <li className="flex items-start gap-2">
                  <Database className="text-nexus-warn shrink-0 mt-0.5" size={16} />
                  <span>El uso de tokens de terceros <strong>se desactivará</strong> y el presupuesto no será consumido.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="text-nexus-success shrink-0 mt-0.5" size={16} />
                  <span>100% de privacidad garantizada: <strong>Ningún dato de tu código ni documentos saldrá del servidor</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Cpu className="text-nexus-cyan shrink-0 mt-0.5" size={16} />
                  <span>Asegúrate de tener <code>ollama serve</code> ejecutándose en tu servidor con los modelos necesarios descargados.</span>
                </li>
              </ul>
            </div>
            <button 
              onClick={() => setShowOllamaModal(false)}
              className="w-full py-3 px-4 rounded-xl bg-nexus-success/20 border border-nexus-success/50 text-nexus-success hover:bg-nexus-success hover:text-black font-bold tracking-widest uppercase transition-all duration-300"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

    </Layout>
  )
}
