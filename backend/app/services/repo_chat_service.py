import os
import re
import time
import shutil
import tempfile
import subprocess
import logging
from typing import List
from sqlalchemy.orm import Session
from app.services.rag_service import process_document, query_rag

logger = logging.getLogger(__name__)

CODE_EXTENSIONS = {
    '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.go', '.rs', '.cpp', '.c', '.cs',
    '.rb', '.php', '.md', '.yaml', '.yml', '.json', '.xml', '.ini', '.sh', '.txt'
}
IGNORE_DIRS = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build', '.next', 'target', 'vendor'}


def _sanitize_collection_name(repo_url: str) -> str:
    """
    Genera un nombre de colección ChromaDB válido desde la URL del repositorio.

    Reglas ChromaDB (heredadas de Chroma/hnswlib):
      - Entre 3 y 63 caracteres.
      - Debe empezar y terminar con letra o dígito.
      - Solo permite letras, dígitos, guiones (-) y guiones bajos (_).
      - No puede tener dos puntos consecutivos (..).
      - No puede tener formato de dirección IP (e.g. 1.2.3.4).
    """
    # Extraer solo el path relevante: "usuario/repositorio"
    # Ej: https://github.com/cristian-andres-criollo/NEXUS-Observatory
    #   → "cristian_andres_criollo_nexus_observatory"
    name = repo_url.strip().lower()

    # Quitar esquema y dominio
    name = re.sub(r'^https?://', '', name)
    name = re.sub(r'^[^/]+/', '', name)   # quita github.com/
    name = re.sub(r'\.git$', '', name)     # quita .git al final

    # Reemplazar separadores por guión bajo
    name = re.sub(r'[^a-z0-9]+', '_', name)

    # Asegurar que empieza con letra
    if name and not name[0].isalpha():
        name = 'r_' + name

    # Truncar a 60 chars (dejando margen)
    name = name[:60]

    # Quitar guiones al final
    name = name.rstrip('_')

    # Mínimo 3 caracteres
    if len(name) < 3:
        name = (name + 'repo')[:10]

    return name or 'repo_chat_default'


def _list_code_files(root_path: str) -> List[str]:
    files = []
    for dirpath, dirnames, filenames in os.walk(root_path):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        for filename in filenames:
            if any(filename.lower().endswith(ext) for ext in CODE_EXTENSIONS):
                files.append(os.path.join(dirpath, filename))
    return files[:100]


def _read_text_file(path: str, max_chars: int = 3000) -> str:
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as fh:
            return fh.read(max_chars)
    except Exception:
        return ''


def index_repository(repo_url: str, session_id: str, db: Session) -> dict:
    start = time.time()
    repo_name = repo_url.rstrip('/').split('/')[-1].replace('.git', '') or 'repositorio'
    collection_name = _sanitize_collection_name(repo_url)
    repo_path = None
    indexed_files = 0
    total_chunks = 0
    files_list = []

    logger.info(f"[RepoChat] Indexando {repo_url} → colección '{collection_name}'")

    try:
        repo_path = tempfile.mkdtemp(prefix='nexus_repo_')

        # Clonar con timeout extendido
        clone_proc = subprocess.run(
            ['git', 'clone', '--depth=1', '--single-branch', repo_url, repo_path],
            capture_output=True, text=True, timeout=180
        )
        if clone_proc.returncode != 0:
            error = clone_proc.stderr.strip() or clone_proc.stdout.strip()
            raise RuntimeError(f'Error clonando repositorio: {error}')

        code_files = _list_code_files(repo_path)
        if not code_files:
            raise RuntimeError('No se encontraron archivos de código en el repositorio.')

        logger.info(f"[RepoChat] {len(code_files)} archivos encontrados, indexando hasta 50...")

        for file_path in code_files[:50]:
            content = _read_text_file(file_path)
            if not content.strip():
                continue
            relative_name = os.path.relpath(file_path, repo_path)
            try:
                index_result = process_document(content, relative_name, db, collection_name)
                indexed_files += 1
                total_chunks += index_result.get('chunks', 0)
                files_list.append(relative_name)
            except Exception as e:
                logger.warning('[RepoChat] No se pudo indexar %s: %s', relative_name, e)

        latency_ms = int((time.time() - start) * 1000)
        logger.info(f"[RepoChat] Indexado completo: {indexed_files} archivos, {total_chunks} chunks en {latency_ms}ms")

        return {
            'repo_name': repo_name,
            'collection_name': collection_name,
            'files_indexed': indexed_files,
            'chunks_indexed': total_chunks,
            'files_list': files_list,
            'tokens_used': 0,
            'cost_usd': 0.0,
            'latency_ms': latency_ms,
        }
    except Exception as e:
        latency_ms = int((time.time() - start) * 1000)
        logger.error('Error indexando repositorio %s: %s', repo_url, e)
        raise RuntimeError(str(e))
    finally:
        if repo_path and os.path.exists(repo_path):
            shutil.rmtree(repo_path, ignore_errors=True)


def chat_with_repo(question: str, repo_url: str, session_id: str, db: Session, top_k: int = 4, filename_filter: str = None, user_email: str = None) -> dict:
    collection_name = _sanitize_collection_name(repo_url)
    logger.info(f"[RepoChat] Consultando colección '{collection_name}': {question[:60]}...")
    return query_rag(question, session_id, db, collection_name, top_k, module='repo_chat', filename_filter=filename_filter, user_email=user_email)
