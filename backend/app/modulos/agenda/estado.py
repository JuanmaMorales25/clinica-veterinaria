from abc import ABC
from datetime import timedelta

from app.core.db import ahora
from app.modulos.agenda.modelos import Cita, EstadoCitaValor


class TransicionNoPermitida(Exception):
    def __init__(self, estado: EstadoCitaValor, accion: str) -> None:
        self.estado = estado
        self.accion = accion
        super().__init__(f"No se puede {accion} una cita en estado {estado.value.lower()}.")


class EstadoCita(ABC):
    valor: EstadoCitaValor

    def confirmar(self, cita: Cita) -> None:
        self._prohibir("confirmar")

    def cancelar(self, cita: Cita, motivo: str) -> None:
        self._prohibir("cancelar")

    def marcar_atendida(self, cita: Cita) -> None:
        self._prohibir("marcar atendida")

    def marcar_no_asistida(self, cita: Cita) -> None:
        self._prohibir("marcar no asistida")

    def _prohibir(self, accion: str) -> None:
        raise TransicionNoPermitida(self.valor, accion)


class CitaPendiente(EstadoCita):
    valor = EstadoCitaValor.PENDIENTE

    def confirmar(self, cita: Cita) -> None:
        cita.estado = EstadoCitaValor.CONFIRMADA

    def cancelar(self, cita: Cita, motivo: str) -> None:
        cita.estado = EstadoCitaValor.CANCELADA
        cita.motivo_cancelacion = motivo


class CitaConfirmada(EstadoCita):
    valor = EstadoCitaValor.CONFIRMADA

    def cancelar(self, cita: Cita, motivo: str) -> None:
        if cita.fecha_hora - ahora() < timedelta(hours=4):
            cita.motivo_cancelacion = f"Incumplimiento RN-11: {motivo}"[:255]
        else:
            cita.motivo_cancelacion = motivo
        cita.estado = EstadoCitaValor.CANCELADA

    def marcar_atendida(self, cita: Cita) -> None:
        cita.estado = EstadoCitaValor.ATENDIDA

    def marcar_no_asistida(self, cita: Cita) -> None:
        cita.estado = EstadoCitaValor.NO_ASISTIDA


class CitaAtendida(EstadoCita):
    valor = EstadoCitaValor.ATENDIDA


class CitaCancelada(EstadoCita):
    valor = EstadoCitaValor.CANCELADA


class CitaNoAsistida(EstadoCita):
    valor = EstadoCitaValor.NO_ASISTIDA


_ESTADOS: dict[EstadoCitaValor, type[EstadoCita]] = {
    EstadoCitaValor.PENDIENTE: CitaPendiente,
    EstadoCitaValor.CONFIRMADA: CitaConfirmada,
    EstadoCitaValor.ATENDIDA: CitaAtendida,
    EstadoCitaValor.CANCELADA: CitaCancelada,
    EstadoCitaValor.NO_ASISTIDA: CitaNoAsistida,
}


def obtener_estado(valor: EstadoCitaValor) -> EstadoCita:
    return _ESTADOS[valor]()
