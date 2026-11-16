import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.modulos.atencion.modelos import EstadoConsulta

# --- Entradas ---


class SolicitudConsulta(BaseModel):
    mascota_id: uuid.UUID


class DatosConsulta(BaseModel):
    motivo: str = Field("", max_length=255)
    peso: Decimal | None = Field(None, gt=0, le=999)
    temperatura: Decimal | None = Field(None, ge=30, le=45)
    frecuencia_cardiaca: int | None = Field(None, gt=0, le=400)
    hallazgos: str | None = None
    diagnostico: str | None = None
    plan_tratamiento: str | None = None


class DecisionAlerta(BaseModel):
    decision: Literal["REVISADA", "OMITIDA"]
    motivo: str | None = None


class SolicitudPrescripcion(BaseModel):
    producto_id: uuid.UUID
    cantidad: int = Field(1, ge=1, le=99)
    dosis: str | None = Field(None, max_length=60)
    via_administracion: str | None = Field(None, max_length=40)
    frecuencia: str | None = Field(None, max_length=60)
    duracion: str | None = Field(None, max_length=60)
    alerta_revisada: bool = False
    motivo_omision_alerta: str | None = None


class SolicitudVacunacion(BaseModel):
    esquema_id: uuid.UUID
    lote_id: uuid.UUID
    fecha_aplicacion: date | None = None


class SolicitudNota(BaseModel):
    texto: str = Field(min_length=3)


# --- Salidas ---


class AlergiaSalida(BaseModel):
    descripcion: str
    severidad: str


class ResumenMascota(BaseModel):
    id: uuid.UUID
    nombre: str
    especie: str
    raza: str | None
    edad: str | None
    numero_historia: str
    fotografia: str | None
    alergias: list[AlergiaSalida]
    esquema_al_dia: bool
    ultima_atencion: date | None
    propietario_nombre: str
    propietario_telefono: str


class VacunaFicha(BaseModel):
    biologico: str
    fecha_aplicacion: date
    fecha_proxima_dosis: date | None
    refuerzo_programado: bool


class AtencionFicha(BaseModel):
    id: uuid.UUID
    fecha: datetime
    motivo: str
    veterinario: str
    estado: EstadoConsulta


class FichaPaciente(ResumenMascota):
    vacunas: list[VacunaFicha]
    atenciones: list[AtencionFicha]
    consulta_abierta_id: uuid.UUID | None


class PrescripcionSalida(BaseModel):
    id: uuid.UUID
    producto_id: uuid.UUID
    producto: str
    cantidad: int
    dosis: str | None
    via_administracion: str | None
    frecuencia: str | None
    duracion: str | None
    alerta_revisada: bool
    motivo_omision_alerta: str | None


class VacunacionSalida(BaseModel):
    id: uuid.UUID
    esquema_id: uuid.UUID
    biologico: str
    laboratorio: str | None
    lote_id: uuid.UUID
    lote_codigo: str
    lote_vence: date
    fecha_aplicacion: date
    fecha_proxima_dosis: date | None
    fecha_aviso: date | None


class NotaSalida(BaseModel):
    id: uuid.UUID
    texto: str
    autor: str
    fecha: datetime


class FacturaResumen(BaseModel):
    id: uuid.UUID
    numero: str
    estado: str


class ConsultaDetalle(BaseModel):
    id: uuid.UUID
    estado: EstadoConsulta
    fecha: datetime
    cerrada_en: datetime | None
    veterinario: str
    motivo: str
    peso: float | None
    temperatura: float | None
    frecuencia_cardiaca: int | None
    hallazgos: str | None
    diagnostico: str | None
    plan_tratamiento: str | None
    mascota: ResumenMascota
    servicios: list[str]
    prescripciones: list[PrescripcionSalida]
    vacunaciones: list[VacunacionSalida]
    notas: list[NotaSalida]
    factura: FacturaResumen | None


class MedicamentoCatalogo(BaseModel):
    id: uuid.UUID
    nombre: str
    principio_activo: str | None


class LoteSalida(BaseModel):
    id: uuid.UUID
    codigo: str
    fecha_vencimiento: date
    disponible: int


class OpcionVacuna(BaseModel):
    esquema_id: uuid.UUID
    biologico: str
    laboratorio: str | None
    numero_dosis: int
    intervalo_dias: int
    lotes: list[LoteSalida]


class OpcionesVacunacion(BaseModel):
    dias_aviso: int
    opciones: list[OpcionVacuna]


class RegistroAlerta(BaseModel):
    decision: str
    motivo: str | None
    usuario: str
    fecha: datetime
