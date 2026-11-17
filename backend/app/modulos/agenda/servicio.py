import logging
import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config import obtener_configuracion
from app.core.db import ahora
from app.core.errores import ErrorDeNegocio
from app.modulos.acceso.modelos import Rol, Usuario
from app.modulos.agenda.esquemas import (
    CitaAgendaSalida,
    HorarioDisponible,
    MascotaAgendaSalida,
    ServicioAgendaSalida,
    SolicitudCancelarCita,
    SolicitudCita,
)
from app.modulos.agenda.estado import TransicionNoPermitida
from app.modulos.agenda.modelos import Cita, EstadoCitaValor, Servicio
from app.modulos.agenda.repositorio import RepositorioAgenda
from app.modulos.notificaciones.modelos import EstadoRecordatorio, Recordatorio, TipoRecordatorio
from app.modulos.pacientes.modelos import Mascota, Propietario

logger = logging.getLogger(__name__)

HORA_ALTERNO_B1 = time(10, 0)


class ServicioAgenda:
    def __init__(self, sesion: Session, repositorio: RepositorioAgenda | None = None) -> None:
        self.sesion = sesion
        self.repositorio = repositorio or RepositorioAgenda(sesion)

    def mascotas(self, usuario: Usuario) -> list[MascotaAgendaSalida]:
        propietario = self._propietario(usuario.id)
        return [
            self._salida_mascota(mascota)
            for mascota in self.repositorio.mascotas_de(propietario.id)
        ]

    def vincular_mascota(self, usuario: Usuario, numero_historia: str) -> MascotaAgendaSalida:
        propietario = self._propietario(usuario.id)
        historia = numero_historia.strip().upper()
        mascota = self.repositorio.mascota_por_historia(historia)
        if mascota is None or mascota.propietario_id != propietario.id:
            raise ErrorDeNegocio(
                "HISTORIA_NO_ENCONTRADA",
                "No encontramos una mascota asociada con ese número de historia.",
                404,
            )
        return self._salida_mascota(mascota)

    def servicios(self) -> list[ServicioAgendaSalida]:
        return [
            ServicioAgendaSalida.model_validate(servicio)
            for servicio in self.repositorio.servicios_activos()
        ]

    def horarios(self, dia: date, servicio_id: uuid.UUID) -> list[HorarioDisponible]:
        zona = ZoneInfo(obtener_configuracion().zona_horaria)
        servicio = self._servicio_activo(servicio_id)
        veterinarios = self.repositorio.veterinarios()
        if (
            dia.weekday() not in obtener_configuracion().dias_agenda
            or dia < ahora().astimezone(zona).date()
        ):
            return []

        citas = self.repositorio.citas_del_dia(dia, zona)
        disponibles: list[HorarioDisponible] = []
        for fecha_hora in self._inicios_dia(dia, servicio.duracion_estimada, zona):
            if fecha_hora <= ahora().astimezone(zona):
                continue
            veterinario = next(
                (
                    candidato
                    for candidato in veterinarios
                    if self._veterinario_disponible(
                        candidato.id, fecha_hora, servicio.duracion_estimada, citas
                    )
                ),
                None,
            )
            if veterinario is None:
                disponibles.append(HorarioDisponible(fecha_hora=fecha_hora, disponible=False))
            else:
                disponibles.append(
                    HorarioDisponible(
                        fecha_hora=fecha_hora,
                        veterinario_id=veterinario.id,
                        veterinario=veterinario.nombre,
                    )
                )
        return disponibles

    def solicitar_cita(self, usuario: Usuario, datos: SolicitudCita) -> CitaAgendaSalida:
        propietario = self._propietario(usuario.id)
        mascota = self.repositorio.mascota_de_propietario(datos.mascota_id, propietario.id)
        if mascota is None:
            raise ErrorDeNegocio(
                "HISTORIA_NO_ENCONTRADA", "La mascota no está vinculada a tu cuenta.", 404
            )
        servicio = self._servicio_activo(datos.servicio_id)
        zona = ZoneInfo(obtener_configuracion().zona_horaria)
        fecha_hora = self._a_hora_local(datos.fecha_hora, zona)
        veterinario = self.repositorio.veterinario(datos.veterinario_id, bloquear=True)
        citas = self.repositorio.citas_del_dia(fecha_hora.date(), zona)
        disponible = (
            veterinario is not None
            and self._en_jornada(fecha_hora, servicio.duracion_estimada)
            and fecha_hora > ahora().astimezone(zona)
            and self._veterinario_disponible(
                veterinario.id, fecha_hora, servicio.duracion_estimada, citas
            )
            and not self._bloqueo_demo_b1(fecha_hora)
        )
        if not disponible:
            raise ErrorDeNegocio(
                "HORARIO_NO_DISPONIBLE",
                "Ese horario ya no está disponible. Elige una de las opciones sugeridas.",
                409,
                {
                    "horarios_sugeridos": self._sugerencias(
                        fecha_hora.date(), fecha_hora, servicio, citas
                    )
                },
            )

        cita = Cita(
            mascota_id=mascota.id,
            servicio_id=servicio.id,
            veterinario_id=veterinario.id,
            fecha_hora=fecha_hora,
            estado=EstadoCitaValor.PENDIENTE,
        )
        self.repositorio.agregar(cita)
        self.repositorio.confirmar()
        cita = self.repositorio.cita(cita.id) or cita
        salida = self._salida_cita(cita)
        self._notificar_personal(salida, self.repositorio.personal_notificar())
        return salida

    def citas_pendientes(self) -> list[CitaAgendaSalida]:
        return [self._salida_cita(cita) for cita in self.repositorio.citas_pendientes()]

    def confirmar_cita(self, cita_id: uuid.UUID) -> CitaAgendaSalida:
        cita = self._cita(cita_id, bloquear=True)
        if cita.veterinario_id is not None:
            self.repositorio.veterinario(cita.veterinario_id, bloquear=True)
            zona = ZoneInfo(obtener_configuracion().zona_horaria)
            otras = [
                c
                for c in self.repositorio.citas_del_dia(
                    cita.fecha_hora.astimezone(zona).date(), zona
                )
                if c.id != cita.id
            ]
            conflicto = any(
                c.estado == EstadoCitaValor.CONFIRMADA
                and c.veterinario_id == cita.veterinario_id
                and self._se_traslapan(cita, c)
                for c in otras
            )
            if conflicto:
                raise ErrorDeNegocio(
                    "HORARIO_NO_DISPONIBLE",
                    "El veterinario ya tiene una cita confirmada en ese horario.",
                    409,
                    {"horarios_sugeridos": []},
                )
        try:
            cita.confirmar()
        except TransicionNoPermitida as error:
            self._error_transicion(error)
        self._programar_recordatorio_cita(cita)
        self.repositorio.confirmar()
        return self._salida_cita(cita)

    def cancelar_cita(
        self, cita_id: uuid.UUID, usuario: Usuario, datos: SolicitudCancelarCita
    ) -> CitaAgendaSalida:
        cita = self._cita(cita_id, bloquear=True)
        if usuario.rol == Rol.PROPIETARIO and cita.mascota.propietario.usuario_id != usuario.id:
            raise ErrorDeNegocio("CITA_NO_ENCONTRADA", "No encontramos esa cita.", 404)
        try:
            cita.cancelar(datos.motivo.strip())
        except TransicionNoPermitida as error:
            self._error_transicion(error)
        recordatorio = self.repositorio.recordatorio_de_cita(cita.id)
        if recordatorio is not None:
            recordatorio.estado = EstadoRecordatorio.CANCELADO
        self.repositorio.confirmar()
        return self._salida_cita(cita)

    def marcar_atendida(self, cita_id: uuid.UUID) -> CitaAgendaSalida:
        cita = self._cita(cita_id, bloquear=True)
        try:
            cita.marcar_atendida()
        except TransicionNoPermitida as error:
            self._error_transicion(error)
        self.repositorio.confirmar()
        return self._salida_cita(cita)

    def marcar_no_asistida(self, cita_id: uuid.UUID) -> CitaAgendaSalida:
        cita = self._cita(cita_id, bloquear=True)
        try:
            cita.marcar_no_asistida()
        except TransicionNoPermitida as error:
            self._error_transicion(error)
        self.repositorio.confirmar()
        return self._salida_cita(cita)

    def _propietario(self, usuario_id: uuid.UUID) -> Propietario:
        propietario = self.repositorio.propietario_de(usuario_id)
        if propietario is None:
            raise ErrorDeNegocio(
                "PROPIETARIO_NO_ENCONTRADO", "No encontramos tu ficha de propietario.", 404
            )
        return propietario

    def _servicio_activo(self, servicio_id: uuid.UUID) -> Servicio:
        servicio = self.repositorio.servicio(servicio_id)
        if servicio is None or not servicio.activo:
            raise ErrorDeNegocio("SERVICIO_NO_DISPONIBLE", "Ese servicio no está disponible.", 404)
        return servicio

    def _cita(self, cita_id: uuid.UUID, bloquear: bool = False) -> Cita:
        cita = self.repositorio.cita(cita_id, bloquear=bloquear)
        if cita is None:
            raise ErrorDeNegocio("CITA_NO_ENCONTRADA", "No encontramos esa cita.", 404)
        return cita

    @staticmethod
    def _a_hora_local(fecha_hora: datetime, zona: ZoneInfo) -> datetime:
        if fecha_hora.tzinfo is None:
            return fecha_hora.replace(tzinfo=zona)
        return fecha_hora.astimezone(zona)

    def _en_jornada(self, fecha_hora: datetime, duracion: int) -> bool:
        configuracion = obtener_configuracion()
        hora = fecha_hora.timetz().replace(tzinfo=None)
        minutos_validos = (
            hora.minute % configuracion.agenda_intervalo_minutos == 0 and hora.second == 0
        )
        fin = fecha_hora + timedelta(minutes=duracion)
        cierre = datetime.combine(
            fecha_hora.date(), configuracion.agenda_hora_cierre, tzinfo=fecha_hora.tzinfo
        )
        return (
            fecha_hora.weekday() in configuracion.dias_agenda
            and configuracion.agenda_hora_apertura <= hora < configuracion.agenda_hora_cierre
            and minutos_validos
            and fin <= cierre
        )

    def _inicios_dia(self, dia: date, duracion: int, zona: ZoneInfo) -> list[datetime]:
        configuracion = obtener_configuracion()
        inicio = datetime.combine(dia, configuracion.agenda_hora_apertura, tzinfo=zona)
        cierre = datetime.combine(dia, configuracion.agenda_hora_cierre, tzinfo=zona)
        paso = timedelta(minutes=configuracion.agenda_intervalo_minutos)
        horas: list[datetime] = []
        while inicio + timedelta(minutes=duracion) <= cierre:
            horas.append(inicio)
            inicio += paso
        return horas

    @staticmethod
    def _veterinario_disponible(
        veterinario_id: uuid.UUID,
        inicio: datetime,
        duracion: int,
        citas: list[Cita],
    ) -> bool:
        fin = inicio + timedelta(minutes=duracion)
        for cita in citas:
            if cita.veterinario_id != veterinario_id:
                continue
            fin_existente = cita.fecha_hora + timedelta(minutes=cita.servicio.duracion_estimada)
            if inicio < fin_existente and cita.fecha_hora < fin:
                return False
        return True

    @staticmethod
    def _se_traslapan(primera: Cita, segunda: Cita) -> bool:
        fin_primera = primera.fecha_hora + timedelta(minutes=primera.servicio.duracion_estimada)
        fin_segunda = segunda.fecha_hora + timedelta(minutes=segunda.servicio.duracion_estimada)
        return primera.fecha_hora < fin_segunda and segunda.fecha_hora < fin_primera

    @staticmethod
    def _bloqueo_demo_b1(fecha_hora: datetime) -> bool:
        hora = fecha_hora.timetz().replace(tzinfo=None)
        return obtener_configuracion().modo_demo and hora == HORA_ALTERNO_B1

    def _sugerencias(
        self,
        dia: date,
        solicitada: datetime,
        servicio: Servicio,
        citas: list[Cita],
    ) -> list[str]:
        zona = ZoneInfo(obtener_configuracion().zona_horaria)
        veterinarios = self.repositorio.veterinarios()
        candidatos: list[datetime] = []
        for inicio in self._inicios_dia(dia, servicio.duracion_estimada, zona):
            if inicio <= ahora().astimezone(zona) or self._bloqueo_demo_b1(inicio):
                continue
            if any(
                self._veterinario_disponible(v.id, inicio, servicio.duracion_estimada, citas)
                for v in veterinarios
            ):
                candidatos.append(inicio)
        candidatos.sort(key=lambda hora: abs((hora - solicitada).total_seconds()))
        return [hora.isoformat() for hora in candidatos[:3]]

    @staticmethod
    def _salida_mascota(mascota: Mascota) -> MascotaAgendaSalida:
        return MascotaAgendaSalida(
            id=mascota.id,
            nombre=mascota.nombre,
            especie=mascota.especie,
            raza=mascota.raza,
            numero_historia=mascota.numero_historia,
            edad=mascota.describir_edad(ahora().date()),
            fotografia=mascota.fotografia,
        )

    @staticmethod
    def _salida_cita(cita: Cita) -> CitaAgendaSalida:
        return CitaAgendaSalida(
            id=cita.id,
            mascota_id=cita.mascota_id,
            mascota=cita.mascota.nombre,
            servicio=cita.servicio.nombre,
            veterinario=cita.veterinario.nombre if cita.veterinario else None,
            fecha_hora=cita.fecha_hora,
            estado=cita.estado,
            motivo_cancelacion=cita.motivo_cancelacion,
        )

    @staticmethod
    def _notificar_personal(cita: CitaAgendaSalida, personal: list[Usuario]) -> None:
        try:
            from app.core.correo import enviar_correo

            for usuario in personal:
                enviar_correo(
                    usuario.correo_electronico,
                    "Nueva solicitud de cita",
                    (
                        f"{cita.mascota} solicitó {cita.servicio} para "
                        f"{cita.fecha_hora:%d/%m/%Y %H:%M}. La cita está pendiente de confirmación."
                    ),
                )
        except Exception:
            logger.exception("No se pudo notificar al personal sobre la solicitud de cita")

    @staticmethod
    def _error_transicion(error: TransicionNoPermitida) -> None:
        raise ErrorDeNegocio(
            "TRANSICION_NO_PERMITIDA",
            str(error),
            409,
            {"estado": error.estado.value, "accion": error.accion},
        ) from error

    def _programar_recordatorio_cita(self, cita: Cita) -> None:
        if self.repositorio.recordatorio_de_cita(cita.id) is not None:
            return
        configuracion = obtener_configuracion()
        zona = ZoneInfo(configuracion.zona_horaria)
        fecha_cita = self._a_hora_local(cita.fecha_hora, zona)
        preferencia = cita.mascota.propietario.preferencia
        hora_aviso = preferencia.hora_preferida if preferencia else time(9, 0)
        dia_aviso = fecha_cita.date() - timedelta(days=configuracion.dias_aviso_cita)
        fecha = datetime.combine(dia_aviso, hora_aviso, tzinfo=zona)
        self.repositorio.agregar_recordatorio(
            Recordatorio(
                mascota_id=cita.mascota_id,
                cita_id=cita.id,
                tipo=TipoRecordatorio.CITA,
                fecha_programada=max(fecha, ahora()),
            )
        )
