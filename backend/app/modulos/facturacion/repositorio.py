import uuid
from abc import ABC, abstractmethod

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modulos.facturacion.modelos import Factura


class RepositorioFactura(ABC):
    @abstractmethod
    def obtener(self, id_factura: uuid.UUID) -> Factura | None: ...

    @abstractmethod
    def de_consulta(self, id_consulta: uuid.UUID) -> Factura | None: ...

    @abstractmethod
    def agregar(self, factura: Factura) -> None: ...

    @abstractmethod
    def asignar_consecutivo(self, factura: Factura) -> None:
        """Toma el siguiente número de la secuencia (F-0007, F-0008…)."""


class RepositorioFacturaSQLAlchemy(RepositorioFactura):
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def _consulta(self):
        return select(Factura).options(selectinload(Factura.detalles), selectinload(Factura.pagos))

    def obtener(self, id_factura: uuid.UUID) -> Factura | None:
        return self.sesion.scalar(self._consulta().where(Factura.id == id_factura))

    def de_consulta(self, id_consulta: uuid.UUID) -> Factura | None:
        return self.sesion.scalar(self._consulta().where(Factura.consulta_id == id_consulta))

    def agregar(self, factura: Factura) -> None:
        self.sesion.add(factura)

    def asignar_consecutivo(self, factura: Factura) -> None:
        self.sesion.flush()
        self.sesion.refresh(factura, ["consecutivo"])
