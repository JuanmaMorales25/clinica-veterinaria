import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, ConId, ahora, tipo_enum


class TipoProducto(StrEnum):
    MEDICAMENTO = "MEDICAMENTO"
    VACUNA = "VACUNA"
    INSUMO = "INSUMO"


class TipoMovimiento(StrEnum):
    ENTRADA = "ENTRADA"
    SALIDA_USO = "SALIDA_USO"
    REVERSA = "REVERSA"


class Producto(ConId, Base):
    __tablename__ = "producto"

    nombre: Mapped[str] = mapped_column(String(120), unique=True)
    tipo: Mapped[TipoProducto] = mapped_column(tipo_enum(TipoProducto))
    # Se compara con las alergias de la mascota antes de prescribir (C1).
    principio_activo: Mapped[str | None] = mapped_column(String(120))
    laboratorio: Mapped[str | None] = mapped_column(String(120))
    precio_venta: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    stock_minimo: Mapped[int] = mapped_column(default=0)

    lotes: Mapped[list["Lote"]] = relationship(back_populates="producto")


class Lote(ConId, Base):
    __tablename__ = "lote"

    producto_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("producto.id"))
    codigo: Mapped[str] = mapped_column(String(40), unique=True)
    cantidad_disponible: Mapped[int]
    fecha_vencimiento: Mapped[date]

    producto: Mapped[Producto] = relationship(back_populates="lotes")

    def esta_vencido(self, hoy: date) -> bool:
        return self.fecha_vencimiento < hoy


class MovimientoInventario(ConId, Base):
    __tablename__ = "movimiento_inventario"

    lote_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lote.id"))
    # Atención que originó el movimiento; permite reversarlo si se anula la factura (D4).
    consulta_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("consulta.id"))
    tipo: Mapped[TipoMovimiento] = mapped_column(tipo_enum(TipoMovimiento))
    cantidad: Mapped[int]
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    saldo_resultante: Mapped[int]

    lote: Mapped[Lote] = relationship()
