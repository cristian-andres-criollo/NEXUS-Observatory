import pytest
from app.core.crypto import encrypt_api_key, decrypt_api_key, mask_api_key

def test_encrypt_decrypt_valid_key():
    original_key = "sk-test-super-secret-12345"
    encrypted = encrypt_api_key(original_key)
    
    assert encrypted != original_key
    assert len(encrypted) > 0
    
    decrypted = decrypt_api_key(encrypted)
    assert decrypted == original_key

def test_encrypt_empty_string():
    assert encrypt_api_key("") == ""
    assert encrypt_api_key(None) == ""

def test_decrypt_empty_string():
    assert decrypt_api_key("") == ""
    assert decrypt_api_key(None) == ""

def test_decrypt_invalid_string():
    # An invalid fernet token should return empty string per our implementation
    assert decrypt_api_key("invalid-encrypted-string") == ""

def test_mask_api_key():
    assert mask_api_key("sk-1234567890abcdef") == "sk-...def"
    assert mask_api_key("short") == "***"
    assert mask_api_key("") == ""
    assert mask_api_key(None) == ""
