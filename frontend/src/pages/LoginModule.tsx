import React, { useState, useEffect } from 'react'
import { authAPI } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/ui/Spinner'
import { Lock, User, TerminalSquare, Fingerprint, ShieldCheck, AlertCircle, Sparkles, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  isPasskeySupported,
  loginWithDiscoverablePasskey,
  loginWithPasskey,
} from '../lib/webauthn'

export function LoginModule() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [passkeyAvailable, setPasskeyAvailable] = useState(false)
  const { login } = useAuth()

  // Verificar soporte de Passkey al montar
  useEffect(() => {
    isPasskeySupported().then(setPasskeyAvailable)
  }, [])


  // Disparar WebAuthn automáticamente cuando la pantalla carga
  useEffect(() => {
    if (passkeyAvailable && !isRegistering) {
      handleAutoDiscoverablePasskey()
    }
  }, [passkeyAvailable, isRegistering])

  async function handleAutoDiscoverablePasskey() {
    setPasskeyLoading(true)
    try {
      const res = await loginWithDiscoverablePasskey()
      login(res.access_token, { email: res.email, role: res.role, plan: res.plan || 'community', viewed_context_tabs: res.viewed_context_tabs })
      toast.success('✅ Acceso biométrico autorizado', {
        icon: '🔐',
        style: { background: '#0a1628', color: '#00d4ff', border: '1px solid #00d4ff40' },
      })
    } catch (err: any) {
      // Si falla o el usuario cancela, no bloqueamos la app, simplemente lo dejamos usar la contraseña.
      console.log("Auto-login biométrico cancelado o fallido:", err)
    } finally {
      setPasskeyLoading(false)
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return toast.error('Ingresa correo y contraseña')
    setLoading(true)
    try {
      // --- LÓGICA ORIGINAL COMENTADA ---
      // if (isRegistering) {
      //   await authAPI.register(email, password)
      //   toast.success('Cuenta creada exitosamente. Iniciando sesión...')
      //   const res = await authAPI.login(email, password)
      //   login(res.data.access_token, { email: res.data.email, role: res.data.role, plan: res.data.plan || 'community', viewed_context_tabs: res.data.viewed_context_tabs })
      // } else {
      //   const res = await authAPI.login(email, password)
      //   login(res.data.access_token, { email: res.data.email, role: res.data.role, plan: res.data.plan || 'community', viewed_context_tabs: res.data.viewed_context_tabs })
      //   toast.success('Acceso autorizado')
      // }

      // BYPASS TEMPORAL: Siempre ingresar como Enterprise
      login("mock_bypass_token", { 
        email: "admin@nexus.com", 
        role: "admin", 
        plan: "enterprise", 
        viewed_context_tabs: "{}" 
      })
      toast.success('Acceso Enterprise autorizado')

    } catch (err: any) {
      toast.error(err.response?.data?.detail || (isRegistering ? 'Error al registrarse' : 'Credenciales inválidas'))
    } finally {
      setLoading(false)
    }
  }

  async function handlePasskeyLogin() {
    if (!email) return toast.error('Ingresa tu correo primero')
    setPasskeyLoading(true)
    try {
      const res = await loginWithPasskey(email)
      login(res.access_token, { email: res.email, role: res.role })
      toast.success('✅ Acceso biométrico autorizado', {
        icon: '🔐',
        style: { background: '#0a1628', color: '#00d4ff', border: '1px solid #00d4ff40' },
      })
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Error en autenticación biométrica'
      toast.error(msg)
    } finally {
      setPasskeyLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020408] flex flex-col items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-nexus-blue/20 blur-[120px] rounded-full pointer-events-none" />
      {passkeyAvailable && (
        <div className="absolute top-1/3 left-1/3 w-64 h-64 bg-nexus-cyan/5 blur-[100px] rounded-full pointer-events-none" />
      )}

      <div className="w-full max-w-md nexus-panel p-8 flex flex-col gap-8 relative z-10 animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-56 h-auto flex items-center justify-center mb-2">
            <img 
              src="/img/logo web.png" 
              alt="Nexus Logo" 
              className="w-full h-auto object-contain drop-shadow-[0_0_15px_rgba(0,212,255,0.6)]" 
            />
          </div>
          <p className="font-mono text-[10px] text-nexus-dim tracking-widest uppercase">
            {isRegistering ? 'Creación de Nueva Identidad' : 'Autorización Requerida'}
          </p>
        </div>

        {/* ── PASSKEY BUTTON (Siempre visible si se soporta, para disparar el prompt general) ── */}
        {passkeyAvailable && !isRegistering && (
          <div className="flex flex-col gap-2">
            <button
              id="passkey-login-btn"
              type="button"
              disabled={passkeyLoading}
              onClick={handleAutoDiscoverablePasskey}
              className="relative overflow-hidden group w-full py-3.5 rounded-xl border border-nexus-cyan/40 bg-gradient-to-r from-nexus-cyan/10 to-nexus-blue/10 hover:from-nexus-cyan/20 hover:to-nexus-blue/20 transition-all duration-300 flex items-center justify-center gap-3 font-mono text-[11px] tracking-widest text-nexus-cyan uppercase shadow-[0_0_20px_rgba(0,212,255,0.1)] hover:shadow-[0_0_30px_rgba(0,212,255,0.25)]"
            >
              {/* Shimmer effect */}
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-nexus-cyan/10 to-transparent" />
              {passkeyLoading ? (
                <Spinner size={16} />
              ) : (
                <>
                  <Fingerprint size={18} className="text-nexus-cyan animate-pulse" />
                  Iniciar sesión con Passkey
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mt-1">
              <div className="flex-1 h-px bg-white/5" />
              <span className="font-mono text-[9px] text-nexus-dim uppercase tracking-widest">o usa contraseña</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
          </div>
        )}


        {/* ── Formulario email + contraseña ── */}
        <form onSubmit={handleAuth} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[10px] text-nexus-dim uppercase tracking-widest flex items-center gap-2">
              <User size={12} className="text-nexus-cyan" /> Usuario (Email)
            </label>
            <input
              id="email-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="nexus-input py-3"
              placeholder="admin@nexus.com"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-mono text-[10px] text-nexus-dim uppercase tracking-widest flex items-center gap-2">
              <Lock size={12} className="text-nexus-blue" /> Contraseña
            </label>
            <div className="relative">
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="nexus-input py-3 w-full pr-10"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-nexus-dim hover:text-white transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* ── Info NEXUS Community (solo en registro) ── */}
          {isRegistering && (
            <div className="p-4 bg-nexus-cyan/5 border border-nexus-cyan/20 rounded-xl space-y-2">
              <p className="font-display text-[11px] text-nexus-cyan tracking-widest uppercase flex items-center gap-2">
                <Sparkles size={14} /> NEXUS Community — Incluido al registrarse
              </p>
              <ul className="text-[10px] text-nexus-dim space-y-1 font-mono">
                <li className="flex items-center gap-2"><ShieldCheck size={10} className="text-nexus-success" /> Chat con IA — <span className="text-white">Ilimitado</span></li>
                <li className="flex items-center gap-2"><AlertCircle size={10} className="text-nexus-warn" /> Análisis de documentos — <span className="text-white">10/mes</span></li>
                <li className="flex items-center gap-2"><AlertCircle size={10} className="text-nexus-warn" /> Repositorios y Code Review — <span className="text-white">5/mes</span></li>
              </ul>
              <p className="text-[9px] text-nexus-dim/60 italic">El administrador puede ascenderte a Team o Enterprise.</p>
            </div>
          )}

          <button
            id="login-submit-btn"
            type="submit"
            disabled={loading}
            className="nexus-btn-primary py-3 mt-4 flex items-center justify-center gap-2"
          >
            {loading ? <Spinner size={16} /> : (isRegistering ? 'CREAR CUENTA COMMUNITY' : 'INICIAR SESIÓN')}
          </button>
        </form>

        {/* ── Footer ── */}
        <div className="border-t border-white/5 pt-4 text-center flex flex-col gap-3">
          {passkeyAvailable && (
            <div className="flex items-center justify-center gap-1.5">
              <Fingerprint size={10} className="text-nexus-cyan/60" />
              <p className="font-mono text-[9px] text-nexus-cyan/60 tracking-widest uppercase">
                Passkeys / Biométrico disponible
              </p>
            </div>
          )}
          <p className="font-mono text-[9px] text-nexus-dim uppercase tracking-widest">
            Sistema de Observabilidad LLM — Acceso Restringido
          </p>
          <button
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="font-mono text-[10px] text-nexus-cyan hover:text-nexus-glow transition-colors uppercase tracking-widest"
          >
            {isRegistering ? '¿Ya tienes una identidad? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
          </button>
        </div>
      </div>
    </div>
  )
}
