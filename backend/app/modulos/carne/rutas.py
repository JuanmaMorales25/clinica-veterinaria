import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import obtener_sesion
from app.core.seguridad import requiere_rol
from app.modulos.acceso.modelos import Rol, Usuario
from app.modulos.carne.esquemas import CarnetMascotaSalida, EnlaceCarneSalida
from app.modulos.carne.servicio import ServicioCarne

router = APIRouter(prefix="/carne", tags=["Carné digital"])

propietario = requiere_rol(Rol.PROPIETARIO)


@router.get("/mascotas/{mascota_id}", response_model=CarnetMascotaSalida)
def ver_carne(
    mascota_id: uuid.UUID,
    usuario: Usuario = Depends(propietario),
    sesion: Session = Depends(obtener_sesion),
):
    return ServicioCarne(sesion).obtener_privado(mascota_id, usuario)


@router.post("/mascotas/{mascota_id}/enlace", response_model=EnlaceCarneSalida)
def crear_enlace(
    mascota_id: uuid.UUID,
    usuario: Usuario = Depends(propietario),
    sesion: Session = Depends(obtener_sesion),
):
    return ServicioCarne(sesion).crear_enlace(mascota_id, usuario)


@router.get("/enlace/{token}", response_model=CarnetMascotaSalida)
def ver_carne_publico(token: str, sesion: Session = Depends(obtener_sesion)):
    return ServicioCarne(sesion).obtener_publico(token)
