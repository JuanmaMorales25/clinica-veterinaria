import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config import obtener_configuracion
from app.core.db import ahora
from app.core.errores import ErrorDeNegocio
from app.modulos.acceso.modelos import Usuario
from app.modulos.notificaciones.esquemas import (
    PreferenciasNotificacion,
    SolicitudPreferenciasNotificacion,
)
from app.modulos.notificaciones.modelos import (
    EstadoRecordatorio,
    MensajeEnviado,
    TipoRecordatorio,
)
from app.modulos.notificaciones.repositorio import RepositorioNotificaciones
from app.modulos.pacientes.modelos import PreferenciaNotificacion, Propietario, TipoCanal

logger = logging.getLogger(__name__)
HORA_AVISO_POR_DEFECTO = time(9, 0)


class CanalNotificacion(ABC):
    @abstractmethod
    def enviar(self, propietario: Propietario, mensaje: str) -> None: ...


class CanalCorreo(CanalNotificacion):
    def enviar(self, propietario: Propietario, mensaje: str) -> None:
        from app.core.correo import enviar_correo

        enviar_correo(propietario.correo, "Recordatorio de la clínica", mensaje)


class CanalMensajeria(CanalNotificacion):
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def enviar(self, propietario: Propietario, mensaje: str) -> None:
        self.sesion.add(
            MensajeEnviado(
                canal=TipoCanal.MENSAJERIA,
                destinatario=propietario.telefono,
                asunto="Recordatorio de la clínica",
                cuerpo=mensaje,
            )
        )


class ServicioNotificaciones:
    def __init__(
        self,
        sesion: Session,
        repositorio: RepositorioNotificaciones | None = None,
        canales: dict[TipoCanal, CanalNotificacion] | None = None,
    ) -> None:
        self.sesion = sesion
        self.repositorio = repositorio or RepositorioNotificaciones(sesion)
        self.canales = canales or {
            TipoCanal.CORREO: CanalCorreo(),
            TipoCanal.MENSAJERIA: CanalMensajeria(sesion),
        }

    def preferencias(self, usuario: Usuario) -> PreferenciasNotificacion:
        propietario = self._propietario(usuario.id)
        preferencia = self._preferencia(propietario)
        return PreferenciasNotificacion.model_validate(preferencia)

    def actualizar_preferencias(
        self, usuario: Usuario, datos: SolicitudPreferenciasNotificacion
    ) -> PreferenciasNotificacion:
        propietario = self._propietario(usuario.id)
        preferencia = self._preferencia(propietario)
        preferencia.canal = datos.canal
        preferencia.recibir_recordatorios = datos.recibir_recordatorios
        preferencia.recordatorio_citas = datos.recordatorio_citas
        preferencia.promociones = datos.promociones
        preferencia.hora_preferida = datos.hora_preferida
        self.sesion.commit()
        return PreferenciasNotificacion.model_validate(preferencia)

    def procesar_pendientes(self, limite: datetime | None = None) -> int:
        enviados = 0
        zona = ZoneInfo(obtener_configuracion().zona_horaria)
        instante = limite or ahora()
        if instante.tzinfo is None:
            instante = instante.replace(tzinfo=zona)
        else:
            instante = instante.astimezone(zona)
        for recordatorio, mascota, propietario, preferencia in self.repositorio.pendientes(
            instante
        ):
            # Cada interruptor de M4.2 controla su tipo: vacunación (E2) o cita.
            if recordatorio.tipo == TipoRecordatorio.CITA:
                desactivado = preferencia is not None and not preferencia.recordatorio_citas
            else:
                desactivado = preferencia is not None and not preferencia.recibir_recordatorios
            if desactivado:
                recordatorio.estado = EstadoRecordatorio.CANCELADO
                recordatorio.ultimo_error = "Recordatorios desactivados por el propietario."
                continue

            hora_preferida = preferencia.hora_preferida if preferencia else HORA_AVISO_POR_DEFECTO
            fecha_programada = recordatorio.fecha_programada
            if fecha_programada.tzinfo is None:
                fecha_programada = fecha_programada.replace(tzinfo=zona)
            else:
                fecha_programada = fecha_programada.astimezone(zona)
            hora_envio = datetime.combine(fecha_programada.date(), hora_preferida, tzinfo=zona)
            if instante.astimezone(zona) < hora_envio:
                recordatorio.fecha_programada = hora_envio
                continue

            detalle = self.repositorio.detalle_recordatorio(recordatorio, mascota.nombre)
            mensaje = f"Hola {propietario.nombre}. {detalle}"
            canal = self.canales[preferencia.canal if preferencia else TipoCanal.CORREO]
            try:
                canal.enviar(propietario, mensaje)
                recordatorio.estado = EstadoRecordatorio.ENVIADO
                recordatorio.enviado_en = ahora()
                recordatorio.ultimo_error = None
                enviados += 1
            except Exception as error:
                recordatorio.intentos += 1
                recordatorio.ultimo_error = str(error)[:1000]
                if recordatorio.intentos >= 3:
                    recordatorio.estado = EstadoRecordatorio.FALLIDO
                logger.exception("Falló el envío del recordatorio %s", recordatorio.id)
        try:
            self.repositorio.guardar()
        except Exception:
            self.repositorio.revertir()
            logger.exception("No se pudo guardar el procesamiento de recordatorios")
            return 0
        return enviados

    def _propietario(self, usuario_id: uuid.UUID) -> Propietario:
        propietario = self.repositorio.propietario_de(usuario_id)
        if propietario is None:
            raise ErrorDeNegocio(
                "PROPIETARIO_NO_ENCONTRADO", "No encontramos tu ficha de propietario.", 404
            )
        return propietario

    def _preferencia(self, propietario: Propietario) -> PreferenciaNotificacion:
        if propietario.preferencia is None:
            propietario.preferencia = PreferenciaNotificacion()
            self.sesion.flush()
        return propietario.preferencia
