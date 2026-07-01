import os
import time
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

# Extensiones de código que el agente analiza
CODE_EXTENSIONS = {'.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.go',
                   '.rs', '.cpp', '.c', '.cs', '.rb', '.php', '.md', '.yaml', '.yml',
                   '.json', '.sh', '.txt', '.env.example', '.dockerfile'}
# Directorios a ignorar
IGNORE_DIRS = {'.git', 'node_modules', '__pycache__', '.venv', 'venv',
               'dist', 'build', '.next', 'target', 'vendor', '.pytest_cache'}


def analyze_repository(repo_url: str, session_id: str, db: Session = None, user_email: str = None) -> dict:
    """
    Agente multi-paso que:
    1. Clona el repositorio
    2. Lista archivos de código
    3. Lee archivos clave
    4. Detecta issues básicos
    5. Genera reporte técnico detallado con LLM
    """
    start = time.time()
    steps: List[Dict[str, Any]] = []
    repo_path = None

    try:
        # ── PASO 1: Clonar ──────────────────────────────────────────────
        steps.append({"step": 1, "action": f"Clonando repositorio: {repo_url}", "status": "running"})
        repo_path = tempfile.mkdtemp(prefix="nexus_repo_")

        clone_proc = subprocess.run(
            ["git", "clone", "--depth=1", "--single-branch", repo_url, repo_path],
            capture_output=True, text=True, timeout=180
        )
        if clone_proc.returncode != 0:
            error = clone_proc.stderr[:300]
            steps[-1]["status"] = "error"
            steps[-1]["output"] = error
            raise RuntimeError(f"git clone falló: {error}")

        steps[-1]["status"] = "done"
        steps[-1]["output"] = "Repositorio clonado exitosamente"

        # ── PASO 2: Listar archivos ──────────────────────────────────────
        steps.append({"step": 2, "action": "Listando y mapeando estructura del repositorio", "status": "running"})
        all_files = _list_code_files(repo_path)
        file_tree = _build_file_tree(all_files, repo_path)
        steps[-1]["status"] = "done"
        steps[-1]["output"] = f"{len(all_files)} archivos encontrados\n{file_tree[:500]}"

        # ── PASO 3: Leer archivos clave ──────────────────────────────────
        steps.append({"step": 3, "action": "Leyendo archivos clave del repositorio", "status": "running"})
        key_files = _select_key_files(all_files, repo_path)
        file_contents = {}
        for fpath in key_files[:10]:
            content = _read_file(fpath)
            if content:
                rel = os.path.relpath(fpath, repo_path)
                file_contents[rel] = content

        steps[-1]["status"] = "done"
        steps[-1]["output"] = f"{len(file_contents)} archivos leídos: {', '.join(list(file_contents.keys())[:5])}"

        # ── PASO 4: Detectar issues ──────────────────────────────────────
        steps.append({"step": 4, "action": "Análisis estático de código — seguridad y deuda técnica", "status": "running"})
        static_issues = []
        for fname, content in file_contents.items():
            issues = _static_analysis(fname, content)
            static_issues.extend(issues)

        steps[-1]["status"] = "done"
        steps[-1]["output"] = f"{len(static_issues)} issues detectados estáticamente"

        # ── PASO 5: Reporte con LLM ──────────────────────────────────────
        steps.append({"step": 5, "action": "Generando informe técnico exhaustivo con IA", "status": "running"})
        repo_name = repo_url.rstrip("/").split("/")[-1]
        summary = _generate_report(repo_name, all_files, file_contents, static_issues, repo_url, file_tree)
        steps[-1]["status"] = "done"
        steps[-1]["output"] = f"Informe generado ({len(summary)} caracteres)"

        latency_ms = int((time.time() - start) * 1000)
        quality_score = _estimate_quality(static_issues, len(all_files))

        # Estimar tokens y costo con el modelo code review
        estimated_tokens_in = 800
        estimated_tokens_out = 600
        from app.services.chat_service import GROQ_COST_PER_MILLION_TOKENS
        rates = GROQ_COST_PER_MILLION_TOKENS.get(settings.GROQ_CODE_MODEL, {"input": 0.59, "output": 0.79})
        estimated_cost = round(
            (estimated_tokens_in * rates["input"] + estimated_tokens_out * rates["output"]) / 1_000_000, 8
        )

        if db:
            conv = Conversation(
                session_id=session_id,
                user_email=user_email,
                module="repo_agent",
                model=settings.GROQ_CODE_MODEL,
                user_message=f"Analyze repository: {repo_url}",
                assistant_message=summary,
                tokens_used=estimated_tokens_in + estimated_tokens_out,
                cost_usd=estimated_cost,
                latency_ms=latency_ms,
            )
            db.add(conv)
            db.commit()

        return {
            "repo_name": repo_name,
            "summary": summary,
            "files_analyzed": len(file_contents),
            "issues_found": len(static_issues),
            "agent_steps": steps,
            "quality_score": quality_score,
            "tokens_used": estimated_tokens_in + estimated_tokens_out,
            "cost_usd": estimated_cost,
            "latency_ms": latency_ms,
        }

    except Exception as e:
        logger.error(f"Error en repo agent: {e}")
        latency_ms = int((time.time() - start) * 1000)
        repo_name = repo_url.rstrip("/").split("/")[-1]
        if steps and steps[-1]["status"] == "running":
            steps[-1]["status"] = "error"
            steps[-1]["output"] = str(e)[:200]
        return {
            "repo_name": repo_name,
            "summary": f"Error durante el análisis: {str(e)}",
            "files_analyzed": 0,
            "issues_found": 0,
            "agent_steps": steps,
            "quality_score": 0.0,
            "tokens_used": 0,
            "cost_usd": 0.0,
            "latency_ms": latency_ms,
        }
    finally:
        if repo_path and os.path.exists(repo_path):
            shutil.rmtree(repo_path, ignore_errors=True)


def _list_code_files(repo_path: str) -> List[str]:
    files = []
    for root, dirs, filenames in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in filenames:
            if any(f.lower().endswith(ext) for ext in CODE_EXTENSIONS):
                files.append(os.path.join(root, f))
    return files[:200]


def _build_file_tree(all_files: List[str], repo_path: str) -> str:
    """Construye una representación en árbol de la estructura del repositorio."""
    tree_lines = []
    dirs_seen = set()

    for fpath in all_files:
        rel = os.path.relpath(fpath, repo_path)
        parts = rel.replace('\\', '/').split('/')
        # Añadir directorios padre
        for i in range(1, len(parts)):
            dir_path = '/'.join(parts[:i])
            if dir_path not in dirs_seen:
                dirs_seen.add(dir_path)
                indent = '  ' * (i - 1)
                tree_lines.append(f"{indent}📁 {parts[i-1]}/")
        # Añadir archivo
        indent = '  ' * (len(parts) - 1)
        tree_lines.append(f"{indent}📄 {parts[-1]}")

    return '\n'.join(tree_lines[:80])  # limitar a 80 líneas para el prompt


def _select_key_files(all_files: List[str], repo_path: str) -> List[str]:
    """Prioriza README, archivos de configuración y archivos principales."""
    priority = []
    secondary = []
    for f in all_files:
        name = os.path.basename(f).lower()
        if name in {'readme.md', 'readme.rst', 'main.py', 'app.py', 'index.js',
                    'index.ts', 'package.json', 'requirements.txt', 'setup.py',
                    'pyproject.toml', 'docker-compose.yml', 'dockerfile', '.env.example',
                    'main.go', 'src/main.rs', 'pom.xml', 'build.gradle'}:
            priority.append(f)
        else:
            secondary.append(f)
    return (priority + secondary)[:12]


def _read_file(path: str, max_chars: int = 2500) -> str:
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as fh:
            return fh.read(max_chars)
    except Exception:
        return ""


def _static_analysis(filename: str, code: str) -> List[dict]:
    """Análisis estático básico sin LLM."""
    issues = []
    lines = code.split('\n')
    for i, line in enumerate(lines, 1):
        ll = line.lower()
        # Credenciales hardcodeadas
        if any(kw in ll for kw in ('password =', 'secret =', 'api_key =', 'token =', 'private_key =')):
            if '=' in line and not line.strip().startswith('#') and not line.strip().startswith('//'):
                issues.append({"file": filename, "line": i, "type": "security",
                                "description": f"Posible credencial hardcodeada en línea {i}"})
        # Deuda técnica
        for marker in ('TODO', 'FIXME', 'HACK', 'XXX', 'NOQA'):
            if marker in line:
                issues.append({"file": filename, "line": i, "type": "tech_debt",
                                "description": f"Deuda técnica ({marker}): {line.strip()[:80]}"})
        # SQL injection básico
        if ('execute(' in ll or 'query(' in ll) and ('f"' in line or "f'" in line or '%"' in line or "%'" in line):
            issues.append({"file": filename, "line": i, "type": "security",
                            "description": f"Posible SQL injection con f-string/format en línea {i}"})
        # eval/exec peligroso
        if ll.strip().startswith(('eval(', 'exec(')):
            issues.append({"file": filename, "line": i, "type": "security",
                            "description": f"Uso de eval/exec en línea {i} — riesgo de ejecución de código arbitrario"})
    return issues[:25]


def _generate_report(repo_name: str, all_files: List[str], file_contents: dict,
                     static_issues: List[dict], repo_url: str, file_tree: str) -> str:
    """Genera el informe técnico exhaustivo usando llama-3.3-70b-versatile."""
    try:
        llm = get_langchain_llm(model=settings.GROQ_CODE_MODEL, temperature=0.1)
        from langchain_core.messages import HumanMessage, SystemMessage

        # Preparar resumen de archivos con tamaños
        files_with_sizes = []
        for fpath in all_files[:30]:
            rel = os.path.relpath(fpath, os.path.dirname(fpath))
            try:
                size = os.path.getsize(fpath)
                files_with_sizes.append(f"  - {os.path.basename(fpath)} ({size} bytes)")
            except Exception:
                files_with_sizes.append(f"  - {os.path.basename(fpath)}")

        files_summary = '\n'.join(files_with_sizes)

        # Contenidos de archivos clave
        contents_preview = ""
        for fname, content in list(file_contents.items())[:6]:
            ext = fname.split('.')[-1] if '.' in fname else 'txt'
            contents_preview += f"\n\n### Archivo: `{fname}`\n```{ext}\n{content[:800]}\n```"

        # Issues estáticos
        issues_preview = ""
        security_issues = [i for i in static_issues if i.get('type') == 'security']
        tech_debt_issues = [i for i in static_issues if i.get('type') == 'tech_debt']
        if security_issues:
            issues_preview += "\n**Vulnerabilidades de Seguridad:**\n"
            issues_preview += "\n".join(f"  - [{i['file']}:{i['line']}] {i['description']}" for i in security_issues[:8])
        if tech_debt_issues:
            issues_preview += "\n**Deuda Técnica:**\n"
            issues_preview += "\n".join(f"  - [{i['file']}:{i['line']}] {i['description']}" for i in tech_debt_issues[:8])

        prompt = f"""Genera un INFORME TÉCNICO EXHAUSTIVO y DETALLADO del repositorio GitHub "{repo_name}".
URL: {repo_url}

## DATOS DEL REPOSITORIO

### Estructura de Archivos ({len(all_files)} archivos totales):
{file_tree[:1200]}

### Listado de Archivos Principales:
{files_summary}

### Contenido de Archivos Clave:
{contents_preview}

### Issues Detectados ({len(static_issues)} total):
{issues_preview if issues_preview else "No se detectaron issues estáticos."}

---

## INSTRUCCIONES DEL INFORME

Genera un informe técnico profesional y exhaustivo con las siguientes secciones en formato Markdown:

# Informe Técnico: {repo_name}

## 1. Resumen Ejecutivo
Describe el propósito principal del proyecto, su contexto y relevancia técnica (3-5 oraciones).

## 2. Stack Tecnológico
Lista de tecnologías, frameworks, lenguajes y dependencias identificadas con su versión si está disponible.

## 3. Estructura del Repositorio
Describe cómo están organizados los directorios y archivos. Explica la arquitectura del proyecto (monolítica, microservicios, MVC, etc.) y por qué está distribuido así.

## 4. Análisis de Archivos Principales
Para cada archivo clave encontrado, explica:
- Su propósito dentro del proyecto
- Patrones de diseño utilizados
- Dependencias que expone o consume

## 5. Evaluación de Calidad del Código
- Adherencia a buenas prácticas
- Manejo de errores
- Documentación y comentarios
- Complejidad ciclomática estimada

## 6. Análisis de Seguridad
Detalla vulnerabilidades encontradas (si las hay), su severidad y cómo mitigarlas.

## 7. Deuda Técnica
Lista de TODOs, FIXMEs y áreas que requieren refactorización.

## 8. Recomendaciones de Mejora
5-7 recomendaciones concretas y accionables, ordenadas por impacto.

## 9. Métricas Estimadas
| Métrica | Valor |
|---------|-------|
| Total de archivos | {len(all_files)} |
| Archivos analizados | {len(file_contents)} |
| Issues de seguridad | {len(security_issues)} |
| Deuda técnica detectada | {len(tech_debt_issues)} |

Sé técnico, específico y profesional. El informe debe ser en español."""

        response = llm.invoke([
            SystemMessage(content="Eres un arquitecto de software senior con 15 años de experiencia en revisión técnica de repositorios. Generas informes técnicos exhaustivos, precisos y accionables en formato Markdown."),
            HumanMessage(content=prompt),
        ])
        return response.content

    except Exception as e:
        logger.error(f"Error generando reporte con LLM: {e}")
        # Fallback detallado sin LLM
        return f"""# Informe Técnico: {repo_name}

## Resumen
Repositorio analizado: {repo_url}

## Estructura ({len(all_files)} archivos)
{file_tree[:800]}

## Archivos Analizados
{chr(10).join(f'- {k}' for k in list(file_contents.keys()))}

## Issues Detectados ({len(static_issues)})
{chr(10).join(f'- [{i["type"].upper()}] {i["description"]}' for i in static_issues[:15])}

## Nota
El informe detallado no pudo generarse ({str(e)[:100]}). Los datos anteriores son el resultado del análisis estático.
"""


def _estimate_quality(issues: List[dict], total_files: int) -> float:
    if total_files == 0:
        return 0.5
    security_issues = sum(1 for i in issues if i.get("type") == "security")
    tech_debt = sum(1 for i in issues if i.get("type") == "tech_debt")
    score = 1.0 - (security_issues * 0.15) - (tech_debt * 0.03)
    return round(max(0.1, min(1.0, score)), 2)


def analyze_repository_stream(repo_url: str, session_id: str, db: Session = None, user_email: str = None):
    import json
    start = time.time()
    steps = []
    repo_path = None
    
    def emit_step():
        yield json.dumps({"type": "step", "data": steps[-1]}) + "\n"
        
    try:
        # PASO 1
        steps.append({"step": 1, "action": f"Clonando repositorio: {repo_url}", "status": "running", "output": ""})
        yield from emit_step()
        repo_path = tempfile.mkdtemp(prefix="nexus_repo_")
        
        clone_proc = subprocess.run(
            ["git", "clone", "--depth=1", "--single-branch", repo_url, repo_path],
            capture_output=True, text=True, timeout=180
        )
        if clone_proc.returncode != 0:
            steps[-1]["status"] = "error"
            steps[-1]["output"] = clone_proc.stderr[:300]
            yield from emit_step()
            raise RuntimeError(f"git clone falló: {clone_proc.stderr[:300]}")
            
        steps[-1]["status"] = "done"
        steps[-1]["output"] = "Repositorio clonado exitosamente"
        yield from emit_step()
        
        # PASO 2
        steps.append({"step": 2, "action": "Listando y mapeando estructura del repositorio", "status": "running", "output": ""})
        yield from emit_step()
        all_files = _list_code_files(repo_path)
        file_tree = _build_file_tree(all_files, repo_path)
        steps[-1]["status"] = "done"
        steps[-1]["output"] = f"{len(all_files)} archivos encontrados"
        yield from emit_step()
        
        # PASO 3
        steps.append({"step": 3, "action": "Leyendo archivos clave del repositorio", "status": "running", "output": ""})
        yield from emit_step()
        key_files = _select_key_files(all_files, repo_path)
        file_contents = {}
        for fpath in key_files[:10]:
            content = _read_file(fpath)
            if content:
                rel = os.path.relpath(fpath, repo_path)
                file_contents[rel] = content
        steps[-1]["status"] = "done"
        steps[-1]["output"] = f"{len(file_contents)} archivos leídos"
        yield from emit_step()
        
        # PASO 4
        steps.append({"step": 4, "action": "Análisis estático de código", "status": "running", "output": ""})
        yield from emit_step()
        static_issues = []
        for fname, content in file_contents.items():
            issues = _static_analysis(fname, content)
            static_issues.extend(issues)
        steps[-1]["status"] = "done"
        steps[-1]["output"] = f"{len(static_issues)} issues detectados"
        yield from emit_step()
        
        # PASO 5
        steps.append({"step": 5, "action": "Generando informe técnico con IA", "status": "running", "output": ""})
        yield from emit_step()
        repo_name = repo_url.rstrip("/").split("/")[-1]
        summary = _generate_report(repo_name, all_files, file_contents, static_issues, repo_url, file_tree)
        steps[-1]["status"] = "done"
        steps[-1]["output"] = "Informe generado"
        yield from emit_step()
        
        latency_ms = int((time.time() - start) * 1000)
        quality_score = _estimate_quality(static_issues, len(all_files))
        
        estimated_tokens_in = 800
        estimated_tokens_out = 600
        from app.services.chat_service import GROQ_COST_PER_MILLION_TOKENS
        rates = GROQ_COST_PER_MILLION_TOKENS.get(settings.GROQ_CODE_MODEL, {"input": 0.59, "output": 0.79})
        estimated_cost = round((estimated_tokens_in * rates["input"] + estimated_tokens_out * rates["output"]) / 1_000_000, 8)
        
        if db:
            conv = Conversation(
                session_id=session_id, user_email=user_email, module="repo_agent", model=settings.GROQ_CODE_MODEL,
                user_message=f"Analyze repository: {repo_url}", assistant_message=summary,
                tokens_used=estimated_tokens_in + estimated_tokens_out, cost_usd=estimated_cost, latency_ms=latency_ms,
            )
            db.add(conv)
            db.commit()
            
        final_result = {
            "repo_name": repo_name, "summary": summary, "files_analyzed": len(file_contents),
            "issues_found": len(static_issues), "agent_steps": steps, "quality_score": quality_score,
            "tokens_used": estimated_tokens_in + estimated_tokens_out, "cost_usd": estimated_cost, "latency_ms": latency_ms,
        }
        yield json.dumps({"type": "result", "data": final_result}) + "\n"
        
    except Exception as e:
        logger.error(f"Error en repo agent stream: {e}")
        repo_name = repo_url.rstrip("/").split("/")[-1]
        if steps and steps[-1]["status"] == "running":
            steps[-1]["status"] = "error"
            steps[-1]["output"] = str(e)[:200]
            yield from emit_step()
        final_result = {
            "repo_name": repo_name, "summary": f"Error: {e}", "files_analyzed": 0, "issues_found": 0,
            "agent_steps": steps, "quality_score": 0.0, "tokens_used": 0, "cost_usd": 0.0, "latency_ms": int((time.time() - start) * 1000),
        }
        yield json.dumps({"type": "result", "data": final_result}) + "\n"
    finally:
        if repo_path and os.path.exists(repo_path):
            shutil.rmtree(repo_path, ignore_errors=True)
