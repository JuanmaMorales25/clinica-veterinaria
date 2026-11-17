"""HU-MVP-04: envío de recordatorios con el patrón Strategy y flujo alterno E2."""

import uuid
from datetime import datetime, time
from unittest.mock import Mock
from zoneinfo import ZoneInfo

import pytest

from app.core.config import obtener_configuracion
from app.modulos.notificaciones.modelos import (
    EstadoRecordatorio,
    Recordatorio,
    TipoRecordatorio,
)
from app.modulos.notificaciones.repositorio import RepositorioNotificaciones
from app.modulos.notificaciones.servicio import CanalNotificacion, ServicioNotificaciones
from app.modulos.pacientes.modelos import Mascota, PreferenciaNotificacion, Propietario, TipoCanal

ZONA = ZoneInfo(obtener_configuracion().zona_horaria)
PROGRAMADO_PARA = datetime(2026, 11, 20, 9, 0, tzinfo=ZONA)


class CanalDePrueba(CanalNotificacion):
    def __init__(self, falla: bool = False) -> None:
        self.enviados: list[tuple[str, str]] = []
        self.falla = falla

    def enviar(self, propietario: Propietario, mensaje: str) -> None:
        if self.falla:
            raise ConnectionError("Servidor de correo no disponible")
        self.enviados.append((propietario.nombre, mensaje))


def preferencia(**cambios) -> PreferenciaNotificacion:
    valores = {
        "canal": TipoCanal.CORREO,
        "recibir_recordatorios": True,
        "recordatorio_citas": True,
        "hora_preferida": time(9, 0),
    } | cambios
    return PreferenciaNotificacion(**valores)


def recordatorio(tipo: TipoRecordatorio = TipoRecordatorio.PROXIMA_DOSIS) -> Recordatorio:
    return Recordatorio(
        id=uuid.uuid4(),
        tipo=tipo,
        fecha_programada=PROGRAMADO_PARA,
        estado=EstadoRecordatorio.PROGRAMADO,
        intentos=0,
    )


def procesar(pendiente, preferencia_propietario, canales=None, a_las=time(9, 30)):
    correo, mensajeria = CanalDePrueba(), CanalDePrueba()
    repositorio = Mock(spec=RepositorioNotificaciones)
    repositorio.pendientes.return_value = [
        (
            pendiente,
            Mascota(nombre="Manolito"),
            Propietario(nombre="María Gómez"),
            preferencia_propietario,
        )
    ]
    repositorio.detalle_recordatorio.return_value = "Manolito tiene pendiente la próxima dosis."
    canales = canales or {TipoCanal.CORREO: correo, TipoCanal.MENSAJERIA: mensajeria}
    servicio = ServicioNotificaciones(Mock(), repositorio, canales)
    enviados = servicio.procesar_pendientes(datetime.combine(PROGRAMADO_PARA.date(), a_las, ZONA))
    repositorio.guardar.assert_called_once()
    return enviados, canales


@pytest.mark.parametrize("canal", [TipoCanal.CORREO, TipoCanal.MENSAJERIA])
def test_el_recordatorio_sale_por_el_canal_preferido(canal):
    pendiente = recordatorio()
    enviados, canales = procesar(pendiente, preferencia(canal=canal))
    assert enviados == 1
    assert pendiente.estado == EstadoRecordatorio.ENVIADO
    assert len(canales[canal].enviados) == 1
    otro = next(c for tipo, c in canales.items() if tipo != canal)
    assert otro.enviados == []
    assert "Manolito" in canales[canal].enviados[0][1]


def test_sin_preferencias_se_usa_el_correo():
    pendiente = recordatorio()
    enviados, canales = procesar(pendiente, None)
    assert enviados == 1
    assert len(canales[TipoCanal.CORREO].enviados) == 1


def test_e2_recordatorios_desactivados_no_se_envian():
    pendiente = recordatorio()
    enviados, canales = procesar(pendiente, preferencia(recibir_recordatorios=False))
    assert enviados == 0
    assert pendiente.estado == EstadoRecordatorio.CANCELADO
    assert all(canal.enviados == [] for canal in canales.values())


def test_recordatorio_de_cita_respeta_su_propia_preferencia():
    pendiente = recordatorio(TipoRecordatorio.CITA)
    enviados, _ = procesar(pendiente, preferencia(recordatorio_citas=False))
    assert enviados == 0
    assert pendiente.estado == EstadoRecordatorio.CANCELADO


def test_antes_de_la_hora_preferida_se_reprograma():
    pendiente = recordatorio()
    enviados, _ = procesar(pendiente, preferencia(hora_preferida=time(15, 0)), a_las=time(10, 0))
    assert enviados == 0
    assert pendiente.estado == EstadoRecordatorio.PROGRAMADO
    assert pendiente.fecha_programada.astimezone(ZONA).time() == time(15, 0)


def test_falla_del_canal_se_reintenta_y_al_tercer_intento_queda_fallido():
    pendiente = recordatorio()
    canales = {TipoCanal.CORREO: CanalDePrueba(falla=True)}
    for intento in range(1, 4):
        enviados, _ = procesar(pendiente, preferencia(), canales)
        assert enviados == 0
        assert pendiente.intentos == intento
    assert pendiente.estado == EstadoRecordatorio.FALLIDO
    assert "no disponible" in pendiente.ultimo_error


def test_e2_apagar_vacunacion_no_apaga_el_recordatorio_de_cita():
    pendiente = recordatorio(TipoRecordatorio.CITA)
    enviados, _ = procesar(pendiente, preferencia(recibir_recordatorios=False))
    assert enviados == 1
    assert pendiente.estado == EstadoRecordatorio.ENVIADO
