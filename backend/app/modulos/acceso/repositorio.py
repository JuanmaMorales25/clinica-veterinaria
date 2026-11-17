import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modulos.acceso.modelos import Usuario
from app.modulos.pacientes.modelos import Propietario


class RepositorioUsuario:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def por_correo(self, correo: str, bloquear: bool = False) -> Usuario | None:
        consulta = select(Usuario).where(func.lower(Usuario.correo_electronico) == correo.lower())
        if bloquear:
            consulta = consulta.with_for_update()
        return self.sesion.scalar(consulta)

    def por_id(self, usuario_id: uuid.UUID, bloquear: bool = False) -> Usuario | None:
        consulta = select(Usuario).where(Usuario.id == usuario_id)
        if bloquear:
            consulta = consulta.with_for_update()
        return self.sesion.scalar(consulta)

    def propietario_por_documento(self, documento: str, bloquear: bool = False) -> Propietario | None:
        consulta = select(Propietario).where(Propietario.documento_identidad == documento)
        if bloquear:
            consulta = consulta.with_for_update()
        return self.sesion.scalar(consulta)

    def agregar(self, usuario: Usuario) -> None:
        self.sesion.add(usuario)

    def confirmar(self) -> None:
        self.sesion.commit()

    def revertir(self) -> None:
        self.sesion.rollback()
