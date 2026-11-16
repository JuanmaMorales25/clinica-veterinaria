import uuid
from abc import ABC, abstractmethod
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modulos.inventario.modelos import Lote, MovimientoInventario, Producto, TipoMovimiento


class RepositorioLote(ABC):
    @abstractmethod
    def obtener(self, id_lote: uuid.UUID, bloquear: bool = False) -> Lote | None: ...

    @abstractmethod
    def lotes_del_producto(self, id_producto: uuid.UUID) -> list[Lote]:
        """Todos los lotes con existencias, del que vence primero al último."""

    @abstractmethod
    def lotes_vigentes(self, id_producto: uuid.UUID, hoy: date) -> list[Lote]: ...

    @abstractmethod
    def agregar_movimiento(self, movimiento: MovimientoInventario) -> None: ...

    @abstractmethod
    def salidas_de_consulta(self, id_consulta: uuid.UUID) -> list[MovimientoInventario]: ...

    @abstractmethod
    def obtener_producto(self, id_producto: uuid.UUID) -> Producto | None: ...


class RepositorioLoteSQLAlchemy(RepositorioLote):
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def obtener(self, id_lote: uuid.UUID, bloquear: bool = False) -> Lote | None:
        consulta = select(Lote).where(Lote.id == id_lote)
        if bloquear:
            # Evita que dos cobros simultáneos descuenten el mismo saldo.
            consulta = consulta.with_for_update()
        return self.sesion.scalar(consulta)

    def lotes_del_producto(self, id_producto: uuid.UUID) -> list[Lote]:
        return list(
            self.sesion.scalars(
                select(Lote)
                .where(Lote.producto_id == id_producto, Lote.cantidad_disponible > 0)
                .order_by(Lote.fecha_vencimiento)
            )
        )

    def lotes_vigentes(self, id_producto: uuid.UUID, hoy: date) -> list[Lote]:
        return list(
            self.sesion.scalars(
                select(Lote)
                .where(
                    Lote.producto_id == id_producto,
                    Lote.cantidad_disponible > 0,
                    Lote.fecha_vencimiento >= hoy,
                )
                .order_by(Lote.fecha_vencimiento)
            )
        )

    def agregar_movimiento(self, movimiento: MovimientoInventario) -> None:
        self.sesion.add(movimiento)

    def salidas_de_consulta(self, id_consulta: uuid.UUID) -> list[MovimientoInventario]:
        return list(
            self.sesion.scalars(
                select(MovimientoInventario).where(
                    MovimientoInventario.consulta_id == id_consulta,
                    MovimientoInventario.tipo == TipoMovimiento.SALIDA_USO,
                )
            )
        )

    def obtener_producto(self, id_producto: uuid.UUID) -> Producto | None:
        return self.sesion.get(Producto, id_producto)
