from enum import StrEnum

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, ConFechaCreacion, ConId, tipo_enum


class Rol(StrEnum):
    ADMINISTRADOR = "ADMINISTRADOR"
    VETERINARIO = "VETERINARIO"
    AUXILIAR = "AUXILIAR"
    PROPIETARIO = "PROPIETARIO"


ROLES_PERSONAL = (Rol.ADMINISTRADOR, Rol.VETERINARIO, Rol.AUXILIAR)


class Usuario(ConId, ConFechaCreacion, Base):
    __tablename__ = "usuario"

    nombre: Mapped[str] = mapped_column(String(120))
    correo_electronico: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    contrasena_hash: Mapped[str] = mapped_column(String(255))
    rol: Mapped[Rol] = mapped_column(tipo_enum(Rol))
    intentos_fallidos: Mapped[int] = mapped_column(default=0)
    # False cuando la cuenta se bloquea por superar los intentos permitidos (A2).
    estado: Mapped[bool] = mapped_column(default=True)
