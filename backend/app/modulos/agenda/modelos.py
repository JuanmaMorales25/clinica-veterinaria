import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, ConFechaCreacion, ConId, tipo_enum

if TYPE_CHECKING:
    from app.modulos.acceso.modelos import Usuario
    from app.modulos.pacientes.modelos import Mascota


class EstadoCita(StrEnum):
    PENDIENTE = "PENDIENTE"
    CONFIRMADA = "CONFIRMADA"
    ATENDIDA = "ATENDIDA"
    CANCELADA = "CANCELADA"
    NO_ASISTIDA = "NO_ASISTIDA"


class Servicio(ConId, Base):
    __tablename__ = "servicio"

    nombre: Mapped[str] = mapped_column(String(80), unique=True)
    descripcion: Mapped[str | None] = mapped_column(String(255))
    # Minutos.
    duracion_estimada: Mapped[int]
    precio: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    activo: Mapped[bool] = mapped_column(default=True)


class Cita(ConId, ConFechaCreacion, Base):
    __tablename__ = "cita"

    mascota_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mascota.id"))
    servicio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("servicio.id"))
    veterinario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuario.id"))
    fecha_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    # La columna guarda el nombre del estado; el comportamiento de cada estado vive en el patrón State.
    estado: Mapped[EstadoCita] = mapped_column(tipo_enum(EstadoCita), default=EstadoCita.PENDIENTE)
    motivo_cancelacion: Mapped[str | None] = mapped_column(String(255))

    mascota: Mapped["Mascota"] = relationship()
    servicio: Mapped[Servicio] = relationship()
    veterinario: Mapped["Usuario | None"] = relationship()
