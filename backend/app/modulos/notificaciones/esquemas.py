from datetime import time

from pydantic import BaseModel, ConfigDict

from app.modulos.pacientes.modelos import TipoCanal


class PreferenciasNotificacion(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    canal: TipoCanal
    recibir_recordatorios: bool
    recordatorio_citas: bool
    promociones: bool
    hora_preferida: time


class SolicitudPreferenciasNotificacion(BaseModel):
    canal: TipoCanal
    recibir_recordatorios: bool
    recordatorio_citas: bool
    promociones: bool = False
    hora_preferida: time
