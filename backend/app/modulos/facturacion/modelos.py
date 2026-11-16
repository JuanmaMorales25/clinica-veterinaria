import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, Sequence, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, ConId, ahora, tipo_enum

if TYPE_CHECKING:
    from app.modulos.atencion.modelos import Consulta

CONSECUTIVO_FACTURA = Sequence("factura_consecutivo_seq", start=1)


class EstadoFactura(StrEnum):
    EMITIDA = "EMITIDA"
    ANULADA = "ANULADA"


class TipoItemFactura(StrEnum):
    SERVICIO = "SERVICIO"
    PRODUCTO = "PRODUCTO"


class MedioPago(StrEnum):
    EFECTIVO = "EFECTIVO"
    TRANSFERENCIA = "TRANSFERENCIA"
    TARJETA = "TARJETA"


class Factura(ConId, Base):
    __tablename__ = "factura"

    consecutivo: Mapped[int] = mapped_column(
        CONSECUTIVO_FACTURA, server_default=CONSECUTIVO_FACTURA.next_value(), unique=True
    )
    consulta_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("consulta.id"), unique=True)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    estado: Mapped[EstadoFactura] = mapped_column(
        tipo_enum(EstadoFactura), default=EstadoFactura.EMITIDA
    )
    emitida_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    anulada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    anulada_por_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuario.id"))
    motivo_anulacion: Mapped[str | None] = mapped_column(Text)

    consulta: Mapped["Consulta"] = relationship()
    detalles: Mapped[list["DetalleFactura"]] = relationship(
        back_populates="factura", cascade="all, delete-orphan"
    )
    pagos: Mapped[list["Pago"]] = relationship(
        back_populates="factura", cascade="all, delete-orphan"
    )

    @property
    def numero(self) -> str:
        return f"F-{self.consecutivo:04d}"

    def calcular_total(self) -> Decimal:
        return sum((detalle.subtotal for detalle in self.detalles), Decimal(0))


class DetalleFactura(ConId, Base):
    __tablename__ = "detalle_factura"

    factura_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("factura.id", ondelete="CASCADE"))
    descripcion: Mapped[str] = mapped_column(String(160))
    tipo_item: Mapped[TipoItemFactura] = mapped_column(tipo_enum(TipoItemFactura))
    lote_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("lote.id"))
    cantidad: Mapped[int]
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    factura: Mapped[Factura] = relationship(back_populates="detalles")


class Pago(ConId, Base):
    __tablename__ = "pago"

    factura_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("factura.id", ondelete="CASCADE"))
    medio: Mapped[MedioPago] = mapped_column(tipo_enum(MedioPago))
    valor: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    cambio: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal(0))

    factura: Mapped[Factura] = relationship(back_populates="pagos")
