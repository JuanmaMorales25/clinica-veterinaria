import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, ConFechaCreacion, ConId, ahora, tipo_enum
from app.modulos.pacientes.modelos import TipoCanal


class TipoRecordatorio(StrEnum):
    PROXIMA_DOSIS = "PROXIMA_DOSIS"
    CITA = "CITA"


class EstadoRecordatorio(StrEnum):
    PROGRAMADO = "PROGRAMADO"
    ENVIADO = "ENVIADO"
    FALLIDO = "FALLIDO"
    CANCELADO = "CANCELADO"


class Recordatorio(ConId, ConFechaCreacion, Base):
    """Aviso que el programador de tareas envía en la fecha indicada (RF-49)."""

    __tablename__ = "recordatorio"

    mascota_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mascota.id"))
    vacunacion_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("vacunacion.id"))
    cita_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("cita.id"))
    tipo: Mapped[TipoRecordatorio] = mapped_column(tipo_enum(TipoRecordatorio))
    fecha_programada: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    estado: Mapped[EstadoRecordatorio] = mapped_column(
        tipo_enum(EstadoRecordatorio), default=EstadoRecordatorio.PROGRAMADO
    )
    intentos: Mapped[int] = mapped_column(default=0)
    enviado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ultimo_error: Mapped[str | None] = mapped_column(Text)


class MensajeEnviado(ConId, Base):
    """Registro de cada envío. El canal de mensajería es simulado y solo deja este rastro."""

    __tablename__ = "mensaje_enviado"

    canal: Mapped[TipoCanal] = mapped_column(tipo_enum(TipoCanal))
    destinatario: Mapped[str] = mapped_column(String(160))
    asunto: Mapped[str] = mapped_column(String(200))
    cuerpo: Mapped[str] = mapped_column(Text)
    enviado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
