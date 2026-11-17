import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.modulos.agenda.modelos import EstadoCitaValor


class MascotaAgendaSalida(BaseModel):
    id: uuid.UUID
    nombre: str
    especie: str
    raza: str | None
    numero_historia: str


class ServicioAgendaSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    descripcion: str | None
    duracion_estimada: int
    precio: Decimal


class HorarioDisponible(BaseModel):
    fecha_hora: datetime
    veterinario_id: uuid.UUID
    veterinario: str


class SolicitudCita(BaseModel):
    mascota_id: uuid.UUID
    servicio_id: uuid.UUID
    fecha_hora: datetime
    veterinario_id: uuid.UUID


class SolicitudVincularMascota(BaseModel):
    numero_historia: str = Field(min_length=1, max_length=20)


class SolicitudCancelarCita(BaseModel):
    motivo: str = Field(min_length=3, max_length=180)


class CitaAgendaSalida(BaseModel):
    id: uuid.UUID
    mascota_id: uuid.UUID
    mascota: str
    servicio: str
    veterinario: str | None
    fecha_hora: datetime
    estado: EstadoCitaValor
    motivo_cancelacion: str | None = None
