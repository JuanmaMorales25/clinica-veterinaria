"""Importa todos los modelos para que SQLAlchemy y Alembic conozcan cada tabla."""

from app.modulos.acceso.modelos import Usuario
from app.modulos.agenda.modelos import Cita, Servicio
from app.modulos.atencion.modelos import (
    Consulta,
    EsquemaVacunacion,
    ItemAplicado,
    NotaAclaratoria,
    ServicioPrestado,
    Vacunacion,
)
from app.modulos.auditoria.modelos import EventoAuditoria
from app.modulos.facturacion.modelos import DetalleFactura, Factura, Pago
from app.modulos.inventario.modelos import Lote, MovimientoInventario, Producto
from app.modulos.notificaciones.modelos import MensajeEnviado, Recordatorio
from app.modulos.pacientes.modelos import Alergia, Mascota, PreferenciaNotificacion, Propietario

__all__ = [
    "Alergia",
    "Cita",
    "Consulta",
    "DetalleFactura",
    "EsquemaVacunacion",
    "EventoAuditoria",
    "Factura",
    "ItemAplicado",
    "Lote",
    "Mascota",
    "MensajeEnviado",
    "MovimientoInventario",
    "NotaAclaratoria",
    "Pago",
    "PreferenciaNotificacion",
    "Producto",
    "Propietario",
    "Recordatorio",
    "Servicio",
    "ServicioPrestado",
    "Usuario",
    "Vacunacion",
]
