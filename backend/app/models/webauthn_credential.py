from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class WebAuthnCredential(Base):
    __tablename__ = "webauthn_credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    credential_id = Column(String, unique=True, index=True, nullable=False) # b64url
    public_key = Column(Text, nullable=False) # CBOR en base64
    sign_count = Column(Integer, default=0)
    device_name = Column(String, default="Dispositivo desconocido")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="webauthn_credentials")
