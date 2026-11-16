import uuid

from pydantic import BaseModel, ConfigDict, EmailStr

from app.modulos.acceso.modelos import Rol


class SolicitudLogin(BaseModel):
    correo: EmailStr
    contrasena: str


class UsuarioSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    correo_electronico: str
    rol: Rol


class RespuestaLogin(BaseModel):
    token: str
    usuario: UsuarioSalida
