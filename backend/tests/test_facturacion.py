"""CierreAtencionFacade (HU-MVP-03): una sola transacción para inventario, factura y auditoría."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import Mock

import pytest

from app.core.errores import ErrorDeNegocio
from app.core.unidad_de_trabajo import UnidadDeTrabajo
from app.modulos.acceso.modelos import Rol, Usuario
from app.modulos.agenda.modelos import Servicio
from app.modulos.atencion.modelos import (
    Consulta,
    EsquemaVacunacion,
    EstadoConsulta,
    ItemAplicado,
    ServicioPrestado,
    Vacunacion,
)
from app.modulos.atencion.repositorio import RepositorioConsulta
from app.modulos.auditoria.servicio import RegistroAuditoria
from app.modulos.facturacion.modelos import EstadoFactura, Factura, MedioPago
from app.modulos.facturacion.repositorio import RepositorioFactura
from app.modulos.facturacion.servicio import (
    CierreAtencionFacade,
    DatosPago,
    GeneradorCuentaConsulta,
    ServicioFacturacion,
)
from app.modulos.inventario.modelos import Lote, Producto
from app.modulos.inventario.servicio import ConsultaExistencias, DescuentoInventario

RECEPCION = Usuario(id=uuid.uuid4(), nombre="Camila Ríos", rol=Rol.AUXILIAR)
ADMIN = Usuario(id=uuid.uuid4(), nombre="Andrés Restrepo", rol=Rol.ADMINISTRADOR)
VENCE = date(2027, 3, 12)


def producto(nombre: str, precio: int) -> Producto:
    return Producto(id=uuid.uuid4(), nombre=nombre, precio_venta=Decimal(precio))


def lote(prod: Producto, codigo: str, cantidad: int) -> Lote:
    return Lote(
        id=uuid.uuid4(),
        codigo=codigo,
        producto=prod,
        producto_id=prod.id,
        cantidad_disponible=cantidad,
        fecha_vencimiento=VENCE,
    )


def atencion_de_manolito(estado=EstadoConsulta.CERRADA):
    antirrabica = producto("Antirrábica", 30000)
    omeprazol = producto("Omeprazol 10 mg", 5000)
    lote_omeprazol = lote(omeprazol, "L-2481", 3)
    consulta = Consulta(
        id=uuid.uuid4(),
        estado=estado,
        fecha=datetime(2026, 10, 20, 10, 30),
        servicios_prestados=[
            ServicioPrestado(
                id=uuid.uuid4(),
                cantidad=1,
                servicio=Servicio(nombre="Consulta general", precio=Decimal(45000)),
            )
        ],
        vacunaciones=[
            Vacunacion(
                id=uuid.uuid4(),
                esquema=EsquemaVacunacion(biologico="Antirrábica", producto=antirrabica),
                lote=lote(antirrabica, "AR-1043", 8),
            )
        ],
        items_aplicados=[
            ItemAplicado(
                id=uuid.uuid4(),
                producto=omeprazol,
                producto_id=omeprazol.id,
                cantidad=2,
            )
        ],
    )
    return consulta, lote_omeprazol


def fachada(consulta, lote_fefo, factura_existente=None):
    consultas = Mock(spec=RepositorioConsulta)
    consultas.obtener.return_value = consulta
    existencias = Mock(spec=ConsultaExistencias)
    existencias.proponer_lote.return_value = lote_fefo
    existencias.lotes_del_producto.return_value = [lote_fefo]
    facturas = Mock(spec=RepositorioFactura)
    facturas.de_consulta.return_value = factura_existente
    facturas.asignar_consecutivo.side_effect = lambda f: setattr(f, "consecutivo", 7)
    inventario = Mock(spec=DescuentoInventario)
    uow = Mock(spec=UnidadDeTrabajo)
    auditoria = Mock(spec=RegistroAuditoria)
    servicio = ServicioFacturacion(facturas, GeneradorCuentaConsulta(existencias))
    return (
        CierreAtencionFacade(consultas, servicio, inventario, existencias, uow, auditoria),
        inventario,
        uow,
        facturas,
    )


EFECTIVO = DatosPago(MedioPago.EFECTIVO, Decimal(90000))


def test_cuenta_suma_servicios_y_productos_con_lote_fefo():
    consulta, lote_fefo = atencion_de_manolito()
    f, *_ = fachada(consulta, lote_fefo)
    cuenta = f.cuenta_de_cobro(consulta.id)
    assert cuenta.total == Decimal(85000)
    assert [linea.lote.codigo for linea in cuenta.productos] == ["AR-1043", "L-2481"]
    assert not cuenta.bloqueada(date(2026, 10, 20))


def test_facturar_descuenta_inventario_y_emite_en_una_transaccion():
    consulta, lote_fefo = atencion_de_manolito()
    f, inventario, uow, _ = fachada(consulta, lote_fefo)
    factura = f.facturar_atencion(consulta.id, RECEPCION, EFECTIVO)

    assert factura.numero == "F-0007"
    assert factura.total == Decimal(85000)
    assert factura.pagos[0].cambio == Decimal(5000)
    assert inventario.descontar.call_count == 2
    assert consulta.items_aplicados[0].lote_id == lote_fefo.id
    uow.iniciar.assert_called_once()
    uow.confirmar.assert_called_once()
    uow.revertir.assert_not_called()


def test_d3_una_falla_a_mitad_revierte_todo():
    consulta, lote_fefo = atencion_de_manolito()
    f, inventario, uow, facturas = fachada(consulta, lote_fefo)
    with pytest.raises(ErrorDeNegocio) as error:
        f.facturar_atencion(consulta.id, RECEPCION, EFECTIVO, simular_falla=True)

    assert error.value.codigo == "FALLA_TRANSACCION"
    assert error.value.estado_http == 500
    assert error.value.detalle["factura"] == "no creada"
    assert inventario.descontar.called
    facturas.agregar.assert_not_called()
    assert uow.revertir.called
    # Solo se confirma la transacción aparte que deja el rastro de la falla.
    assert uow.confirmar.call_count == 1


def test_d1_un_error_de_inventario_revierte_lo_ya_descontado():
    consulta, lote_fefo = atencion_de_manolito()
    f, inventario, uow, _ = fachada(consulta, lote_fefo)
    inventario.descontar.side_effect = [None, ErrorDeNegocio("LOTE_VENCIDO", "Vencido", 409)]
    with pytest.raises(ErrorDeNegocio) as error:
        f.facturar_atencion(consulta.id, RECEPCION, EFECTIVO)
    assert error.value.codigo == "LOTE_VENCIDO"
    uow.revertir.assert_called_once()
    uow.confirmar.assert_not_called()


def test_pago_insuficiente_no_abre_la_transaccion():
    consulta, lote_fefo = atencion_de_manolito()
    f, inventario, uow, _ = fachada(consulta, lote_fefo)
    with pytest.raises(ErrorDeNegocio) as error:
        f.facturar_atencion(consulta.id, RECEPCION, DatosPago(MedioPago.EFECTIVO, Decimal(80000)))
    assert error.value.codigo == "PAGO_INSUFICIENTE"
    uow.iniciar.assert_not_called()
    inventario.descontar.assert_not_called()


def test_tarjeta_no_deja_cambio():
    assert ServicioFacturacion.liquidar_pago(Decimal(85000), DatosPago(MedioPago.TARJETA)) == (
        Decimal(85000),
        Decimal(0),
    )


def test_no_se_factura_una_atencion_abierta_ni_dos_veces():
    abierta, lote_fefo = atencion_de_manolito(EstadoConsulta.ABIERTA)
    f, *_ = fachada(abierta, lote_fefo)
    with pytest.raises(ErrorDeNegocio) as error:
        f.facturar_atencion(abierta.id, RECEPCION, EFECTIVO)
    assert error.value.codigo == "CONSULTA_ABIERTA"

    cerrada, lote_fefo = atencion_de_manolito()
    f, *_ = fachada(cerrada, lote_fefo, factura_existente=Factura())
    with pytest.raises(ErrorDeNegocio) as error:
        f.facturar_atencion(cerrada.id, RECEPCION, EFECTIVO)
    assert error.value.codigo == "FACTURA_YA_EMITIDA"


def test_d4_anular_reversa_el_inventario_y_deja_el_motivo():
    consulta, lote_fefo = atencion_de_manolito()
    f, inventario, uow, facturas = fachada(consulta, lote_fefo)
    factura = Factura(
        id=uuid.uuid4(), consecutivo=7, consulta_id=consulta.id, estado=EstadoFactura.EMITIDA
    )
    facturas.obtener.return_value = factura
    inventario.reversar_consulta.return_value = []
    f.anular_factura(factura.id, "  Medio de pago equivocado ", ADMIN)

    assert factura.estado == EstadoFactura.ANULADA
    assert factura.motivo_anulacion == "Medio de pago equivocado"
    assert factura.anulada_por_id == ADMIN.id
    inventario.reversar_consulta.assert_called_once_with(consulta.id)
    uow.confirmar.assert_called_once()

    with pytest.raises(ErrorDeNegocio) as error:
        f.anular_factura(factura.id, "Otra vez", ADMIN)
    assert error.value.codigo == "FACTURA_YA_ANULADA"
