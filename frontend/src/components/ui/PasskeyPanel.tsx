/**
 * PasskeyPanel.tsx — Panel de gestión de Passkey / biometría web
 * ===============================================================
 * Componente modal para registrar o desactivar el Passkey del usuario.
 * Se invoca desde el TopBar o desde cualquier página del sistema.
 */

import React, { useState, useEffect } from 'react'
import { Fingerprint, ShieldCheck, ShieldOff, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import {
  isPasskeySupported,
  hasPasskeyRegistered,
  registerPasskey,
  disablePasskey,
} from '../../lib/webauthn'

interface PasskeyPanelProps {
  onClose: () => void
}

type PanelStatus = 'idle' | 'loading' | 'success' | 'error'

export function PasskeyPanel({ onClose }: PasskeyPanelProps) {
  const { token, user } = useAuth()
  const [supported, setSupported] = useState<boolean | null>(null)
  const [hasPasskey, setHasPasskey] = useState<boolean>(false)
  const [status, setStatus] = useState<PanelStatus>('idle')
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    async function check() {
      const sup = await isPasskeySupported()
      setSupported(sup)
      if (sup && user?.email) {
        const has = await hasPasskeyRegistered(user.email)
        setHasPasskey(has)
      }
    }
    check()
  }, [user])

  async function handleRegister() {
    if (!token) return
    setStatus('loading')
    setStatusMsg('Activando sensor biométrico...')
    try {
      await registerPasskey()
      setHasPasskey(true)
      setStatus('success')
      setStatusMsg('¡Passkey registrado! Ya puedes iniciar sesión con tu huella digital.')
      toast.success('Passkey activado correctamente', { icon: '🔐' })
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Error al registrar Passkey'
      setStatus('error')
      setStatusMsg(msg)
      toast.error(msg)
    }
  }

  async function handleDisable() {
    if (!token) return
    setStatus('loading')
    setStatusMsg('Desactivando Passkey...')
    try {
      await disablePasskey()
      setHasPasskey(false)
      setStatus('success')
      setStatusMsg('Passkey desactivado. Usa tu contraseña para iniciar sesión.')
      toast.success('Passkey desactivado')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Error al desactivar Passkey'
      setStatus('error')
      setStatusMsg(msg)
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm nexus-panel p-6 flex flex-col gap-5 relative animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-nexus-dim hover:text-white transition-colors"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nexus-cyan/20 to-nexus-blue/20 border border-nexus-cyan/20 flex items-center justify-center">
            <Fingerprint size={20} className="text-nexus-cyan" />
          </div>
          <div>
            <h2 className="font-display text-sm tracking-widest text-white">PASSKEY BIOMÉTRICO</h2>
            <p className="font-mono text-[9px] text-nexus-dim tracking-wider uppercase">Seguridad avanzada</p>
          </div>
        </div>

        {/* Soporte */}
        {supported === false && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
            <p className="font-mono text-[10px] text-yellow-300">
              Tu navegador o dispositivo no soporta Passkeys. Usa Chrome/Edge con Windows Hello, o Safari con Touch ID.
            </p>
          </div>
        )}

        {supported === true && (
          <>
            {/* Estado actual */}
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${
              hasPasskey
                ? 'bg-nexus-success/10 border-nexus-success/20'
                : 'bg-nexus-blue/10 border-nexus-blue/20'
            }`}>
              {hasPasskey ? (
                <ShieldCheck size={14} className="text-nexus-success shrink-0" />
              ) : (
                <ShieldOff size={14} className="text-nexus-dim shrink-0" />
              )}
              <div>
                <p className={`font-mono text-[10px] tracking-widest uppercase ${hasPasskey ? 'text-nexus-success' : 'text-nexus-dim'}`}>
                  {hasPasskey ? 'Passkey activo' : 'Sin Passkey registrado'}
                </p>
                <p className="font-mono text-[9px] text-nexus-dim mt-0.5">
                  {hasPasskey
                    ? 'Puedes iniciar sesión con huella digital o Face ID'
                    : 'Registra tu huella para acceso rápido y seguro'}
                </p>
              </div>
            </div>

            {/* Descripción */}
            {!hasPasskey && (
              <div className="space-y-2 px-1">
                <p className="font-mono text-[9px] text-nexus-dim leading-relaxed">
                  Un Passkey reemplaza tu contraseña usando la biometría de tu dispositivo:
                </p>
                <ul className="space-y-1">
                  {['Windows Hello (huella / reconocimiento facial)', 'Touch ID / Face ID en Mac e iOS', 'Sensor de huella en Android'].map(item => (
                    <li key={item} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-nexus-cyan" />
                      <span className="font-mono text-[9px] text-nexus-dim">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Estado de la operación */}
            {status === 'loading' && (
              <div className="flex items-center gap-2 text-nexus-cyan">
                <Loader2 size={14} className="animate-spin" />
                <span className="font-mono text-[10px]">{statusMsg}</span>
              </div>
            )}
            {status === 'success' && (
              <div className="flex items-center gap-2 text-nexus-success">
                <CheckCircle2 size={14} />
                <span className="font-mono text-[10px]">{statusMsg}</span>
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle size={14} />
                <span className="font-mono text-[10px]">{statusMsg}</span>
              </div>
            )}

            {/* Acciones */}
            <div className="flex flex-col gap-2 mt-1">
              {!hasPasskey ? (
                <button
                  id="register-passkey-btn"
                  disabled={status === 'loading'}
                  onClick={handleRegister}
                  className="nexus-btn-primary py-2.5 flex items-center justify-center gap-2 text-xs tracking-widest"
                >
                  <Fingerprint size={14} />
                  REGISTRAR PASSKEY
                </button>
              ) : (
                <button
                  id="disable-passkey-btn"
                  disabled={status === 'loading'}
                  onClick={handleDisable}
                  className="w-full py-2.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400 font-mono text-[10px] tracking-widest uppercase flex items-center justify-center gap-2"
                >
                  <ShieldOff size={14} />
                  Desactivar Passkey
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
