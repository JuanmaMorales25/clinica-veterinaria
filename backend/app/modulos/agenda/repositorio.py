import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.modulos.acceso.modelos import Rol, Usuario
from app.modulos.agenda.modelos import Cita, EstadoCitaValor, Servicio
from app.modulos.notificaciones.modelos import EstadoRecordatorio, Recordatorio, TipoRecordatorio
from app.modulos.pacientes.modelos import Mascota, Propietario


class RepositorioAgenda:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def propietario_de(self, usuario_id: uuid.UUID, bloquear: bool = False) -> Propietario | None:
        consulta = select(Propietario).where(Propietario.usuario_id == usuario_id)
        if bloquear:
            consulta = consulta.with_for_update(of=Propietario)
        return self.sesion.scalar(consulta)

    def mascotas_de(self, propietario_id: uuid.UUID) -> list[Mascota]:
        consulta = (
            select(Mascota)
            .where(Mascota.propietario_id == propietario_id)
            .options(selectinload(Mascota.alergias))
            .order_by(Mascota.nombre)
        )
        return list(self.sesion.scalars(consulta))

    def mascota_por_historia(self, numero_historia: str) -> Mascota | None:
        consulta = (
            select(Mascota)
            .where(Mascota.numero_historia == numero_historia)
            .options(selectinload(Mascota.alergias))
        )
        return self.sesion.scalar(consulta)

    def mascota_de_propietario(
        self, mascota_id: uuid.UUID, propietario_id: uuid.UUID
    ) -> Mascota | None:
        consulta = select(Mascota).where(
            Mascota.id == mascota_id, Mascota.propietario_id == propietario_id
        )
        return self.sesion.scalar(consulta)

    def servicios_activos(self) -> list[Servicio]:
        return list(
            self.sesion.scalars(select(Servicio).where(Servicio.activo).order_by(Servicio.nombre))
        )

    def servicio(self, servicio_id: uuid.UUID) -> Servicio | None:
        return self.sesion.get(Servicio, servicio_id)

    def veterinarios(self) -> list[Usuario]:
        return list(
            self.sesion.scalars(
                select(Usuario)
                .where(Usuario.rol == Rol.VETERINARIO, Usuario.estado)
                .order_by(Usuario.nombre)
            )
        )

    def veterinario(self, veterinario_id: uuid.UUID, bloquear: bool = False) -> Usuario | None:
        consulta = select(Usuario).where(
            Usuario.id == veterinario_id,
            Usuario.rol == Rol.VETERINARIO,
            Usuario.estado,
        )
        if bloquear:
            consulta = consulta.with_for_update(of=Usuario)
        return self.sesion.scalar(consulta)

    def citas_del_dia(self, dia: date, zona: ZoneInfo) -> list[Cita]:
        inicio = datetime.combine(dia, time.min, tzinfo=zona)
        fin = inicio + timedelta(days=1)
        consulta = (
            select(Cita)
            .where(
                Cita.fecha_hora >= inicio,
                Cita.fecha_hora < fin,
                Cita.estado.in_([EstadoCitaValor.PENDIENTE, EstadoCitaValor.CONFIRMADA]),
            )
            .options(joinedload(Cita.servicio), joinedload(Cita.mascota))
        )
        return list(self.sesion.scalars(consulta))

    def cita(self, cita_id: uuid.UUID, bloquear: bool = False) -> Cita | None:
        consulta = (
            select(Cita)
            .where(Cita.id == cita_id)
            .options(
                joinedload(Cita.mascota).joinedload(Mascota.propietario),
                joinedload(Cita.servicio),
                joinedload(Cita.veterinario),
            )
        )
        if bloquear:
            consulta = consulta.with_for_update(of=Cita)
        return self.sesion.scalar(consulta)

    def citas_pendientes(self) -> list[Cita]:
        consulta = (
            select(Cita)
            .where(Cita.estado == EstadoCitaValor.PENDIENTE)
            .options(
                joinedload(Cita.mascota).joinedload(Mascota.propietario),
                joinedload(Cita.servicio),
                joinedload(Cita.veterinario),
            )
            .order_by(Cita.fecha_hora)
        )
        return list(self.sesion.scalars(consulta))

    def recordatorio_de_cita(self, cita_id: uuid.UUID) -> Recordatorio | None:
        return self.sesion.scalar(
            select(Recordatorio).where(
                Recordatorio.cita_id == cita_id,
                Recordatorio.tipo == TipoRecordatorio.CITA,
                Recordatorio.estado == EstadoRecordatorio.PROGRAMADO,
            )
        )

    def agregar_recordatorio(self, recordatorio: Recordatorio) -> None:
        self.sesion.add(recordatorio)

    def personal_notificar(self) -> list[Usuario]:
        return list(
            self.sesion.scalars(
                select(Usuario).where(
                    Usuario.rol.in_([Rol.ADMINISTRADOR, Rol.AUXILIAR]), Usuario.estado
                )
            )
        )

    def agregar(self, cita: Cita) -> None:
        self.sesion.add(cita)

    def confirmar(self) -> None:
        self.sesion.commit()

    def revertir(self) -> None:
        self.sesion.rollback()
