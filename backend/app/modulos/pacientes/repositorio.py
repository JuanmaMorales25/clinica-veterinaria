import re
import uuid
from abc import ABC, abstractmethod

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.modulos.pacientes.modelos import Mascota, Propietario


class RepositorioMascota(ABC):
    @abstractmethod
    def obtener(self, id_mascota: uuid.UUID) -> Mascota | None: ...

    @abstractmethod
    def buscar(self, texto: str, limite: int = 20) -> list[Mascota]:
        """Por nombre de la mascota o del propietario, documento, teléfono o número de historia."""


class RepositorioMascotaSQLAlchemy(RepositorioMascota):
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def obtener(self, id_mascota: uuid.UUID) -> Mascota | None:
        return self.sesion.scalar(
            select(Mascota)
            .where(Mascota.id == id_mascota)
            .options(selectinload(Mascota.alergias), selectinload(Mascota.propietario))
        )

    def buscar(self, texto: str, limite: int = 20) -> list[Mascota]:
        consulta = (
            select(Mascota)
            .join(Mascota.propietario)
            .options(selectinload(Mascota.alergias), selectinload(Mascota.propietario))
            .order_by(Mascota.nombre)
            .limit(limite)
        )
        texto = texto.strip()
        if texto:
            patron = f"%{texto}%"
            condiciones = [
                Mascota.nombre.ilike(patron),
                Mascota.numero_historia.ilike(patron),
                Propietario.nombre.ilike(patron),
                Propietario.documento_identidad.ilike(patron),
            ]
            # El teléfono se guarda con espacios ("300 123 4567"): se compara solo por dígitos.
            digitos = re.sub(r"\D", "", texto)
            if len(digitos) >= 3:
                telefono = func.regexp_replace(Propietario.telefono, r"\D", "", "g")
                condiciones.append(telefono.contains(digitos))
            consulta = consulta.where(or_(*condiciones))
        return list(self.sesion.scalars(consulta))
