"""Pruebas de la validación de configuración sensible (SECRET_KEY, DATABASE_URL)."""
import pytest
from pydantic import ValidationError

from app.core.config import Settings, INSECURE_DEV_SECRET_KEY

STRONG_KEY = "k" * 48


def make(**kwargs):
    # _env_file=None: ignora el .env local para que la prueba sea determinista
    return Settings(_env_file=None, **kwargs)


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("DEBUG", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)


def test_secret_key_missing_in_production_fails():
    with pytest.raises(ValidationError, match="SECRET_KEY no está configurado"):
        make(DEBUG=False)


def test_secret_key_too_short_fails():
    with pytest.raises(ValidationError, match="al menos 32"):
        make(SECRET_KEY="corta", DEBUG=False)


def test_public_dev_key_rejected_in_production():
    with pytest.raises(ValidationError, match="clave pública de desarrollo"):
        make(SECRET_KEY=INSECURE_DEV_SECRET_KEY, DEBUG=False)


def test_strong_key_accepted_in_production():
    assert make(SECRET_KEY=STRONG_KEY, DEBUG=False).SECRET_KEY == STRONG_KEY


def test_debug_without_key_falls_back_to_dev_key():
    assert make(DEBUG=True).SECRET_KEY == INSECURE_DEV_SECRET_KEY


def test_secret_key_read_from_environment(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", STRONG_KEY)
    assert make().SECRET_KEY == STRONG_KEY


def test_validation_error_does_not_leak_values():
    with pytest.raises(ValidationError) as exc:
        make(SECRET_KEY="corta", GROQ_API_KEYS="gsk_super_secreta", DEBUG=False)
    assert "gsk_super_secreta" not in str(exc.value)
    assert "corta" not in str(exc.value)


def test_default_database_url_has_no_credentials():
    url = make(SECRET_KEY=STRONG_KEY).DATABASE_URL
    assert url.startswith("sqlite")
    assert "@" not in url
