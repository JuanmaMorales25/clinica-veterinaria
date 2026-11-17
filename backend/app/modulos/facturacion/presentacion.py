"""Convierte la cuenta de cobro y la factura a lo que devuelve la API."""

from collections.abc import Sequence
from datetime import date

from app.modulos.atencion.modelos import Consulta
from app.modulos.facturacion.esquemas import (
    AlertaStockSalida,
    ComprobanteSalida,
    CuentaDeCobroSalida,
    DetalleComprobante,
    LineaCuentaSalida,
    OpcionLote,
    PacienteFacturacion,
)
from app.modulos.facturacion.modelos import Factura
from app.modulos.facturacion.servicio import AlertaStock, CuentaDeCobro


def paciente(consulta: Consulta, dia: date) -> PacienteFacturacion:
    mascota = consulta.mascota
    return PacienteFacturacion(
        id=mascota.id,
        nombre=mascota.nombre,
        especie=mascota.especie,
        edad=mascota.describir_edad(dia),
        numero_historia=mascota.numero_historia,
        fotografia=mascota.fotografia,
    )


def servicio_principal(consulta: Consulta) -> str | None:
    return consulta.servicios_prestados[0].servicio.nombre if consulta.servicios_prestados else None


def cuenta_a_salida(
    cuenta: CuentaDeCobro, dia: date, factura: Factura | None = None
) -> CuentaDeCobroSalida:
    consulta = cuenta.consulta
    return CuentaDeCobroSalida(
        consulta_id=consulta.id,
        fecha_atencion=consulta.fecha,
        servicio_principal=servicio_principal(consulta),
        paciente=paciente(consulta, dia),
        lineas=[
            LineaCuentaSalida(
                id=linea.id,
                origen=linea.origen,
                tipo=linea.tipo,
                descripcion=linea.descripcion,
                lote_id=linea.lote.id if linea.lote else None,
                lote_codigo=linea.lote.codigo if linea.lote else None,
                lote_vence=linea.lote.fecha_vencimiento if linea.lote else None,
                disponible=linea.lote.cantidad_disponible if linea.lote else None,
                cantidad=linea.cantidad,
                precio_unitario=linea.precio_unitario,
                subtotal=linea.subtotal,
                estado=linea.estado(dia),
                editable=linea.item is not None,
                lotes=[
                    OpcionLote(
                        id=lote.id,
                        codigo=lote.codigo,
                        fecha_vencimiento=lote.fecha_vencimiento,
                        disponible=lote.cantidad_disponible,
                        vencido=lote.esta_vencido(dia),
                    )
                    for lote in linea.lotes
                ],
            )
            for linea in cuenta.lineas
        ],
        total=cuenta.total,
        bloqueada=cuenta.bloqueada(dia),
        factura=factura_a_salida(factura, dia) if factura else None,
    )


def factura_a_salida(
    factura: Factura, dia: date, alertas: Sequence[AlertaStock] = ()
) -> ComprobanteSalida:
    consulta = factura.consulta
    pago = factura.pagos[0] if factura.pagos else None
    codigos_lote = {d.lote_id: None for d in factura.detalles if d.lote_id}
    for vacuna in consulta.vacunaciones:
        codigos_lote[vacuna.lote_id] = vacuna.lote.codigo
    for item in consulta.items_aplicados:
        if item.lote_id and item.lote:
            codigos_lote[item.lote_id] = item.lote.codigo
    return ComprobanteSalida(
        id=factura.id,
        numero=factura.numero,
        estado=factura.estado,
        consulta_id=consulta.id,
        emitida_en=factura.emitida_en,
        total=factura.total,
        medio=pago.medio if pago else None,
        valor_recibido=pago.valor if pago else None,
        cambio=pago.cambio if pago else None,
        propietario=consulta.mascota.propietario.nombre,
        correo_propietario=consulta.mascota.propietario.correo,
        paciente=paciente(consulta, dia),
        fecha_atencion=consulta.fecha,
        servicio_principal=servicio_principal(consulta),
        detalles=[
            DetalleComprobante(
                descripcion=detalle.descripcion,
                lote=codigos_lote.get(detalle.lote_id),
                cantidad=detalle.cantidad,
                precio_unitario=detalle.precio_unitario,
                subtotal=detalle.subtotal,
            )
            for detalle in factura.detalles
        ],
        alertas_stock=[
            AlertaStockSalida(producto=a.producto, disponible=a.disponible, minimo=a.minimo)
            for a in alertas
        ],
        anulada_en=factura.anulada_en,
        anulada_por=factura.anulada_por.nombre if factura.anulada_por else None,
        motivo_anulacion=factura.motivo_anulacion,
    )
