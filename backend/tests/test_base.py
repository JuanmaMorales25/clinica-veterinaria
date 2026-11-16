from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient

from app.main import app
from app.modulos.atencion.modelos import EsquemaVacunacion
from app.modulos.facturacion.modelos import DetalleFactura, Factura
from app.modulos.inventario.modelos import Lote

cliente = TestClient(app)


def test_salud():
    respuesta = cliente.get("/api/salud")
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "ok"


def test_ruta_protegida_sin_sesion_responde_codigo():
    respuesta = cliente.get("/api/acceso/yo")
    assert respuesta.status_code == 401
    assert respuesta.json()["codigo"] == "SESION_REQUERIDA"


def test_proxima_dosis_segun_esquema():
    esquema = EsquemaVacunacion(intervalo_dias=21)
    assert esquema.calcular_proxima_dosis(date(2026, 10, 2)) == date(2026, 10, 23)


def test_lote_vencido():
    lote = Lote(fecha_vencimiento=date(2026, 10, 5))
    assert lote.esta_vencido(date(2026, 10, 20))
    assert not lote.esta_vencido(date(2026, 10, 5))


def test_factura_numero_y_total():
    factura = Factura(
        consecutivo=7,
        detalles=[
            DetalleFactura(subtotal=Decimal(45000)),
            DetalleFactura(subtotal=Decimal(40000)),
        ],
    )
    assert factura.numero == "F-0007"
    assert factura.calcular_total() == Decimal(85000)
