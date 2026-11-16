from abc import ABC, abstractmethod

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.db import obtener_sesion


class UnidadDeTrabajo(ABC):
    """Agrupa varias escrituras para que se guarden todas juntas o ninguna (RNF-15)."""

    @abstractmethod
    def iniciar(self) -> None: ...

    @abstractmethod
    def confirmar(self) -> None: ...

    @abstractmethod
    def revertir(self) -> None: ...


class UnidadDeTrabajoSQLAlchemy(UnidadDeTrabajo):
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def iniciar(self) -> None:
        if not self.sesion.in_transaction():
            self.sesion.begin()

    def confirmar(self) -> None:
        self.sesion.commit()

    def revertir(self) -> None:
        self.sesion.rollback()


def obtener_unidad_de_trabajo(sesion: Session = Depends(obtener_sesion)) -> UnidadDeTrabajo:
    return UnidadDeTrabajoSQLAlchemy(sesion)
