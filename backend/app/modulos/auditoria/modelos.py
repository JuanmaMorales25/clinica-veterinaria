import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, ConId, ahora


class EventoAuditoria(ConId, Base):
    """Quién cambió qué y cuándo."""

    __tablename__ = "evento_auditoria"

    usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuario.id"))
    accion: Mapped[str] = mapped_column(String(60))
    entidad: Mapped[str] = mapped_column(String(60))
    entidad_id: Mapped[str | None] = mapped_column(String(60))
    detalle: Mapped[dict | None] = mapped_column(JSON)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora, index=True)
