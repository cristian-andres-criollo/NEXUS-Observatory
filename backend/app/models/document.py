from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from app.db.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    content_preview = Column(Text, nullable=True)         # primeros 2000 chars
    chunk_count = Column(Integer, default=0)
    doc_type = Column(String(50), default="text")
    collection_name = Column(String(100), default="default")
    user_email = Column(String(255), nullable=False, default="admin@nexus.com")
    extra = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
