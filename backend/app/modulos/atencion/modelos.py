import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, ConId, ahora, tipo_enum

if TYPE_CHECKING:
    from app.modulos.acceso.modelos import Usuario
    from app.modulos.agenda.modelos import Cita, Servicio
    from app.modulos.inventario.modelos import Lote, Producto
    from app.modulos.pacientes.modelos import Mascota


class EstadoConsulta(StrEnum):
    ABIERTA = "ABIERTA"
    CERRADA = "CERRADA"


class Consulta(ConId, Base):
    __tablename__ = "consulta"

    mascota_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mascota.id"), index=True)
    veterinario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuario.id"))
    cita_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("cita.id"))
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    motivo: Mapped[str] = mapped_column(String(255))
    peso: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    temperatura: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    frecuencia_cardiaca: Mapped[int | None]
    hallazgos: Mapped[str | None] = mapped_column(Text)
    diagnostico: Mapped[str | None] = mapped_column(Text)
    plan_tratamiento: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[EstadoConsulta] = mapped_column(
        tipo_enum(EstadoConsulta), default=EstadoConsulta.ABIERTA
    )
    cerrada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    mascota: Mapped["Mascota"] = relationship()
    veterinario: Mapped["Usuario"] = relationship()
    cita: Mapped["Cita | None"] = relationship()
    notas: Mapped[list["NotaAclaratoria"]] = relationship(
        back_populates="consulta", order_by="NotaAclaratoria.fecha"
    )
    vacunaciones: Mapped[list["Vacunacion"]] = relationship(back_populates="consulta")
    items_aplicados: Mapped[list["ItemAplicado"]] = relationship(back_populates="consulta")
    servicios_prestados: Mapped[list["ServicioPrestado"]] = relationship(back_populates="consulta")


class NotaAclaratoria(ConId, Base):
    """Corrección de un registro cerrado: el original no se modifica (RN-03, C4)."""

    __tablename__ = "nota_aclaratoria"

    consulta_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("consulta.id"))
    autor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuario.id"))
    texto: Mapped[str] = mapped_column(Text)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)

    consulta: Mapped[Consulta] = relationship(back_populates="notas")
    autor: Mapped["Usuario"] = relationship()


class EsquemaVacunacion(ConId, Base):
    __tablename__ = "esquema_vacunacion"

    especie: Mapped[str] = mapped_column(String(40))
    biologico: Mapped[str] = mapped_column(String(120))
    producto_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("producto.id"))
    numero_dosis: Mapped[int]
    intervalo_dias: Mapped[int]

    producto: Mapped["Producto"] = relationship()

    def calcular_proxima_dosis(self, aplicacion: date) -> date:
        return aplicacion + timedelta(days=self.intervalo_dias)


class Vacunacion(ConId, Base):
    __tablename__ = "vacunacion"

    consulta_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("consulta.id"))
    esquema_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("esquema_vacunacion.id"))
    lote_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lote.id"))
    fecha_aplicacion: Mapped[date]
    fecha_proxima_dosis: Mapped[date | None]

    consulta: Mapped[Consulta] = relationship(back_populates="vacunaciones")
    esquema: Mapped[EsquemaVacunacion] = relationship()
    lote: Mapped["Lote"] = relationship()


class ItemAplicado(ConId, Base):
    """Producto prescrito o aplicado en la atención. El lote se asigna al facturar (FEFO)."""

    __tablename__ = "item_aplicado"

    consulta_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("consulta.id"))
    producto_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("producto.id"))
    lote_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("lote.id"))
    cantidad: Mapped[int]
    dosis: Mapped[str | None] = mapped_column(String(60))
    via_administracion: Mapped[str | None] = mapped_column(String(40))
    frecuencia: Mapped[str | None] = mapped_column(String(60))
    duracion: Mapped[str | None] = mapped_column(String(60))
    alerta_revisada: Mapped[bool] = mapped_column(default=False)
    # Si el veterinario omite la alerta de alergia queda el motivo (C2).
    motivo_omision_alerta: Mapped[str | None] = mapped_column(Text)

    consulta: Mapped[Consulta] = relationship(back_populates="items_aplicados")
    producto: Mapped["Producto"] = relationship()
    lote: Mapped["Lote | None"] = relationship()


class ServicioPrestado(ConId, Base):
    __tablename__ = "servicio_prestado"

    consulta_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("consulta.id"))
    servicio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("servicio.id"))
    cantidad: Mapped[int] = mapped_column(default=1)

    consulta: Mapped[Consulta] = relationship(back_populates="servicios_prestados")
    servicio: Mapped["Servicio"] = relationship()
