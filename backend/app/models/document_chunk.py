from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    from sqlalchemy.types import NullType
    class Vector(NullType):
        def __init__(self, *args, **kwargs):
            super().__init__()

from app.db.database import Base



class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(384)) # Dimensión del modelo all-MiniLM-L6-v2
    created_at = Column(DateTime(timezone=True), server_default=func.now())
