from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import obtener_sesion
from app.core.errores import ErrorDeNegocio
from app.core.seguridad import crear_token, obtener_usuario_actual, verificar_contrasena
from app.modulos.acceso.esquemas import RespuestaLogin, SolicitudLogin, UsuarioSalida
from app.modulos.acceso.modelos import Usuario

router = APIRouter(prefix="/acceso", tags=["Acceso"])


@router.post("/login", response_model=RespuestaLogin)
def iniciar_sesion(datos: SolicitudLogin, sesion: Session = Depends(obtener_sesion)):
    usuario = sesion.scalar(
        select(Usuario).where(Usuario.correo_electronico == datos.correo.lower())
    )
    if usuario is None or not verificar_contrasena(datos.contrasena, usuario.contrasena_hash):
        raise ErrorDeNegocio(
            "CREDENCIALES_INCORRECTAS", "El correo o la contraseña no coinciden.", 401
        )
    if not usuario.estado:
        raise ErrorDeNegocio("CUENTA_BLOQUEADA", "La cuenta está bloqueada.", 423)
    return RespuestaLogin(token=crear_token(usuario), usuario=UsuarioSalida.model_validate(usuario))


@router.get("/yo", response_model=UsuarioSalida)
def usuario_actual(usuario: Usuario = Depends(obtener_usuario_actual)):
    return usuario
