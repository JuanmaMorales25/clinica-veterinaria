from app.core.db import SesionLocal
from app.modulos.notificaciones.servicio import ServicioNotificaciones


def procesar_recordatorios_programados() -> None:
    """Envía recordatorios vencidos y guarda el estado de cada intento."""
    with SesionLocal() as sesion:
        ServicioNotificaciones(sesion).procesar_pendientes()
