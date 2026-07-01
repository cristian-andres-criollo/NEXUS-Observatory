from pydantic import BaseModel, Field
from typing import Literal


class ABConfig(BaseModel):
    model: str = Field(..., example="llama-3.3-70b-versatile")
    temperature: float = Field(..., ge=0.0, le=1.0, example=0.1)
    system_prompt: str = Field(..., example="Eres un asistente técnico y conciso.")


class ABCompareRequest(BaseModel):
    prompt: str
    config_a: ABConfig
    config_b: ABConfig


class ABCompareResponse(BaseModel):
    response_a: str
    response_b: str
    tokens_a: int
    tokens_b: int
    cost_a: float
    cost_b: float
    latency_a: int
    latency_b: int
    winner: Literal['A', 'B', 'TIE']
    judge_explanation: str
    model_a: str
    model_b: str
    temperature_a: float
    temperature_b: float
