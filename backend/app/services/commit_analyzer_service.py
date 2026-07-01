import os
import time
import json
import shutil
import tempfile
import subprocess
import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.core.llm_provider import get_langchain_llm
from app.core.config import settings
from app.models.conversation import Conversation

logger = logging.getLogger(__name__)


def _run_git_command(args: List[str], cwd: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=180,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return result.stdout


def _clone_repo(repo_url: str, depth: int, path: str) -> None:
    args = ["clone", "--depth", str(depth), "--single-branch", repo_url, path]
    _run_git_command(args, cwd=".")


def _list_commits(repo_path: str, n_commits: int) -> List[Dict[str, str]]:
    fmt = "%H%x1f%an%x1f%ai%x1f%s%x1e"
    output = _run_git_command([
        "log",
        f"-n{n_commits}",
        f"--pretty=format:{fmt}",
    ], cwd=repo_path)
    commits = []
    for raw_commit in output.split("\x1e"):
        payload = raw_commit.strip()
        if not payload:
            continue
        parts = payload.split("\x1f")
        if len(parts) < 4:
            continue
        commit_hash, author, date, message = parts[0], parts[1], parts[2], parts[3]
        commits.append({
            "hash": commit_hash,
            "author": author,
            "date": date,
            "message": message,
        })
    return commits


def _get_commit_diff(repo_path: str, commit_hash: str, max_chars: int = 2500) -> str:
    diff = _run_git_command([
        "show",
        "--no-color",
        "--unified=3",
        commit_hash,
    ], cwd=repo_path)
    return diff[:max_chars]


def _parse_judge_output(raw: str) -> Dict[str, Any]:
    """Parsea la salida del LLM judge de forma robusta, tolerando None y malformados."""
    parsed = {
        "risk_score": 0.0,
        "risk_level": "BAJO",
        "summary": "Sin análisis disponible.",
        "issues": [],
    }

    # Verificaciones defensivas: None, vacío, o no-string
    if not raw or not isinstance(raw, str):
        logger.warning("_parse_judge_output: raw output es None o vacío, usando fallback")
        return parsed

    raw = raw.strip()
    if not raw:
        return parsed

    parsed["summary"] = raw  # fallback en caso de no poder parsear JSON

    try:
        # Intentar extraer JSON si viene envuelto en markdown
        text = raw
        if "```" in text:
            parts = text.split("```")
            for part in parts:
                cleaned = part.strip()
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:].strip()
                if cleaned.startswith("{"):
                    text = cleaned
                    break

        # Buscar el primer objeto JSON en el texto
        start_idx = text.find("{")
        end_idx = text.rfind("}") + 1
        if start_idx != -1 and end_idx > start_idx:
            data = json.loads(text[start_idx:end_idx])
            if data and isinstance(data, dict):
                risk_score = float(data.get("risk_score") or 0.0)
                parsed["risk_score"] = round(min(max(risk_score, 0.0), 1.0), 3)
                parsed["risk_level"] = str(data.get("risk_level") or "BAJO").upper()
                parsed["summary"] = str(data.get("summary") or parsed["summary"])
                issues = data.get("issues") or []
                if isinstance(issues, list):
                    parsed["issues"] = [str(item) for item in issues if item]
                return parsed
    except (json.JSONDecodeError, ValueError, TypeError) as e:
        logger.debug(f"JSON parse falló ({e}), usando heurística de texto")

    # Fallback: heurística basada en palabras clave
    score = 0.0
    text_lower = raw.lower()
    if any(kw in text_lower for kw in ("critical", "crítico", "vulnerab", "sql injection", "rce")):
        score = max(score, 0.9)
    elif any(kw in text_lower for kw in ("high", "alto", "breaking", "incompatible")):
        score = max(score, 0.7)
    elif any(kw in text_lower for kw in ("medium", "medio", "tech debt", "deuda técnica", "fixme")):
        score = max(score, 0.5)
    elif any(kw in text_lower for kw in ("low", "bajo", "minor", "style")):
        score = 0.2

    parsed["risk_score"] = score
    parsed["risk_level"] = _risk_level(score)
    return parsed


def _risk_level(score: float) -> str:
    if score >= 0.8:
        return "CRÍTICO"
    if score >= 0.6:
        return "ALTO"
    if score >= 0.35:
        return "MEDIO"
    return "BAJO"


def _analyze_diff(commit: Dict[str, str], diff: str) -> Dict[str, Any]:
    """Analiza un diff de commit usando el modelo de código (más capaz y fiable)."""
    try:
        # Usar el modelo más potente para análisis de commits — más fiable en JSON
        llm = get_langchain_llm(model=settings.GROQ_CODE_MODEL, temperature=0.0)
        from langchain_core.messages import HumanMessage, SystemMessage

        prompt = f"""Eres un especialista en auditoría de commits y seguridad de software.
Analiza el siguiente diff de git y detecta:
- deuda técnica
- vulnerabilidades de seguridad (SQL injection, XSS, credenciales, etc.)
- breaking changes
- violaciones de convenciones de estilo y arquitectura

Commit: {commit['hash'][:12]}
Autor: {commit['author']}
Fecha: {commit['date']}
Mensaje: {commit['message']}

DIFF:
{diff}

Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown:
{{
  "risk_score": 0.3,
  "risk_level": "BAJO",
  "summary": "Descripción breve del commit y sus cambios",
  "issues": ["Issue 1", "Issue 2"]
}}"""

        response = llm.invoke([
            SystemMessage(content="Eres un auditor riguroso de código y commits. Responde SIEMPRE con JSON válido y nada más."),
            HumanMessage(content=prompt),
        ])

        content = response.content if response and hasattr(response, 'content') else None
        return _parse_judge_output(content)

    except Exception as e:
        logger.warning(f"Error en _analyze_diff para commit {commit.get('hash', 'unknown')[:8]}: {e}")
        return {
            "risk_score": 0.0,
            "risk_level": "BAJO",
            "summary": f"No se pudo analizar el commit: {str(e)[:100]}",
            "issues": [],
        }


def analyze_commits(repo_url: str, n_commits: int, session_id: str, db: Session = None, user_email: str = None) -> dict:
    repo_path = None
    start = time.time()
    try:
        repo_path = tempfile.mkdtemp(prefix="nexus_commits_")

        # Clonar — usar variable distinta para no colisionar con results del loop
        clone_result = subprocess.run(
            ["git", "clone", "--depth", str(n_commits + 5), "--single-branch", repo_url, repo_path],
            capture_output=True,
            text=True,
            timeout=180,
        )
        if clone_result.returncode != 0:
            error_msg = clone_result.stderr.strip() or clone_result.stdout.strip()
            raise RuntimeError(f"Error clonando repositorio: {error_msg}")

        commits = _list_commits(repo_path, n_commits)
        if not commits:
            raise RuntimeError("No se encontraron commits en el repositorio.")

        results = []
        highest_risk = 0.0
        for commit in commits:
            try:
                diff = _get_commit_diff(repo_path, commit["hash"])
                analysis = _analyze_diff(commit, diff)
            except Exception as e:
                logger.warning(f"Error analizando commit {commit.get('hash', '')[:8]}: {e}")
                analysis = {
                    "risk_score": 0.0,
                    "risk_level": "BAJO",
                    "summary": f"Error en análisis: {str(e)[:80]}",
                    "issues": [],
                }

            risk_score = min(max(float(analysis.get("risk_score") or 0.0), 0.0), 1.0)
            risk_level = _risk_level(risk_score)
            results.append({
                "hash": commit["hash"],
                "author": commit["author"],
                "date": commit["date"],
                "message": commit["message"],
                "risk_score": risk_score,
                "risk_level": risk_level,
                "summary": str(analysis.get("summary") or "Sin resumen"),
                "issues": list(analysis.get("issues") or []),
            })
            highest_risk = max(highest_risk, risk_score)

        avg_risk = round(sum(item["risk_score"] for item in results) / max(1, len(results)), 3)
        latency_ms = int((time.time() - start) * 1000)

        estimated_tokens_in = 600 * len(commits)
        estimated_tokens_out = 200 * len(commits)
        from app.services.chat_service import GROQ_COST_PER_MILLION_TOKENS
        rates = GROQ_COST_PER_MILLION_TOKENS.get(settings.GROQ_CODE_MODEL, {"input": 0.59, "output": 0.79})
        estimated_cost = round((estimated_tokens_in * rates["input"] + estimated_tokens_out * rates["output"]) / 1_000_000, 8)
        
        if db:
            conv = Conversation(
                session_id=session_id,
                user_email=user_email,
                module="code_review",
                model=settings.GROQ_CODE_MODEL,
                user_message=f"Analyze {n_commits} commits from {repo_url}",
                assistant_message=f"Analyzed {len(commits)} commits with avg risk {avg_risk}",
                tokens_used=estimated_tokens_in + estimated_tokens_out,
                cost_usd=estimated_cost,
                latency_ms=latency_ms,
            )
            db.add(conv)
            db.commit()

        return {
            "repo_url": repo_url,
            "commits": results,
            "average_risk": avg_risk,
            "highest_risk": highest_risk,
            "tokens_used": estimated_tokens_in + estimated_tokens_out,
            "cost_usd": estimated_cost,
            "latency_ms": latency_ms,
        }
    except Exception as e:
        raise RuntimeError(f"Error analizando commits: {e}")
    finally:
        if repo_path and os.path.exists(repo_path):
            shutil.rmtree(repo_path, ignore_errors=True)
