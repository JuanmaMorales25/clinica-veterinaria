import uuid
from datetime import date, time
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, ConFechaCreacion, ConId, tipo_enum

if TYPE_CHECKING:
    from app.modulos.acceso.modelos import Usuario


class TipoCanal(StrEnum):
    CORREO = "CORREO"
    MENSAJERIA = "MENSAJERIA"


class Propietario(ConId, ConFechaCreacion, Base):
    __tablename__ = "propietario"

    documento_identidad: Mapped[str] = mapped_column(String(20), unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    telefono: Mapped[str] = mapped_column(String(20))
    correo: Mapped[str] = mapped_column(String(160))
    autorizacion_datos: Mapped[bool] = mapped_column(default=False)
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuario.id"), unique=True)

    usuario: Mapped["Usuario | None"] = relationship()
    preferencia: Mapped["PreferenciaNotificacion | None"] = relationship(
        back_populates="propietario", cascade="all, delete-orphan"
    )
    mascotas: Mapped[list["Mascota"]] = relationship(back_populates="propietario")


class PreferenciaNotificacion(Base):
    __tablename__ = "preferencia_notificacion"

    propietario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("propietario.id", ondelete="CASCADE"), primary_key=True
    )
    canal: Mapped[TipoCanal] = mapped_column(tipo_enum(TipoCanal), default=TipoCanal.CORREO)
    recibir_recordatorios: Mapped[bool] = mapped_column(default=True)
    recordatorio_citas: Mapped[bool] = mapped_column(default=True)
    promociones: Mapped[bool] = mapped_column(default=False)
    hora_preferida: Mapped[time] = mapped_column(default=time(9, 0))

    propietario: Mapped[Propietario] = relationship(back_populates="preferencia")


class Mascota(ConId, ConFechaCreacion, Base):
    __tablename__ = "mascota"

    numero_historia: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    nombre: Mapped[str] = mapped_column(String(80))
    especie: Mapped[str] = mapped_column(String(40))
    raza: Mapped[str | None] = mapped_column(String(60))
    sexo: Mapped[str | None] = mapped_column(String(20))
    fecha_nacimiento: Mapped[date | None]
    peso: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    estado_reproductivo: Mapped[str | None] = mapped_column(String(40))
    fotografia: Mapped[str | None] = mapped_column(String(255))
    propietario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("propietario.id"))

    propietario: Mapped[Propietario] = relationship(back_populates="mascotas")
    alergias: Mapped[list["Alergia"]] = relationship(
        back_populates="mascota", cascade="all, delete-orphan"
    )

    def describir_edad(self, hoy: date) -> str | None:
        """Edad legible para las fichas: "6 meses", "1 año", "3 años"."""
        if self.fecha_nacimiento is None:
            return None
        meses = (
            (hoy.year - self.fecha_nacimiento.year) * 12 + hoy.month - self.fecha_nacimiento.month
        )
        if hoy.day < self.fecha_nacimiento.day:
            meses -= 1
        if meses < 1:
            semanas = max((hoy - self.fecha_nacimiento).days // 7, 0)
            return f"{semanas} semana" if semanas == 1 else f"{semanas} semanas"
        if meses < 12:
            return f"{meses} mes" if meses == 1 else f"{meses} meses"
        anios = meses // 12
        return f"{anios} año" if anios == 1 else f"{anios} años"


class Alergia(ConId, Base):
    __tablename__ = "alergia"

    mascota_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mascota.id", ondelete="CASCADE"))
    descripcion: Mapped[str] = mapped_column(String(120))
    severidad: Mapped[str] = mapped_column(String(20))
    fecha_registro: Mapped[date]

    mascota: Mapped[Mascota] = relationship(back_populates="alergias")
