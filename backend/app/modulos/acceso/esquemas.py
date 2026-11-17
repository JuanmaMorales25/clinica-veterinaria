import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modulos.acceso.modelos import Rol


class SolicitudLogin(BaseModel):
    correo: EmailStr
    contrasena: str


class SolicitudRegistro(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    correo: EmailStr
    contrasena: str = Field(min_length=8, max_length=128)
    documento_identidad: str = Field(min_length=5, max_length=20)
    telefono: str = Field(min_length=7, max_length=20)
    autorizacion_datos: bool


class SolicitudRecuperacion(BaseModel):
    correo: EmailStr


class SolicitudRestablecer(BaseModel):
    token: str = Field(min_length=1)
    contrasena: str = Field(min_length=8, max_length=128)


class UsuarioSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    correo_electronico: str
    rol: Rol


class RespuestaLogin(BaseModel):
    token: str
    usuario: UsuarioSalida


class RespuestaMensaje(BaseModel):
    mensaje: str
