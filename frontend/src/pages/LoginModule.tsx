import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, Sparkles, LogIn, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../lib/api';

export function LoginModule() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const searchParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = searchParams.get('token');
  
  const [recoveryPin, setRecoveryPin] = useState('');
  const [view, setView] = useState<'login' | 'register' | 'forgot_password' | 'verify_pin' | 'reset_password'>(
    tokenFromUrl ? 'reset_password' : 'login'
  );

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (view === 'reset_password') {
      if (!password) return toast.error('Ingresa una nueva contraseña');
      const tokenToUse = tokenFromUrl || recoveryPin;
      setLoading(true);
      try {
        await authAPI.resetPassword(tokenToUse, password);
        toast.success('Contraseña actualizada. Inicia sesión ahora.');
        window.history.replaceState({}, document.title, window.location.pathname); // clear token
        setView('login');
      } catch (err: any) {
        toast.error('PIN inválido o expirado');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (view === 'forgot_password') {
      if (!email) return toast.error('Ingresa tu correo');
      setLoading(true);
      try {
        await authAPI.forgotPassword(email);
        toast.success('Te hemos enviado un PIN de 6 dígitos.');
        setView('verify_pin');
      } catch (err: any) {
        toast.error('Error procesando la solicitud');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (view === 'verify_pin') {
      if (!recoveryPin || recoveryPin.length !== 6) return toast.error('Ingresa el PIN de 6 dígitos');
      setView('reset_password');
      return;
    }

    if (requires2FA) {
      if (!twoFactorCode) return toast.error('Ingresa el código de 6 dígitos');
      setLoading(true);
      try {
        const res = await authAPI.verify2FA(email, twoFactorCode);
        login(res.data.access_token, res.data);
        toast.success('Autenticación exitosa');
        navigate('/', { replace: true });
      } catch (err: any) {
        toast.error(err.response?.data?.detail || 'Código incorrecto');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || !password) return toast.error('Ingresa correo y contraseña');
    setLoading(true);
    try {
      if (view === 'register') {
        await authAPI.register(email, password);
        toast.success('Cuenta creada exitosamente. Iniciando sesión...');
      }
      const res = await authAPI.login(email, password);
      
      if (res.data.requires_2fa) {
        setRequires2FA(true);
        toast.success('Se ha enviado un código de seguridad a tu correo');
      } else {
        login(res.data.access_token, res.data);
        toast.success(`¡Bienvenido de vuelta!`);
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ocurrió un error al intentar acceder.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-100 rounded-full blur-3xl opacity-50 translate-y-1/2 -translate-x-1/4"></div>

      <div className="w-full max-w-[420px] bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-100 relative z-10 animate-fade-in-up">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-4 mb-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-2 shadow-sm">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {requires2FA ? 'Verificación 2FA' : view === 'register' ? 'Crear una cuenta' : view === 'forgot_password' ? 'Recuperar contraseña' : view === 'verify_pin' ? 'Ingresar PIN' : view === 'reset_password' ? 'Nueva contraseña' : 'Iniciar Sesión'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {requires2FA ? 'Revisa tu bandeja de entrada.' : view === 'forgot_password' ? 'Te enviaremos un PIN de 6 dígitos.' : view === 'verify_pin' ? 'Ingresa el PIN que recibiste por correo.' : view === 'reset_password' ? 'Ingresa tu nueva clave de acceso.' : 'Accede a tu asistente inteligente.'}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="flex flex-col gap-5">
          {requires2FA ? (
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">Código de 6 dígitos</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <KeyRound className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={e => setTwoFactorCode(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50 focus:bg-white text-slate-900 tracking-[0.5em] text-center font-bold"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>
            </div>
          ) : (
            <>
              {(view === 'login' || view === 'register' || view === 'forgot_password') && (
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Correo Electrónico</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <Mail className="w-5 h-5" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50 focus:bg-white text-slate-900"
                      placeholder="ejemplo@correo.com"
                      required
                    />
                  </div>
                </div>
              )}

              {view === 'verify_pin' && (
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">PIN de 6 dígitos</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <KeyRound className="w-5 h-5" />
                    </span>
                    <input
                      type="text"
                      value={recoveryPin}
                      onChange={e => setRecoveryPin(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50 focus:bg-white text-slate-900 tracking-[0.5em] text-center font-bold"
                      placeholder="000000"
                      maxLength={6}
                      required
                    />
                  </div>
                </div>
              )}


              {(view === 'login' || view === 'register' || view === 'reset_password') && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-slate-700 block">
                      {view === 'reset_password' ? 'Nueva Contraseña' : 'Contraseña'}
                    </label>
                    {view === 'login' && (
                      <button type="button" onClick={() => setView('forgot_password')} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <Lock className="w-5 h-5" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50 focus:bg-white text-slate-900"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all transform hover:-translate-y-0.5 shadow-md hover:shadow-lg disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-pulse">Procesando...</span>
            ) : (
              <>
                {requires2FA ? 'Verificar Código' : view === 'register' ? 'Registrarme' : view === 'forgot_password' ? 'Enviar PIN' : view === 'verify_pin' ? 'Continuar' : view === 'reset_password' ? 'Cambiar Contraseña' : 'Entrar'}
                <LogIn className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center flex flex-col gap-2">
          {requires2FA ? (
            <button type="button" onClick={() => setRequires2FA(false)} className="text-sm text-slate-500 hover:text-slate-700">
              Cancelar y volver al login
            </button>
          ) : (view === 'forgot_password' || view === 'verify_pin' || view === 'reset_password') ? (
            <button type="button" onClick={() => {
                setView('login');
                window.history.replaceState({}, document.title, window.location.pathname);
            }} className="text-sm text-slate-500 hover:text-slate-700">
              Volver al inicio de sesión
            </button>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                {view === 'register' ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'}
              </p>
              <button
                type="button"
                onClick={() => setView(view === 'register' ? 'login' : 'register')}
                className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
              >
                {view === 'register' ? 'Inicia sesión aquí' : 'Crea una cuenta gratuita'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
