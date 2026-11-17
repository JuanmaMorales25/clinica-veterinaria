"""HU-MVP-01: ciclo de vida de la cita (patrón State) y flujo alterno B1."""

import uuid
from datetime import datetime, time, timedelta
from decimal import Decimal
from unittest.mock import Mock
from zoneinfo import ZoneInfo

import pytest

from app.core.config import obtener_configuracion
from app.core.db import ahora
from app.core.errores import ErrorDeNegocio
from app.modulos.acceso.modelos import Rol, Usuario
from app.modulos.agenda.esquemas import SolicitudCita
from app.modulos.agenda.estado import TransicionNoPermitida
from app.modulos.agenda.modelos import Cita, EstadoCitaValor, Servicio
from app.modulos.agenda.repositorio import RepositorioAgenda
from app.modulos.agenda.servicio import ServicioAgenda
from app.modulos.pacientes.modelos import Mascota, Propietario

ZONA = ZoneInfo(obtener_configuracion().zona_horaria)


def cita(estado: EstadoCitaValor, en: timedelta = timedelta(days=2)) -> Cita:
    return Cita(id=uuid.uuid4(), estado=estado, fecha_hora=ahora() + en)


def proximo_dia_habil() -> datetime:
    dia = ahora().astimezone(ZONA).date() + timedelta(days=1)
    while dia.weekday() not in obtener_configuracion().dias_agenda:
        dia += timedelta(days=1)
    return datetime.combine(dia, time(0, 0), tzinfo=ZONA)


# --- Patrón State ---


def test_cita_pendiente_se_confirma():
    nueva = cita(EstadoCitaValor.PENDIENTE)
    nueva.confirmar()
    assert nueva.estado == EstadoCitaValor.CONFIRMADA


def test_cita_pendiente_se_cancela_con_motivo():
    nueva = cita(EstadoCitaValor.PENDIENTE)
    nueva.cancelar("Viaje")
    assert nueva.estado == EstadoCitaValor.CANCELADA
    assert nueva.motivo_cancelacion == "Viaje"


def test_cita_pendiente_no_se_marca_atendida():
    with pytest.raises(TransicionNoPermitida):
        cita(EstadoCitaValor.PENDIENTE).marcar_atendida()


@pytest.mark.parametrize(
    ("accion", "esperado"),
    [
        ("marcar_atendida", EstadoCitaValor.ATENDIDA),
        ("marcar_no_asistida", EstadoCitaValor.NO_ASISTIDA),
    ],
)
def test_cita_confirmada_termina_atendida_o_no_asistida(accion, esperado):
    confirmada = cita(EstadoCitaValor.CONFIRMADA)
    getattr(confirmada, accion)()
    assert confirmada.estado == esperado


def test_cancelar_confirmada_con_menos_de_cuatro_horas_deja_constancia():
    confirmada = cita(EstadoCitaValor.CONFIRMADA, en=timedelta(hours=1))
    confirmada.cancelar("Imprevisto")
    assert confirmada.estado == EstadoCitaValor.CANCELADA
    assert confirmada.motivo_cancelacion.startswith("Incumplimiento RN-11")


@pytest.mark.parametrize(
    "estado",
    [EstadoCitaValor.ATENDIDA, EstadoCitaValor.CANCELADA, EstadoCitaValor.NO_ASISTIDA],
)
def test_estados_finales_no_admiten_transiciones(estado):
    final = cita(estado)
    for accion in (final.confirmar, final.marcar_atendida, final.marcar_no_asistida):
        with pytest.raises(TransicionNoPermitida):
            accion()
    with pytest.raises(TransicionNoPermitida):
        final.cancelar("Sin motivo")
    assert final.estado == estado


# --- Servicio de agenda ---


@pytest.fixture
def agenda():
    propietario = Propietario(id=uuid.uuid4(), nombre="María Gómez")
    usuario = Usuario(id=uuid.uuid4(), nombre="María Gómez", rol=Rol.PROPIETARIO)
    veterinaria = Usuario(id=uuid.uuid4(), nombre="Dra. Ramírez", rol=Rol.VETERINARIO)
    servicio = Servicio(
        id=uuid.uuid4(), nombre="Consulta general", duracion_estimada=30, precio=Decimal(80000)
    )
    servicio.activo = True
    mascota = Mascota(id=uuid.uuid4(), nombre="Manolito", propietario_id=propietario.id)

    repositorio = Mock(spec=RepositorioAgenda)
    repositorio.propietario_de.return_value = propietario
    repositorio.mascota_de_propietario.return_value = mascota
    repositorio.servicio.return_value = servicio
    repositorio.veterinario.return_value = veterinaria
    repositorio.veterinarios.return_value = [veterinaria]
    repositorio.citas_del_dia.return_value = []
    servicio_agenda = ServicioAgenda(Mock(), repositorio)

    def solicitar(hora: time):
        fecha = proximo_dia_habil().replace(hour=hora.hour, minute=hora.minute)
        return servicio_agenda.solicitar_cita(
            usuario,
            SolicitudCita(
                mascota_id=mascota.id,
                servicio_id=servicio.id,
                fecha_hora=fecha,
                veterinario_id=veterinaria.id,
            ),
        )

    return solicitar, repositorio


def test_b1_horario_ocupado_devuelve_sugerencias(agenda):
    solicitar, repositorio = agenda
    with pytest.raises(ErrorDeNegocio) as error:
        solicitar(time(10, 0))
    assert error.value.codigo == "HORARIO_NO_DISPONIBLE"
    assert error.value.estado_http == 409
    sugeridos = error.value.detalle["horarios_sugeridos"]
    assert len(sugeridos) == 3
    assert all(datetime.fromisoformat(h).time() != time(10, 0) for h in sugeridos)
    repositorio.agregar.assert_not_called()


def test_horario_fuera_de_jornada_no_se_agenda(agenda):
    solicitar, repositorio = agenda
    with pytest.raises(ErrorDeNegocio) as error:
        solicitar(time(18, 0))
    assert error.value.codigo == "HORARIO_NO_DISPONIBLE"
    repositorio.agregar.assert_not_called()


def test_horario_traslapado_con_otra_cita_no_se_agenda(agenda):
    solicitar, repositorio = agenda
    veterinaria = repositorio.veterinario.return_value
    ocupada = Cita(
        veterinario_id=veterinaria.id,
        fecha_hora=proximo_dia_habil().replace(hour=11),
        servicio=Servicio(duracion_estimada=60),
        estado=EstadoCitaValor.CONFIRMADA,
    )
    repositorio.citas_del_dia.return_value = [ocupada]
    with pytest.raises(ErrorDeNegocio) as error:
        solicitar(time(11, 30))
    assert error.value.codigo == "HORARIO_NO_DISPONIBLE"


def test_b2_historia_de_otro_propietario_no_se_vincula(agenda):
    _, repositorio = agenda
    repositorio.mascota_por_historia.return_value = Mascota(
        id=uuid.uuid4(), nombre="Luna", propietario_id=uuid.uuid4()
    )
    usuario = Usuario(id=uuid.uuid4(), rol=Rol.PROPIETARIO)
    with pytest.raises(ErrorDeNegocio) as error:
        ServicioAgenda(Mock(), repositorio).vincular_mascota(usuario, "hc-00502")
    assert error.value.codigo == "HISTORIA_NO_ENCONTRADA"
    repositorio.mascota_por_historia.assert_called_once_with("HC-00502")
