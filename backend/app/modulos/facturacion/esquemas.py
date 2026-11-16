import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.modulos.facturacion.modelos import EstadoFactura, MedioPago, TipoItemFactura

EstadoLinea = Literal["SERVICIO", "VIGENTE", "VENCIDO", "INSUFICIENTE", "SIN_LOTE"]
OrigenLinea = Literal["SERVICIO", "VACUNA", "PRESCRIPCION"]

# --- Entradas ---


class SolicitudAjuste(BaseModel):
    """Cambio de lote o de cantidad en la cuenta de cobro (puede provocar D1 o D2)."""

    lote_id: uuid.UUID | None = None
    cantidad: int | None = Field(None, ge=1, le=99)


class SolicitudPago(BaseModel):
    medio: MedioPago
    valor_recibido: Decimal | None = Field(None, ge=0)
    # Tecla 4 de la demostración: la API falla a mitad de la transacción (D3).
    simular_falla: bool = False


class SolicitudAnulacion(BaseModel):
    motivo: str = Field(min_length=5)


class SolicitudEntrada(BaseModel):
    cantidad: int = Field(ge=1, le=999)


# --- Salidas ---


class PacienteFacturacion(BaseModel):
    id: uuid.UUID
    nombre: str
    especie: str
    edad: str | None
    numero_historia: str
    fotografia: str | None


class OpcionLote(BaseModel):
    id: uuid.UUID
    codigo: str
    fecha_vencimiento: date
    disponible: int
    vencido: bool


class LineaCuentaSalida(BaseModel):
    id: uuid.UUID
    origen: OrigenLinea
    tipo: TipoItemFactura
    descripcion: str
    lote_id: uuid.UUID | None
    lote_codigo: str | None
    lote_vence: date | None
    disponible: int | None
    cantidad: int
    precio_unitario: float
    subtotal: float
    estado: EstadoLinea
    editable: bool
    lotes: list[OpcionLote]


class DetalleComprobante(BaseModel):
    descripcion: str
    lote: str | None
    cantidad: int
    precio_unitario: float
    subtotal: float


class ComprobanteSalida(BaseModel):
    id: uuid.UUID
    numero: str
    estado: EstadoFactura
    consulta_id: uuid.UUID
    emitida_en: datetime
    total: float
    medio: MedioPago | None
    valor_recibido: float | None
    cambio: float | None
    propietario: str
    correo_propietario: str
    paciente: PacienteFacturacion
    fecha_atencion: datetime
    servicio_principal: str | None
    detalles: list[DetalleComprobante]
    anulada_en: datetime | None
    anulada_por: str | None
    motivo_anulacion: str | None


class CuentaDeCobroSalida(BaseModel):
    consulta_id: uuid.UUID
    fecha_atencion: datetime
    servicio_principal: str | None
    paciente: PacienteFacturacion
    lineas: list[LineaCuentaSalida]
    total: float
    bloqueada: bool
    factura: ComprobanteSalida | None


class EnvioComprobante(BaseModel):
    destinatario: str
