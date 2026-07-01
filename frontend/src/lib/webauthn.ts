/**
 * webauthn.ts — Cliente WebAuthn / Passkeys para NEXUS Observatory
 * =================================================================
 * Abstrae las llamadas al backend y las operaciones de la Web Authentication API
 * (navigator.credentials.create / get) en funciones simples.
 *
 * El navegador se encarga de invocar Windows Hello, Touch ID, Face ID, etc.
 * dependiendo del dispositivo. Nosotros solo orquestamos el flujo.
 */

import { api } from './api'

// ──────────────────────────────────────────────────────────────────────────────
// UTILIDADES base64url (WebAuthn usa base64url, JS usa base64 normal)
// ──────────────────────────────────────────────────────────────────────────────

function b64urlToBuffer(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
  return buffer.buffer
}

function bufferToB64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach(b => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ──────────────────────────────────────────────────────────────────────────────
// VERIFICAR SOPORTE
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Verifica si el navegador y dispositivo actual soportan Passkeys.
 * Requiere HTTPS en producción. Funciona en localhost para desarrollo.
 */
export async function isPasskeySupported(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/**
 * Verifica si el email dado ya tiene un Passkey registrado en el servidor.
 */
export async function hasPasskeyRegistered(email: string): Promise<boolean> {
  try {
    const res = await api.get(`/auth/webauthn/status/${encodeURIComponent(email)}`)
    return res.data.has_passkey === true
  } catch {
    return false
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// REGISTRO DE PASSKEY (desde perfil, usuario ya autenticado)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Inicia el registro de un nuevo Passkey para el usuario autenticado.
 * Requiere el token JWT activo.
 */
export async function registerPasskey(): Promise<void> {
  // Paso 1: pedir opciones al servidor
  const beginRes = await api.post(`/auth/webauthn/register/begin`, {})
  const options = beginRes.data.options

  // Convertir valores base64url → ArrayBuffer para la API del navegador
  const createOptions: PublicKeyCredentialCreationOptions = {
    challenge: b64urlToBuffer(options.challenge),
    rp: { id: options.rp.id, name: options.rp.name },
    user: {
      id: b64urlToBuffer(options.user.id),
      name: options.user.name,
      displayName: options.user.displayName,
    },
    pubKeyCredParams: options.pubKeyCredParams,
    timeout: options.timeout,
    authenticatorSelection: options.authenticatorSelection,
    attestation: 'none',
  }

  // Paso 2: el navegador muestra el prompt biométrico (Windows Hello / Touch ID)
  const credential = await navigator.credentials.create({ publicKey: createOptions }) as PublicKeyCredential | null
  if (!credential) throw new Error('No se completó el registro del Passkey.')

  const attestation = credential.response as AuthenticatorAttestationResponse

  // Paso 3: enviar respuesta al servidor para verificar y guardar
  await api.post(
    `/auth/webauthn/register/complete`,
    {
      credential: {
        id: credential.id,
        rawId: bufferToB64url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToB64url(attestation.clientDataJSON),
          attestationObject: bufferToB64url(attestation.attestationObject),
        },
      },
    }
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// LOGIN CON PASSKEY
// ──────────────────────────────────────────────────────────────────────────────

export interface PasskeyLoginResult {
  access_token: string
  token_type: string
  role: string
  email: string
  plan: string
  viewed_context_tabs: string
}

/**
 * Autentica al usuario usando su Passkey biométrico.
 * 1. Pide challenge al backend
 * 2. El navegador solicita la verificación biométrica
 * 3. Envía la firma al backend → recibe JWT
 */
export async function loginWithPasskey(email: string): Promise<PasskeyLoginResult> {
  // Paso 1: obtener challenge del servidor
  const beginRes = await api.post(`/auth/webauthn/login/begin`, { email })
  const options = beginRes.data.options

  // Convertir a formato que entiende el navegador
  const getOptions: PublicKeyCredentialRequestOptions = {
    challenge: b64urlToBuffer(options.challenge),
    timeout: options.timeout,
    rpId: options.rpId,
    allowCredentials: options.allowCredentials.map((c: { id: string; type: string }) => ({
      id: b64urlToBuffer(c.id),
      type: c.type as PublicKeyCredentialType,
    })),
    userVerification: 'required',
  }

  // Paso 2: el navegador pide la huella / Face ID / Windows Hello
  const credential = await navigator.credentials.get({ publicKey: getOptions }) as PublicKeyCredential | null
  if (!credential) throw new Error('Autenticación biométrica cancelada.')

  const assertion = credential.response as AuthenticatorAssertionResponse

  // Paso 3: enviar firma al backend → recibir JWT
  const completeRes = await api.post(`/auth/webauthn/login/complete`, {
    email,
    credential: {
      id: credential.id,
      rawId: bufferToB64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: bufferToB64url(assertion.clientDataJSON),
        authenticatorData: bufferToB64url(assertion.authenticatorData),
        signature: bufferToB64url(assertion.signature),
        userHandle: assertion.userHandle ? bufferToB64url(assertion.userHandle) : null,
      },
    },
  })

  return completeRes.data
}

/**
 * Autentica automáticamente pidiendo al navegador que muestre las credenciales guardadas.
 * No requiere que el usuario ingrese un email previamente.
 */
export async function loginWithDiscoverablePasskey(): Promise<PasskeyLoginResult> {
  const beginRes = await api.post(`/auth/webauthn/login/discoverable/begin`, {})
  const { session_id, options } = beginRes.data

  const getOptions: PublicKeyCredentialRequestOptions = {
    challenge: b64urlToBuffer(options.challenge),
    timeout: options.timeout,
    rpId: options.rpId,
    userVerification: 'required',
  }

  const credential = await navigator.credentials.get({ publicKey: getOptions }) as PublicKeyCredential | null
  if (!credential) throw new Error('Autenticación biométrica cancelada.')

  const assertion = credential.response as AuthenticatorAssertionResponse

  const completeRes = await api.post(`/auth/webauthn/login/discoverable/complete`, {
    email: session_id,
    credential: {
      id: credential.id,
      rawId: bufferToB64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: bufferToB64url(assertion.clientDataJSON),
        authenticatorData: bufferToB64url(assertion.authenticatorData),
        signature: bufferToB64url(assertion.signature),
        userHandle: assertion.userHandle ? bufferToB64url(assertion.userHandle) : null,
      },
    },
  })

  return completeRes.data
}

// ──────────────────────────────────────────────────────────────────────────────
// DESACTIVAR PASSKEY
// ──────────────────────────────────────────────────────────────────────────────

export async function disablePasskey(): Promise<void> {
  await api.delete(`/auth/webauthn/disable`)
}
