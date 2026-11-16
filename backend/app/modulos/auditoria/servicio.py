from abc import ABC, abstractmethod
from typing import Any

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.db import obtener_sesion
from app.modulos.acceso.modelos import Usuario
from app.modulos.auditoria.modelos import EventoAuditoria


class RegistroAuditoria(ABC):
    @abstractmethod
    def registrar(
        self,
        usuario: Usuario | None,
        accion: str,
        entidad: str,
        entidad_id: Any = None,
        detalle: dict[str, Any] | None = None,
    ) -> None: ...


class RegistroAuditoriaBD(RegistroAuditoria):
    """Agrega el evento a la sesión actual: se guarda o se revierte junto con la operación."""

    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def registrar(
        self,
        usuario: Usuario | None,
        accion: str,
        entidad: str,
        entidad_id: Any = None,
        detalle: dict[str, Any] | None = None,
    ) -> None:
        self.sesion.add(
            EventoAuditoria(
                usuario_id=usuario.id if usuario else None,
                accion=accion,
                entidad=entidad,
                entidad_id=str(entidad_id) if entidad_id is not None else None,
                detalle=detalle,
            )
        )


def obtener_registro_auditoria(sesion: Session = Depends(obtener_sesion)) -> RegistroAuditoria:
    return RegistroAuditoriaBD(sesion)
