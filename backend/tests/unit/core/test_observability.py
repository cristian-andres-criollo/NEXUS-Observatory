import os
import pytest
from unittest.mock import patch, MagicMock
from app.core.observability import (
    setup_observability,
    _setup_langsmith,
    _setup_weave,
    _setup_phoenix,
    get_openai_client,
    get_langchain_llm
)
from app.core.config import settings

@patch('app.core.observability._setup_langsmith')
@patch('app.core.observability._setup_weave')
@patch('app.core.observability._setup_phoenix')
def test_setup_observability(mock_phoenix, mock_weave, mock_langsmith):
    setup_observability()
    mock_langsmith.assert_called_once()
    mock_weave.assert_called_once()
    mock_phoenix.assert_called_once()

@patch.dict(os.environ, clear=True)
def test_setup_langsmith_enabled():
    with patch('app.core.observability.settings') as mock_settings:
        mock_settings.LANGCHAIN_API_KEY = "test-key"
        mock_settings.LANGCHAIN_PROJECT = "test-project"
        
        _setup_langsmith()
        
        assert os.environ.get("LANGCHAIN_TRACING_V2") == "true"
        assert os.environ.get("LANGCHAIN_API_KEY") == "test-key"
        assert os.environ.get("LANGCHAIN_PROJECT") == "test-project"
        assert os.environ.get("LANGCHAIN_CALLBACKS_BACKGROUND") == "true"

@patch.dict(os.environ, clear=True)
def test_setup_langsmith_disabled():
    with patch('app.core.observability.settings') as mock_settings:
        mock_settings.LANGCHAIN_API_KEY = ""
        
        _setup_langsmith()
        
        assert os.environ.get("LANGCHAIN_TRACING_V2") == "false"
        assert "LANGCHAIN_API_KEY" not in os.environ

@patch('app.core.observability.settings')
def test_setup_weave_disabled(mock_settings):
    mock_settings.WANDB_API_KEY = ""
    # Should just return and log without error
    _setup_weave()

@patch('app.core.observability.settings')
def test_setup_phoenix_disabled(mock_settings):
    mock_settings.PHOENIX_HOST = ""
    # Should just return without error
    _setup_phoenix()

@patch('app.core.llm_provider.get_groq_client')
def test_get_openai_client_retrocompatibility(mock_groq_client):
    mock_client = MagicMock()
    mock_groq_client.return_value = mock_client
    
    result = get_openai_client()
    assert result == mock_client
    mock_groq_client.assert_called_once()

@patch('app.core.llm_provider.get_langchain_llm')
def test_get_langchain_llm_retrocompatibility(mock_get_llm):
    mock_llm = MagicMock()
    mock_get_llm.return_value = mock_llm
    
    result = get_langchain_llm(model="test-model", temperature=0.5)
    assert result == mock_llm
    mock_get_llm.assert_called_once_with(model="test-model", temperature=0.5)
