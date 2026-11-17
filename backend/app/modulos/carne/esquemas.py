import uuid
from datetime import date

from pydantic import BaseModel


class AlergiaCarnet(BaseModel):
    descripcion: str
    severidad: str


class VacunaCarnet(BaseModel):
    biologico: str
    fecha_aplicacion: date
    fecha_proxima_dosis: date | None


class CarnetMascotaSalida(BaseModel):
    id: uuid.UUID
    nombre: str
    especie: str
    raza: str | None
    edad: str | None
    numero_historia: str
    alergias: list[AlergiaCarnet]
    vacunas: list[VacunaCarnet]
    proximas_dosis: list[VacunaCarnet]


class EnlaceCarneSalida(BaseModel):
    enlace: str
