from abc import ABC, abstractmethod
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import obtener_configuracion
from app.core.db import ahora
from app.modulos.atencion.modelos import Vacunacion
from app.modulos.notificaciones.modelos import (
    EstadoRecordatorio,
    Recordatorio,
    TipoRecordatorio,
)
from app.modulos.pacientes.modelos import Mascota

HORA_AVISO_POR_DEFECTO = time(9, 0)


class ProgramadorRecordatorios(ABC):
    @abstractmethod
    def programar_proxima_dosis(
        self, vacunacion: Vacunacion, mascota: Mascota
    ) -> Recordatorio | None: ...


class ProgramadorRecordatoriosBD(ProgramadorRecordatorios):
    """Deja el aviso en la tabla `recordatorio`; el programador de tareas lo envía en su fecha.

    Si el propietario desactivó los recordatorios (E2) se decide al momento de enviar, porque
    puede volver a activarlos antes de la fecha.
    """

    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def programar_proxima_dosis(
        self, vacunacion: Vacunacion, mascota: Mascota
    ) -> Recordatorio | None:
        if vacunacion.fecha_proxima_dosis is None:
            return None
        self._cancelar_avisos_anteriores(vacunacion, mascota)

        configuracion = obtener_configuracion()
        dia_aviso = vacunacion.fecha_proxima_dosis - timedelta(
            days=configuracion.dias_aviso_proxima_dosis
        )
        preferencia = mascota.propietario.preferencia
        hora = preferencia.hora_preferida if preferencia else HORA_AVISO_POR_DEFECTO
        fecha = datetime.combine(dia_aviso, hora, tzinfo=ZoneInfo(configuracion.zona_horaria))
        recordatorio = Recordatorio(
            mascota_id=mascota.id,
            vacunacion_id=vacunacion.id,
            tipo=TipoRecordatorio.PROXIMA_DOSIS,
            fecha_programada=max(fecha, ahora()),
        )
        self.sesion.add(recordatorio)
        return recordatorio

    def _cancelar_avisos_anteriores(self, vacunacion: Vacunacion, mascota: Mascota) -> None:
        """La dosis que se acaba de aplicar reemplaza el aviso pendiente del mismo biológico."""
        pendientes = self.sesion.scalars(
            select(Recordatorio)
            .join(Vacunacion, Recordatorio.vacunacion_id == Vacunacion.id)
            .where(
                Recordatorio.mascota_id == mascota.id,
                Recordatorio.tipo == TipoRecordatorio.PROXIMA_DOSIS,
                Recordatorio.estado == EstadoRecordatorio.PROGRAMADO,
                Vacunacion.esquema_id == vacunacion.esquema_id,
                Vacunacion.id != vacunacion.id,
            )
        )
        for recordatorio in pendientes:
            recordatorio.estado = EstadoRecordatorio.CANCELADO
