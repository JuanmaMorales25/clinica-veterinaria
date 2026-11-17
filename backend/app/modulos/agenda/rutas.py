from datetime import date
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import obtener_sesion
from app.core.seguridad import obtener_usuario_actual, requiere_rol
from app.modulos.acceso.modelos import ROLES_PERSONAL, Rol, Usuario
from app.modulos.agenda.esquemas import (
    CitaAgendaSalida,
    HorarioDisponible,
    MascotaAgendaSalida,
    ServicioAgendaSalida,
    SolicitudCancelarCita,
    SolicitudCita,
    SolicitudVincularMascota,
)
from app.modulos.agenda.servicio import ServicioAgenda

router = APIRouter(prefix="/agenda", tags=["Agenda"])


@router.get("/mascotas", response_model=list[MascotaAgendaSalida])
def listar_mascotas(
    usuario: Usuario = Depends(requiere_rol(Rol.PROPIETARIO)),
    sesion: Session = Depends(obtener_sesion),
):
    return ServicioAgenda(sesion).mascotas(usuario)


@router.post("/mascotas/vincular", response_model=MascotaAgendaSalida)
def vincular_mascota(
    datos: SolicitudVincularMascota,
    usuario: Usuario = Depends(requiere_rol(Rol.PROPIETARIO)),
    sesion: Session = Depends(obtener_sesion),
):
    return ServicioAgenda(sesion).vincular_mascota(usuario, datos.numero_historia)


@router.get("/servicios", response_model=list[ServicioAgendaSalida])
def listar_servicios(
    _: Usuario = Depends(requiere_rol(Rol.PROPIETARIO)),
    sesion: Session = Depends(obtener_sesion),
):
    return ServicioAgenda(sesion).servicios()


@router.get("/horarios", response_model=list[HorarioDisponible])
def listar_horarios(
    dia: date = Query(),
    servicio_id: uuid.UUID = Query(),
    _: Usuario = Depends(requiere_rol(Rol.PROPIETARIO)),
    sesion: Session = Depends(obtener_sesion),
):
    return ServicioAgenda(sesion).horarios(dia, servicio_id)


@router.post("/citas", response_model=CitaAgendaSalida, status_code=201)
def solicitar_cita(
    datos: SolicitudCita,
    usuario: Usuario = Depends(requiere_rol(Rol.PROPIETARIO)),
    sesion: Session = Depends(obtener_sesion),
):
    return ServicioAgenda(sesion).solicitar_cita(usuario, datos)


@router.get("/citas/pendientes", response_model=list[CitaAgendaSalida])
def listar_citas_pendientes(
    _: Usuario = Depends(requiere_rol(*ROLES_PERSONAL)),
    sesion: Session = Depends(obtener_sesion),
):
    return ServicioAgenda(sesion).citas_pendientes()


@router.post("/citas/{cita_id}/confirmar", response_model=CitaAgendaSalida)
def confirmar_cita(
    cita_id: uuid.UUID,
    _: Usuario = Depends(requiere_rol(*ROLES_PERSONAL)),
    sesion: Session = Depends(obtener_sesion),
):
    return ServicioAgenda(sesion).confirmar_cita(cita_id)


@router.post("/citas/{cita_id}/cancelar", response_model=CitaAgendaSalida)
def cancelar_cita(
    cita_id: uuid.UUID,
    datos: SolicitudCancelarCita,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: Session = Depends(obtener_sesion),
):
    return ServicioAgenda(sesion).cancelar_cita(cita_id, usuario, datos)


@router.post("/citas/{cita_id}/atendida", response_model=CitaAgendaSalida)
def marcar_atendida(
    cita_id: uuid.UUID,
    _: Usuario = Depends(requiere_rol(Rol.VETERINARIO)),
    sesion: Session = Depends(obtener_sesion),
):
    return ServicioAgenda(sesion).marcar_atendida(cita_id)


@router.post("/citas/{cita_id}/no-asistida", response_model=CitaAgendaSalida)
def marcar_no_asistida(
    cita_id: uuid.UUID,
    _: Usuario = Depends(requiere_rol(Rol.VETERINARIO)),
    sesion: Session = Depends(obtener_sesion),
):
    return ServicioAgenda(sesion).marcar_no_asistida(cita_id)
