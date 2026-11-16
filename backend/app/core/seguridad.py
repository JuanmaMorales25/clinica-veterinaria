import uuid
from collections.abc import Callable
from datetime import timedelta

import jwt
from fastapi import Depends, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.core.config import obtener_configuracion
from app.core.db import ahora, obtener_sesion
from app.core.errores import ErrorDeNegocio
from app.modulos.acceso.modelos import Rol, Usuario

CABECERA_TOKEN_RENOVADO = "X-Token-Renovado"

_cifrador = PasswordHash.recommended()
_esquema_bearer = HTTPBearer(auto_error=False)


def cifrar_contrasena(contrasena: str) -> str:
    return _cifrador.hash(contrasena)


def verificar_contrasena(contrasena: str, contrasena_hash: str) -> bool:
    return _cifrador.verify(contrasena, contrasena_hash)


def crear_token(usuario: Usuario) -> str:
    configuracion = obtener_configuracion()
    expira = ahora() + timedelta(minutes=configuracion.sesion_minutos)
    datos = {"sub": str(usuario.id), "rol": usuario.rol.value, "exp": expira}
    return jwt.encode(datos, configuracion.jwt_secreto, algorithm=configuracion.jwt_algoritmo)


def obtener_usuario_actual(
    respuesta: Response,
    credenciales: HTTPAuthorizationCredentials | None = Depends(_esquema_bearer),
    sesion: Session = Depends(obtener_sesion),
) -> Usuario:
    if credenciales is None:
        raise ErrorDeNegocio("SESION_REQUERIDA", "Debes iniciar sesión.", 401)

    configuracion = obtener_configuracion()
    try:
        datos = jwt.decode(
            credenciales.credentials,
            configuracion.jwt_secreto,
            algorithms=[configuracion.jwt_algoritmo],
        )
    except jwt.ExpiredSignatureError as error:
        raise ErrorDeNegocio(
            "SESION_EXPIRADA", "Tu sesión se cerró por inactividad.", 401
        ) from error
    except jwt.InvalidTokenError as error:
        raise ErrorDeNegocio("SESION_INVALIDA", "La sesión no es válida.", 401) from error

    usuario = sesion.get(Usuario, uuid.UUID(datos["sub"]))
    if usuario is None or not usuario.estado:
        raise ErrorDeNegocio("SESION_INVALIDA", "La sesión no es válida.", 401)

    # Cada petición con sesión válida renueva el plazo: la sesión vence por inactividad (A4).
    respuesta.headers[CABECERA_TOKEN_RENOVADO] = crear_token(usuario)
    return usuario


def requiere_rol(*roles: Rol) -> Callable[..., Usuario]:
    def verificar(usuario: Usuario = Depends(obtener_usuario_actual)) -> Usuario:
        if usuario.rol not in roles:
            raise ErrorDeNegocio(
                "PERMISO_DENEGADO", "Tu rol no tiene permiso para esta acción.", 403
            )
        return usuario

    return verificar
