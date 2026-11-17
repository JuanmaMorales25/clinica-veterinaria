import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modulos.acceso.modelos import Usuario
from app.modulos.agenda.modelos import Cita
from app.modulos.atencion.modelos import Vacunacion
from app.modulos.notificaciones.modelos import EstadoRecordatorio, Recordatorio, TipoRecordatorio
from app.modulos.pacientes.modelos import Mascota, PreferenciaNotificacion, Propietario


class RepositorioNotificaciones:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def propietario_de(self, usuario_id: uuid.UUID) -> Propietario | None:
        return self.sesion.scalar(
            select(Propietario)
            .where(Propietario.usuario_id == usuario_id)
            .options(selectinload(Propietario.preferencia))
        )

    def pendientes(self, limite: datetime) -> list[tuple[Recordatorio, Mascota, Propietario, PreferenciaNotificacion | None]]:
        consulta = (
            select(Recordatorio, Mascota, Propietario, PreferenciaNotificacion)
            .join(Mascota, Mascota.id == Recordatorio.mascota_id)
            .join(Propietario, Propietario.id == Mascota.propietario_id)
            .outerjoin(PreferenciaNotificacion, PreferenciaNotificacion.propietario_id == Propietario.id)
            .where(
                Recordatorio.estado == EstadoRecordatorio.PROGRAMADO,
                Recordatorio.fecha_programada <= limite,
            )
            .order_by(Recordatorio.fecha_programada)
            .limit(100)
            .with_for_update(skip_locked=True, of=Recordatorio)
        )
        return list(self.sesion.execute(consulta).tuples())

    def recordatorio(self, recordatorio_id: uuid.UUID) -> Recordatorio | None:
        consulta = (
            select(Recordatorio)
            .where(Recordatorio.id == recordatorio_id)
            .with_for_update()
        )
        return self.sesion.scalar(consulta)

    def detalle_recordatorio(self, recordatorio: Recordatorio) -> str:
        if recordatorio.tipo == TipoRecordatorio.PROXIMA_DOSIS and recordatorio.vacunacion_id:
            vacunacion = self.sesion.scalar(
                select(Vacunacion)
                .where(Vacunacion.id == recordatorio.vacunacion_id)
                .options(selectinload(Vacunacion.esquema))
            )
            if vacunacion is not None:
                return f"Tiene pendiente la próxima dosis de {vacunacion.esquema.biologico}."
        if recordatorio.tipo == TipoRecordatorio.CITA and recordatorio.cita_id:
            cita = self.sesion.scalar(
                select(Cita)
                .where(Cita.id == recordatorio.cita_id)
                .options(selectinload(Cita.servicio))
            )
            if cita is not None:
                return f"Recuerda tu cita de {cita.servicio.nombre} el {cita.fecha_hora:%d/%m/%Y a las %H:%M}."
        return "Tienes un recordatorio pendiente para tu mascota."

    def guardar(self) -> None:
        self.sesion.commit()

    def revertir(self) -> None:
        self.sesion.rollback()
