# ============================================================================
# MÓDULO: rag_service.py
# DESCRIPCIÓN: Servicio central para el flujo RAG (Retrieval-Augmented Gen)
# 
# FLUJO DE TRABAJO:
# 1. process_document(): Recibe un texto, lo divide en partes (chunks), genera
#    embeddings usando un modelo local (sentence-transformers) y los almacena 
#    en la base de datos vectorial (ChromaDB).
# 2. query_rag(): Recibe una pregunta, la convierte en embedding, busca los 
#    textos más similares en ChromaDB, y usa el LLM (Groq) para responder 
#    basándose ÚNICAMENTE en esos textos recuperados.
#
# NOTA SOBRE EMBEDDINGS: 
# Se usa 'all-MiniLM-L6-v2' (dimensión 384) porque es rápido y corre en local.
# ============================================================================

import time
import logging
from typing import List
from sqlalchemy import desc
from sqlalchemy.orm import Session
from app.core.llm_provider import get_groq_client, get_langchain_llm, encode_texts, encode_query
from app.core.config import settings
from app.models.conversation import Conversation
from app.models.document import Document

logger = logging.getLogger(__name__)

# Cliente ChromaDB persistente (singleton)
_chroma_client = None


def _get_chroma():
    """Devuelve el cliente ChromaDB, creándolo si no existe (singleton con recuperación de errores)."""
    global _chroma_client
    if _chroma_client is None:
        import chromadb
        from chromadb.config import Settings
        _chroma_client = chromadb.PersistentClient(path="./chroma_db", settings=Settings(anonymized_telemetry=False))
    else:
        # Verificar que el cliente sigue vivo; si no, recrearlo
        try:
            _chroma_client.list_collections()
        except Exception:
            logger.warning("ChromaDB client inválido, recreando...")
            import chromadb
            from chromadb.config import Settings
            _chroma_client = chromadb.PersistentClient(path="./chroma_db", settings=Settings(anonymized_telemetry=False))
    return _chroma_client


def _get_collection(name: str = "default"):
    """Obtiene o crea una colección ChromaDB con el nombre dado."""
    client = _get_chroma()
    try:
        return client.get_or_create_collection(name)
    except Exception as e:
        logger.error("Error obteniendo colección '%s': %s", name, e)
        raise


def _get_conversation_history(session_id: str, db: Session, module: str) -> list:
    """Recupera los últimos 6 mensajes de usuario/assistant para proveer contexto RAG."""
    history = (
        db.query(Conversation)
        .filter(Conversation.session_id == session_id, Conversation.module == module)
        .order_by(desc(Conversation.created_at))
        .limit(6)
        .all()
    )
    return list(reversed(history))


def process_document(content: str, filename: str, db: Session, collection_name: str = "default", user_email: str = "admin@nexus.com") -> dict:
    """
    Procesa un documento de texto: lo divide en chunks, genera embeddings locales
    y los guarda en ChromaDB.

    Los embeddings se generan con sentence-transformers (all-MiniLM-L6-v2),
    produciendo vectores de 384 dimensiones.

    Args:
        content:         Texto completo del documento.
        filename:        Nombre del archivo (usado como prefijo de IDs en ChromaDB).
        db:              Sesión de SQLAlchemy.
        collection_name: Nombre de la colección ChromaDB donde guardar los chunks.
        user_email:      Email del usuario que indexa.

    Returns:
        dict con: chunks (cantidad), collection (nombre)
    """
    chunks = _split_text(content, chunk_size=400, overlap=40)
    if not chunks:
        raise ValueError("El documento está vacío o no contiene texto legible.")

    collection = _get_collection(collection_name)

    # Generar embeddings localmente (sentence-transformers, dim=384)
    logger.info("Generando embeddings para %d chunks del archivo '%s'...", len(chunks), filename)
    all_embeddings = encode_texts(chunks)

    # IDs únicos por chunk (prefijo + índice)
    ids = [f"{filename}_{i}" for i in range(len(chunks))]

    # Metadatos para poder filtrar por archivo en la búsqueda
    metadatas = [{"filename": filename} for _ in range(len(chunks))]

    # Upsert: actualiza si el ID ya existe, inserta si no
    collection.upsert(documents=chunks, embeddings=all_embeddings, ids=ids, metadatas=metadatas)

    # Registrar el documento en la base de datos
    doc = Document(
        filename=filename,
        content_preview=content[:2000],
        chunk_count=len(chunks),
        collection_name=collection_name,
        user_email=user_email,
    )
    db.add(doc)
    db.commit()

    logger.info("✅ Documento '%s' indexado: %d chunks en colección '%s'", filename, len(chunks), collection_name)
    return {"chunks": len(chunks), "collection": collection_name}


def delete_document(doc_id: int, db: Session) -> bool:
    """Borra un documento de SQLite y de ChromaDB."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        return False
    
    collection_name = doc.collection_name
    filename = doc.filename
    chunk_count = doc.chunk_count
    
    try:
        client = _get_chroma()
        collection = client.get_collection(collection_name)
        ids_to_delete = [f"{filename}_{i}" for i in range(chunk_count)]
        collection.delete(ids=ids_to_delete)
    except Exception as e:
        logger.warning(f"No se pudo borrar el documento {filename} de ChromaDB: {e}")
        
    db.delete(doc)
    db.commit()
    return True


def delete_all_documents(db: Session, collection_name: str = "default") -> int:
    """Borra todos los documentos de una colección en SQLite y ChromaDB."""
    docs = db.query(Document).filter(Document.collection_name == collection_name).all()
    count = len(docs)
    
    db.query(Document).filter(Document.collection_name == collection_name).delete()
    db.commit()
    
    try:
        client = _get_chroma()
        client.delete_collection(collection_name)
    except Exception as e:
        logger.warning(f"No se pudo vaciar la colección {collection_name} en ChromaDB: {e}")
        
    return count


def query_rag(question: str, session_id: str, db: Session,
              collection_name: str = "default", top_k: int = 4,
              module: str = "rag", filename_filter: str = None,
              user_email: str = None) -> dict:
    """
    Responde una pregunta usando RAG: recupera chunks relevantes y genera la respuesta con Groq.

    Pipeline:
      1. Genera embedding de la pregunta (local, sentence-transformers)
      2. Recupera los top_k chunks más similares de ChromaDB
      3. Construye el contexto y genera la respuesta con el LLM de Groq
      4. Evalúa el groundedness de la respuesta (LLM-as-judge)
      5. Persiste la conversación y métricas en la base de datos

    Args:
        question:        Pregunta del usuario.
        session_id:      ID de sesión.
        db:              Sesión de SQLAlchemy.
        collection_name: Colección ChromaDB a consultar.
        top_k:           Número de chunks a recuperar.
        module:          Módulo que genera la conversación (rag o repo_chat).

    Returns:
        dict con: answer, sources, groundedness_score, hallucination_score,
                  tokens_used, cost_usd, latency_ms, collection_name
    """
    start = time.time()

    # 1. Embedding de la pregunta (local — sin API key)
    q_embedding = encode_query(question)

    # 2. Recuperar chunks relevantes de ChromaDB
    collection = _get_collection(collection_name)
    where_clause = {"filename": filename_filter} if filename_filter else None
    results = collection.query(
        query_embeddings=[q_embedding], 
        n_results=min(top_k, 4),
        where=where_clause
    )
    chunks = results["documents"][0] if results["documents"] else []

    if not chunks:
        return {
            "answer": "No encontré documentos en esta colección. Por favor sube algún documento primero.",
            "sources": [],
            "groundedness_score": 0.0,
            "hallucination_score": 1.0,
            "tokens_used": 0,
            "cost_usd": 0.0,
            "latency_ms": int((time.time() - start) * 1000),
            "collection_name": collection_name,
        }

    context = "\n\n---\n\n".join(chunks)

    # 3. Generar respuesta con Groq vía LangChain
    llm = get_langchain_llm(temperature=0.0)
    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

    history = _get_conversation_history(session_id, db, module)
    history_messages = []
    for row in history:
        history_messages.append(HumanMessage(content=row.user_message))
        history_messages.append(AIMessage(content=row.assistant_message))

    prompt = f"""Eres un analista de datos avanzado. Responde la siguiente pregunta basándote en el contexto proporcionado y en el historial de la conversación.
Tienes permitido sintetizar, resumir, analizar y extraer conclusiones lógicas derivadas de la información del contexto. Si el usuario te pregunta de qué trata el archivo o pide un resumen, constrúyelo usando los fragmentos disponibles.
Si la pregunta es sobre un tema completamente ajeno y es imposible deducir una respuesta a partir de los fragmentos provistos, entonces responde: "No encontré información relacionada con tu pregunta en los documentos cargados."
No uses conocimiento externo ajeno al documento para responder.

CONTEXTO:
{context}

PREGUNTA: {question}

RESPUESTA:"""

    try:
        messages = [
            SystemMessage(content="Eres un asistente experto en análisis de documentos y código. Respondes de forma clara, directa, y solo con información presente en el contexto."),
            *history_messages,
            HumanMessage(content=prompt),
        ]
        response = llm.invoke(messages)
    except Exception as e:
        logger.error(f"Error en RAG al llamar a Groq: {e}")
        raise RuntimeError(f"Error al generar respuesta RAG: {e}")

    answer = response.content
    tokens_in, tokens_out = _extract_tokens(response)
    tokens_total = tokens_in + tokens_out
    latency_ms = int((time.time() - start) * 1000)
    cost = _estimate_cost(tokens_in, tokens_out, settings.GROQ_MODEL)

    # 4. Evaluar groundedness y relevancia con Groq (LLM-as-judge)
    groq_client = get_groq_client()
    groundedness = _evaluate_groundedness(question, answer, context, groq_client)
    hallucination = round(max(0.0, 1.0 - groundedness), 3)
    relevancy = _evaluate_relevancy(question, answer, groq_client)

    # 5. Persistir métricas
    conv = Conversation(
        session_id=session_id,
        user_email=user_email,
        module=module,
        model=settings.GROQ_MODEL,
        user_message=question,
        assistant_message=answer,
        tokens_used=tokens_total,
        cost_usd=cost,
        latency_ms=latency_ms,
        hallucination_score=hallucination,
        groundedness_score=groundedness,
    )
    db.add(conv)
    db.commit()

    logger.info(
        "RAG completado | tokens=%d | latencia=%dms | groundedness=%.2f | relevancy=%.2f",
        tokens_total, latency_ms, groundedness, relevancy
    )

    return {
        "answer": answer,
        "sources": chunks[:3],
        "groundedness_score": groundedness,
        "hallucination_score": hallucination,
        "relevancy_score": relevancy,
        "tokens_used": tokens_total,
        "cost_usd": cost,
        "latency_ms": latency_ms,
        "collection_name": collection_name,
    }


def _evaluate_groundedness(question: str, answer: str, context: str, client) -> float:
    """
    Usa Groq como LLM-judge para evaluar si la respuesta está fundamentada en el contexto.

    Envía un prompt de evaluación al modelo rápido (llama-3.1-8b-instant) y parsea
    el score numérico que devuelve.

    Args:
        question: Pregunta original.
        answer:   Respuesta generada por el LLM.
        context:  Contexto recuperado de ChromaDB.
        client:   Cliente de Groq (openai.OpenAI con base_url de Groq).

    Returns:
        float: Score de groundedness entre 0.0 (inventado) y 1.0 (completamente fundamentado).
    """
    try:
        eval_prompt = f"""Evalúa si la RESPUESTA está completamente fundamentada en el CONTEXTO dado.
Devuelve ÚNICAMENTE un número decimal entre 0.0 y 1.0:
- 1.0 = completamente fundamentada en el contexto
- 0.7 = mayormente fundamentada, con algunos saltos
- 0.5 = parcialmente fundamentada
- 0.2 = poco fundamentada
- 0.0 = inventada / no está en el contexto

CONTEXTO (primeros 800 chars): {context[:800]}

PREGUNTA: {question[:200]}

RESPUESTA: {answer[:400]}

Número (solo el decimal, nada más):"""

        # Usar el modelo rápido de Groq para la evaluación (menor costo y latencia)
        resp = client.chat.completions.create(
            model=settings.GROQ_MODEL,          # llama-3.1-8b-instant por defecto
            messages=[{"role": "user", "content": eval_prompt}],
            max_tokens=5,
            temperature=0.0,
        )
        raw = resp.choices[0].message.content.strip()
        score = float(raw.replace(",", "."))
        return round(min(max(score, 0.0), 1.0), 3)
    except Exception as e:
        logger.warning(f"Evaluador de groundedness falló: {e}")
        return 0.5


def _evaluate_relevancy(question: str, answer: str, client) -> float:
    """
    Evalúa qué tan bien la respuesta contesta la pregunta original (relevancia).
    """
    try:
        eval_prompt = f"""Evalúa la RELEVANCIA de la RESPUESTA a la PREGUNTA dada.
Devuelve ÚNICAMENTE un número decimal entre 0.0 y 1.0:
- 1.0 = respuesta directa y completamente relevante
- 0.5 = parcialmente relevante
- 0.0 = irrelevante o evasiva

PREGUNTA: {question[:200]}

RESPUESTA: {answer[:400]}

Número (solo el decimal, nada más):"""

        resp = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": eval_prompt}],
            max_tokens=5,
            temperature=0.0,
        )
        raw = resp.choices[0].message.content.strip()
        score = float(raw.replace(",", "."))
        return round(min(max(score, 0.0), 1.0), 3)
    except Exception as e:
        logger.warning(f"Evaluador de relevancia falló: {e}")
        return 0.5



def _split_text(text: str, chunk_size: int = 400, overlap: int = 40) -> List[str]:
    """
    Divide el texto en chunks de tamaño fijo con solapamiento.

    Args:
        text:       Texto a dividir.
        chunk_size: Número aproximado de palabras por chunk.
        overlap:    Palabras de solapamiento entre chunks consecutivos.

    Returns:
        Lista de strings (chunks).
    """
    words = text.split()
    if not words:
        return []
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
        i += max(1, chunk_size - overlap)
    return chunks


def _extract_tokens(response) -> tuple[int, int]:
    """Extrae tokens de entrada y salida desde la respuesta LangChain/Groq."""
    try:
        meta = response.usage_metadata
        if meta:
            return (
                meta.get("input_tokens", 0),
                meta.get("output_tokens", 0),
            )
    except Exception:
        pass
    return (0, 0)


def _estimate_cost(input_tokens: int, output_tokens: int, model: str) -> float:
    """Calcula el costo estimado en USD según tarifas de Groq."""
    from app.services.chat_service import GROQ_COST_PER_MILLION_TOKENS
    rates = GROQ_COST_PER_MILLION_TOKENS.get(model, {"input": 0.10, "output": 0.10})
    cost = (input_tokens * rates["input"] + output_tokens * rates["output"]) / 1_000_000
    return round(cost, 8)
