from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import obtener_sesion
from app.core.seguridad import obtener_usuario_actual
from app.modulos.acceso.esquemas import (
    RespuestaLogin,
    RespuestaMensaje,
    SolicitudLogin,
    SolicitudRecuperacion,
    SolicitudRegistro,
    SolicitudRestablecer,
    UsuarioSalida,
)
from app.modulos.acceso.modelos import Usuario
from app.modulos.acceso.servicio import ServicioAcceso

router = APIRouter(prefix="/acceso", tags=["Acceso"])


@router.post("/login", response_model=RespuestaLogin)
def iniciar_sesion(datos: SolicitudLogin, sesion: Session = Depends(obtener_sesion)):
    return ServicioAcceso(sesion).iniciar_sesion(datos)


@router.post("/registro", response_model=RespuestaLogin, status_code=201)
def registrar(datos: SolicitudRegistro, sesion: Session = Depends(obtener_sesion)):
    return ServicioAcceso(sesion).registrar(datos)


@router.post("/recuperar", response_model=RespuestaMensaje)
def solicitar_recuperacion(
    datos: SolicitudRecuperacion, sesion: Session = Depends(obtener_sesion)
):
    ServicioAcceso(sesion).solicitar_recuperacion(datos)
    return RespuestaMensaje(
        mensaje="Si la cuenta existe, enviaremos un enlace de recuperación a ese correo."
    )


@router.post("/restablecer", response_model=RespuestaMensaje)
def restablecer_contrasena(
    datos: SolicitudRestablecer, sesion: Session = Depends(obtener_sesion)
):
    ServicioAcceso(sesion).restablecer_contrasena(datos)
    return RespuestaMensaje(mensaje="La contraseña se actualizó. Ya puedes iniciar sesión.")


@router.get("/yo", response_model=UsuarioSalida)
def usuario_actual(usuario: Usuario = Depends(obtener_usuario_actual)):
    return usuario
