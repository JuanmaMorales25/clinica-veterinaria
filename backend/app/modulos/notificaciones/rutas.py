from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import obtener_sesion
from app.core.seguridad import requiere_rol
from app.modulos.acceso.modelos import Rol, Usuario
from app.modulos.notificaciones.esquemas import (
    PreferenciasNotificacion,
    SolicitudPreferenciasNotificacion,
)
from app.modulos.notificaciones.servicio import ServicioNotificaciones

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])


@router.get("/preferencias", response_model=PreferenciasNotificacion)
def obtener_preferencias(
    usuario: Usuario = Depends(requiere_rol(Rol.PROPIETARIO)),
    sesion: Session = Depends(obtener_sesion),
):
    return ServicioNotificaciones(sesion).preferencias(usuario)


@router.put("/preferencias", response_model=PreferenciasNotificacion)
def actualizar_preferencias(
    datos: SolicitudPreferenciasNotificacion,
    usuario: Usuario = Depends(requiere_rol(Rol.PROPIETARIO)),
    sesion: Session = Depends(obtener_sesion),
):
    return ServicioNotificaciones(sesion).actualizar_preferencias(usuario, datos)
