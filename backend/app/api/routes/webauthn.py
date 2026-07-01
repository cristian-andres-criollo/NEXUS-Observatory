"""
WebAuthn / Passkeys — Autenticación Biométrica Web
====================================================
Flujo de REGISTRO:
  1. POST /auth/webauthn/register/begin   → genera challenge + options para el navegador
  2. POST /auth/webauthn/register/complete → verifica y guarda la credencial pública del usuario

Flujo de AUTENTICACIÓN:
  1. POST /auth/webauthn/login/begin     → genera challenge para el credential ID guardado
  2. POST /auth/webauthn/login/complete  → verifica la firma y devuelve JWT
"""

import json
import base64
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import webauthn
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    ResidentKeyRequirement,
    AuthenticatorAttachment,
)
from webauthn.helpers.cose import COSEAlgorithmIdentifier

from app.db.database import get_db
from app.models.user import User
from app.models.webauthn_credential import WebAuthnCredential
from app.core.config import settings

from .auth import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user

router = APIRouter()

# ── Almacenamiento temporal de challenges (en producción usar Redis) ──────────
# Clave: email, Valor: challenge en bytes
_pending_challenges: dict[str, bytes] = {}

import os
# ── Configuración RP (Relying Party = tu servidor) ────────────────────────────
RP_ID   = os.getenv("WEBAUTHN_RP_ID", "localhost")          # En producción: tu dominio real, ej. "nexus.tudominio.com"
RP_NAME = "NEXUS Observatory"
ORIGIN  = os.getenv("WEBAUTHN_ORIGIN", "http://localhost:5173")  # URL del frontend Vite


# ══════════════════════════════════════════════════════════════════════════════
# ESQUEMAS
# ══════════════════════════════════════════════════════════════════════════════

class WebAuthnRegisterBeginResponse(BaseModel):
    options: dict  # PublicKeyCredentialCreationOptions serializado

class WebAuthnRegisterCompleteRequest(BaseModel):
    credential: dict  # AuthenticatorAttestationResponse del navegador

class WebAuthnLoginBeginResponse(BaseModel):
    options: dict  # PublicKeyCredentialRequestOptions serializado

class WebAuthnLoginCompleteRequest(BaseModel):
    credential: dict  # AuthenticatorAssertionResponse del navegador


# ══════════════════════════════════════════════════════════════════════════════
# UTILIDADES
# ══════════════════════════════════════════════════════════════════════════════

def _b64url_encode(data: bytes) -> str:
    """Codifica bytes a base64url sin padding (formato WebAuthn)."""
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

def _b64url_decode(s: str) -> bytes:
    """Decodifica base64url con padding opcional."""
    padding = 4 - len(s) % 4
    if padding != 4:
        s += '=' * padding
    return base64.urlsafe_b64decode(s)


# ══════════════════════════════════════════════════════════════════════════════
# REGISTRO — PASO 1: Generar opciones de creación de credencial
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/auth/webauthn/register/begin")
def webauthn_register_begin(
    current_user: User = Depends(get_current_user),
):
    """
    Requiere estar autenticado (JWT normal).
    Devuelve las opciones que el navegador necesita para llamar a
    navigator.credentials.create() y registrar la huella/passkey.
    """
    if len(current_user.webauthn_credentials) >= 5:
        raise HTTPException(
            status_code=400,
            detail="Has alcanzado el límite máximo de 5 Passkeys registrados."
        )

    options = webauthn.generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=str(current_user.id).encode(),
        user_name=current_user.email,
        user_display_name=current_user.email,
        authenticator_selection=AuthenticatorSelectionCriteria(
            user_verification=UserVerificationRequirement.REQUIRED,
            resident_key=ResidentKeyRequirement.PREFERRED,
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,  # sensor del dispositivo
        ),
        supported_pub_key_algs=[
            COSEAlgorithmIdentifier.ECDSA_SHA_256,
            COSEAlgorithmIdentifier.RSASSA_PKCS1_v1_5_SHA_256,
        ],
        timeout=60000,
    )

    # Guardar challenge para verificar en el paso 2
    _pending_challenges[current_user.email] = options.challenge

    return {
        "options": {
            "challenge": _b64url_encode(options.challenge),
            "rp": {"id": options.rp.id, "name": options.rp.name},
            "user": {
                "id": _b64url_encode(options.user.id),
                "name": options.user.name,
                "displayName": options.user.display_name,
            },
            "pubKeyCredParams": [
                {"type": "public-key", "alg": p.alg.value}
                for p in options.pub_key_cred_params
            ],
            "timeout": options.timeout,
            "authenticatorSelection": {
                "userVerification": "required",
                "residentKey": "preferred",
                "authenticatorAttachment": "platform",
            },
            "attestation": "none",
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# REGISTRO — PASO 2: Verificar y guardar la credencial
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/auth/webauthn/register/complete")
def webauthn_register_complete(
    body: WebAuthnRegisterCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Recibe la respuesta del navegador después de navigator.credentials.create().
    Verifica y almacena la clave pública del Passkey.
    """
    expected_challenge = _pending_challenges.get(current_user.email)
    if not expected_challenge:
        raise HTTPException(status_code=400, detail="No hay un challenge de registro pendiente.")

    cred = body.credential
    try:
        verification = webauthn.verify_registration_response(
            credential=webauthn.helpers.structs.RegistrationCredential(
                id=cred["id"],
                raw_id=_b64url_decode(cred["rawId"]),
                response=webauthn.helpers.structs.AuthenticatorAttestationResponse(
                    client_data_json=_b64url_decode(cred["response"]["clientDataJSON"]),
                    attestation_object=_b64url_decode(cred["response"]["attestationObject"]),
                ),
                type=cred.get("type", "public-key"),
            ),
            expected_challenge=expected_challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
            require_user_verification=True,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verificación de Passkey fallida: {str(e)}")

    # Guardar credencial en la BD
    new_cred = WebAuthnCredential(
        user_id=current_user.id,
        credential_id=_b64url_encode(verification.credential_id),
        public_key=base64.b64encode(verification.credential_public_key).decode(),
        sign_count=verification.sign_count,
        device_name=body.credential.get("deviceName", "Dispositivo desconocido")
    )
    db.add(new_cred)
    db.commit()

    # Limpiar challenge
    _pending_challenges.pop(current_user.email, None)

    return {"message": "✅ Passkey registrado exitosamente. Ahora puedes iniciar sesión con tu huella."}


# ══════════════════════════════════════════════════════════════════════════════
# LOGIN — PASO 1: Generar challenge de autenticación
# ══════════════════════════════════════════════════════════════════════════════

class WebAuthnLoginBeginRequest(BaseModel):
    email: str

@router.post("/auth/webauthn/login/begin")
def webauthn_login_begin(
    body: WebAuthnLoginBeginRequest,
    db: Session = Depends(get_db),
):
    """
    El usuario indica su email. Si tiene Passkey, devolvemos el challenge
    para que el navegador invoque navigator.credentials.get().
    """
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.webauthn_enabled:
        raise HTTPException(
            status_code=404,
            detail="No hay Passkey registrado para este correo."
        )

    options = webauthn.generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=[
            webauthn.helpers.structs.PublicKeyCredentialDescriptor(
                id=_b64url_decode(c.credential_id),
                type=webauthn.helpers.structs.PublicKeyCredentialType.PUBLIC_KEY,
            ) for c in user.webauthn_credentials
        ],
        user_verification=UserVerificationRequirement.REQUIRED,
        timeout=60000,
    )

    _pending_challenges[user.email] = options.challenge

    return {
        "options": {
            "challenge": _b64url_encode(options.challenge),
            "timeout": options.timeout,
            "rpId": RP_ID,
            "allowCredentials": [
                {
                    "id": c.credential_id,
                    "type": "public-key",
                } for c in user.webauthn_credentials
            ],
            "userVerification": "required",
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# LOGIN SIN EMAIL (DISCOVERABLE CREDENTIALS) — PASO 1
# ══════════════════════════════════════════════════════════════════════════════
import uuid

@router.post("/auth/webauthn/login/discoverable/begin")
def webauthn_login_discoverable_begin():
    """
    Genera un challenge genérico para que el navegador busque Passkeys residentes.
    """
    options = webauthn.generate_authentication_options(
        rp_id=RP_ID,
        user_verification=UserVerificationRequirement.REQUIRED,
        timeout=60000,
    )
    
    session_id = str(uuid.uuid4())
    _pending_challenges[session_id] = options.challenge

    return {
        "session_id": session_id,
        "options": {
            "challenge": _b64url_encode(options.challenge),
            "timeout": options.timeout,
            "rpId": RP_ID,
            "userVerification": "required",
        }
    }

# ══════════════════════════════════════════════════════════════════════════════
# LOGIN — PASO 2: Verificar firma biométrica y devolver JWT
# ══════════════════════════════════════════════════════════════════════════════

class WebAuthnLoginCompleteRequest(BaseModel):
    email: str
    credential: dict

@router.post("/auth/webauthn/login/complete")
def webauthn_login_complete(
    body: WebAuthnLoginCompleteRequest,
    db: Session = Depends(get_db),
):
    """
    Verifica la firma del Passkey y, si es válida, devuelve un JWT igual
    que el endpoint de login normal. El frontend lo usa de la misma manera.
    """
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.webauthn_enabled:
        raise HTTPException(status_code=404, detail="Usuario no encontrado o Passkey desactivado.")

    expected_challenge = _pending_challenges.get(user.email)
    if not expected_challenge:
        raise HTTPException(status_code=400, detail="No hay challenge de autenticación pendiente.")

    cred = body.credential
    
    # Buscar cuál de las credenciales se usó
    used_credential = None
    for c in user.webauthn_credentials:
        if c.credential_id == cred["id"]:
            used_credential = c
            break
            
    if not used_credential:
        raise HTTPException(status_code=401, detail="Credencial biométrica no reconocida.")

    try:
        verification = webauthn.verify_authentication_response(
            credential=webauthn.helpers.structs.AuthenticationCredential(
                id=cred["id"],
                raw_id=_b64url_decode(cred["rawId"]),
                response=webauthn.helpers.structs.AuthenticatorAssertionResponse(
                    client_data_json=_b64url_decode(cred["response"]["clientDataJSON"]),
                    authenticator_data=_b64url_decode(cred["response"]["authenticatorData"]),
                    signature=_b64url_decode(cred["response"]["signature"]),
                    user_handle=_b64url_decode(cred["response"]["userHandle"]) if cred["response"].get("userHandle") else None,
                ),
                type=cred.get("type", "public-key"),
            ),
            expected_challenge=expected_challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
            credential_public_key=base64.b64decode(used_credential.public_key),
            credential_current_sign_count=used_credential.sign_count,
            require_user_verification=True,
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Autenticación biométrica fallida: {str(e)}")

    # Actualizar sign count (protección anti-replay)
    used_credential.sign_count = verification.new_sign_count
    db.commit()

    # Limpiar challenge
    _pending_challenges.pop(user.email, None)

    # Generar JWT idéntico al login normal
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "email": user.email,
        "viewed_context_tabs": user.viewed_context_tabs or "{}",
        "theme_color": user.theme_color or "default"
    }

@router.post("/auth/webauthn/login/discoverable/complete")
def webauthn_login_discoverable_complete(
    body: WebAuthnLoginCompleteRequest,
    db: Session = Depends(get_db),
):
    """
    Verifica firma de Passkey cuando no se pasó email. Busca al usuario por credencial.
    """
    session_id = body.email  # Usamos el campo email del DTO para pasar el session_id
    expected_challenge = _pending_challenges.get(session_id)
    if not expected_challenge:
        raise HTTPException(status_code=400, detail="Challenge expirado.")

    cred = body.credential
    
    used_credential = db.query(WebAuthnCredential).filter(WebAuthnCredential.credential_id == cred["id"]).first()
    if not used_credential:
        raise HTTPException(status_code=404, detail="Credencial biométrica no encontrada en la base de datos.")
        
    user = used_credential.user
    if not user or not user.webauthn_enabled:
        raise HTTPException(status_code=401, detail="Usuario desactivado.")

    try:
        verification = webauthn.verify_authentication_response(
            credential=webauthn.helpers.structs.AuthenticationCredential(
                id=cred["id"],
                raw_id=_b64url_decode(cred["rawId"]),
                response=webauthn.helpers.structs.AuthenticatorAssertionResponse(
                    client_data_json=_b64url_decode(cred["response"]["clientDataJSON"]),
                    authenticator_data=_b64url_decode(cred["response"]["authenticatorData"]),
                    signature=_b64url_decode(cred["response"]["signature"]),
                    user_handle=_b64url_decode(cred["response"]["userHandle"]) if cred["response"].get("userHandle") else None,
                ),
                type=cred.get("type", "public-key"),
            ),
            expected_challenge=expected_challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
            credential_public_key=base64.b64decode(used_credential.public_key),
            credential_current_sign_count=used_credential.sign_count,
            require_user_verification=True,
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Autenticación biométrica fallida: {str(e)}")

    used_credential.sign_count = verification.new_sign_count
    db.commit()
    _pending_challenges.pop(session_id, None)

    access_token = create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "email": user.email,
        "viewed_context_tabs": user.viewed_context_tabs or "{}",
        "theme_color": user.theme_color or "default"
    }


@router.delete("/auth/webauthn/delete/{credential_id}")
def webauthn_delete(
    credential_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Elimina un Passkey específico del usuario."""
    cred = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.user_id == current_user.id,
        WebAuthnCredential.credential_id == credential_id
    ).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credencial no encontrada.")
        
    db.delete(cred)
    db.commit()
    return {"message": "Passkey eliminado correctamente."}

@router.get("/auth/webauthn/list")
def webauthn_list(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista los Passkeys registrados por el usuario."""
    creds = db.query(WebAuthnCredential).filter(WebAuthnCredential.user_id == current_user.id).all()
    return [
        {
            "id": c.credential_id,
            "device_name": c.device_name,
            "created_at": c.created_at
        } for c in creds
    ]


# ══════════════════════════════════════════════════════════════════════════════
# ESTADO DEL PASSKEY (para mostrar en UI sin necesitar token)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/auth/webauthn/status/{email}")
def webauthn_status(email: str, db: Session = Depends(get_db)):
    """Indica si un email tiene Passkey registrado. Usado en la pantalla de login."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"has_passkey": False}
    return {"has_passkey": user.webauthn_enabled}
