import os
from cryptography.fernet import Fernet
from app.core.config import settings

# Usar el SECRET_KEY de config como base para la clave Fernet (requiere 32 bytes url-safe base64)
# Aseguramos que sea una clave válida de 32 bytes para Fernet
import base64
import hashlib

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

def _get_fernet_key():
    # Usamos PBKDF2HMAC para derivación robusta de la llave
    salt = os.getenv("CRYPTO_SALT", "nexus-default-salt-123").encode('utf-8')
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
        backend=default_backend()
    )
    key = kdf.derive(settings.SECRET_KEY.encode('utf-8'))
    return base64.urlsafe_b64encode(key)

_fernet = Fernet(_get_fernet_key())

def encrypt_api_key(plain_key: str) -> str:
    """Encripta la API key para guardarla segura en la base de datos."""
    if not plain_key:
        return ""
    return _fernet.encrypt(plain_key.encode('utf-8')).decode('utf-8')

def decrypt_api_key(encrypted_key: str) -> str:
    """Desencripta la API key para su uso en memoria."""
    if not encrypted_key:
        return ""
    try:
        return _fernet.decrypt(encrypted_key.encode('utf-8')).decode('utf-8')
    except Exception:
        return ""

def mask_api_key(plain_key: str) -> str:
    """Oculta la API key para devolverla al frontend, ej: sk-...123"""
    if not plain_key:
        return ""
    if len(plain_key) <= 6:
        return "***"
    return plain_key[:3] + "..." + plain_key[-3:]
