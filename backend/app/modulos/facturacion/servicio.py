import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from app.core.db import ahora
from app.core.errores import ErrorDeNegocio
from app.core.unidad_de_trabajo import UnidadDeTrabajo
from app.modulos.acceso.modelos import Usuario
from app.modulos.atencion.modelos import Consulta, EstadoConsulta, ItemAplicado
from app.modulos.atencion.repositorio import RepositorioConsulta
from app.modulos.atencion.servicio import hoy
from app.modulos.auditoria.servicio import RegistroAuditoria
from app.modulos.facturacion.modelos import (
    DetalleFactura,
    EstadoFactura,
    Factura,
    MedioPago,
    Pago,
    TipoItemFactura,
)
from app.modulos.facturacion.repositorio import RepositorioFactura
from app.modulos.inventario.modelos import Lote
from app.modulos.inventario.servicio import ConsultaExistencias, DescuentoInventario

ESTADOS_QUE_BLOQUEAN = ("VENCIDO", "INSUFICIENTE", "SIN_LOTE")


@dataclass
class LineaCuenta:
    id: uuid.UUID
    origen: str
    tipo: TipoItemFactura
    descripcion: str
    cantidad: int
    precio_unitario: Decimal
    producto_id: uuid.UUID | None = None
    lote: Lote | None = None
    item: ItemAplicado | None = None
    lotes: list[Lote] = field(default_factory=list)

    @property
    def subtotal(self) -> Decimal:
        return self.precio_unitario * self.cantidad

    def estado(self, dia: date) -> str:
        if self.tipo == TipoItemFactura.SERVICIO:
            return "SERVICIO"
        if self.lote is None:
            return "SIN_LOTE"
        if self.lote.esta_vencido(dia):
            return "VENCIDO"
        if self.cantidad > self.lote.cantidad_disponible:
            return "INSUFICIENTE"
        return "VIGENTE"


@dataclass
class CuentaDeCobro:
    consulta: Consulta
    lineas: list[LineaCuenta]

    @property
    def total(self) -> Decimal:
        return sum((linea.subtotal for linea in self.lineas), Decimal(0))

    @property
    def productos(self) -> list[LineaCuenta]:
        return [linea for linea in self.lineas if linea.tipo == TipoItemFactura.PRODUCTO]

    def bloqueada(self, dia: date) -> bool:
        return any(linea.estado(dia) in ESTADOS_QUE_BLOQUEAN for linea in self.lineas)


@dataclass(frozen=True)
class DatosPago:
    medio: MedioPago
    valor_recibido: Decimal | None = None


class GeneradorCuenta(ABC):
    """Arma la cuenta de cobro de una atención: servicios prestados y productos aplicados."""

    @abstractmethod
    def generar(self, consulta: Consulta, dia: date) -> CuentaDeCobro: ...


class GeneradorCuentaConsulta(GeneradorCuenta):
    def __init__(self, existencias: ConsultaExistencias) -> None:
        self.existencias = existencias

    def generar(self, consulta: Consulta, dia: date) -> CuentaDeCobro:
        lineas = [
            LineaCuenta(
                id=prestado.id,
                origen="SERVICIO",
                tipo=TipoItemFactura.SERVICIO,
                descripcion=prestado.servicio.nombre,
                cantidad=prestado.cantidad,
                precio_unitario=prestado.servicio.precio,
            )
            for prestado in consulta.servicios_prestados
        ]
        for vacuna in consulta.vacunaciones:
            producto = vacuna.esquema.producto
            lineas.append(
                LineaCuenta(
                    id=vacuna.id,
                    origen="VACUNA",
                    tipo=TipoItemFactura.PRODUCTO,
                    descripcion=producto.nombre,
                    cantidad=1,
                    precio_unitario=producto.precio_venta,
                    producto_id=producto.id,
                    lote=vacuna.lote,
                )
            )
        for item in consulta.items_aplicados:
            # FEFO: si nadie eligió lote, se propone el vigente que vence primero.
            lote = item.lote or self.existencias.proponer_lote(item.producto_id, item.cantidad, dia)
            opciones = self.existencias.lotes_del_producto(item.producto_id)
            if lote is not None and lote not in opciones:
                opciones.append(lote)
            lineas.append(
                LineaCuenta(
                    id=item.id,
                    origen="PRESCRIPCION",
                    tipo=TipoItemFactura.PRODUCTO,
                    descripcion=item.producto.nombre,
                    cantidad=item.cantidad,
                    precio_unitario=item.producto.precio_venta,
                    producto_id=item.producto_id,
                    lote=lote,
                    item=item,
                    lotes=sorted(opciones, key=lambda opcion: opcion.fecha_vencimiento),
                )
            )
        return CuentaDeCobro(consulta, lineas)


class ServicioFacturacion:
    def __init__(self, facturas: RepositorioFactura, generador: GeneradorCuenta) -> None:
        self.facturas = facturas
        self.generador = generador

    def cuenta(self, consulta: Consulta, dia: date) -> CuentaDeCobro:
        return self.generador.generar(consulta, dia)

    def obtener(self, id_factura: uuid.UUID) -> Factura:
        factura = self.facturas.obtener(id_factura)
        if factura is None:
            raise ErrorDeNegocio("FACTURA_NO_ENCONTRADA", "La factura no existe.", 404)
        return factura

    def de_consulta(self, id_consulta: uuid.UUID) -> Factura | None:
        return self.facturas.de_consulta(id_consulta)

    @staticmethod
    def liquidar_pago(total: Decimal, pago: DatosPago) -> tuple[Decimal, Decimal]:
        """Devuelve el valor recibido y el cambio. Solo el efectivo puede dejar cambio."""
        if pago.medio != MedioPago.EFECTIVO:
            return total, Decimal(0)
        if pago.valor_recibido is None or pago.valor_recibido < total:
            raise ErrorDeNegocio(
                "PAGO_INSUFICIENTE",
                "El valor recibido no alcanza para cubrir el total.",
                422,
                {"total": float(total)},
            )
        return pago.valor_recibido, pago.valor_recibido - total

    def emitir(self, cuenta: CuentaDeCobro, pago: DatosPago) -> Factura:
        valor, cambio = self.liquidar_pago(cuenta.total, pago)
        factura = Factura(
            id=uuid.uuid4(),
            consulta_id=cuenta.consulta.id,
            total=cuenta.total,
            estado=EstadoFactura.EMITIDA,
            emitida_en=ahora(),
            detalles=[
                DetalleFactura(
                    descripcion=linea.descripcion,
                    tipo_item=linea.tipo,
                    lote_id=linea.lote.id if linea.lote else None,
                    cantidad=linea.cantidad,
                    precio_unitario=linea.precio_unitario,
                    subtotal=linea.subtotal,
                )
                for linea in cuenta.lineas
            ],
            pagos=[Pago(medio=pago.medio, valor=valor, cambio=cambio)],
        )
        self.facturas.agregar(factura)
        self.facturas.asignar_consecutivo(factura)
        return factura

    @staticmethod
    def anular(factura: Factura, motivo: str, usuario: Usuario) -> None:
        factura.estado = EstadoFactura.ANULADA
        factura.anulada_en = ahora()
        factura.anulada_por_id = usuario.id
        factura.motivo_anulacion = motivo.strip()


class FallaSimulada(RuntimeError):
    """Falla provocada con la tecla 4 para mostrar la reversa total (D3)."""


class CierreAtencionFacade:
    """Punto único para cerrar una atención en lo financiero (HU-MVP-03).

    Quien llama solo pide `facturar_atencion`; la fachada coordina la cuenta de cobro, el
    descuento de inventario, la factura y la auditoría dentro de una sola transacción. Si algo
    falla, no queda nada a medias (RNF-15).
    """

    def __init__(
        self,
        consultas: RepositorioConsulta,
        facturacion: ServicioFacturacion,
        inventario: DescuentoInventario,
        existencias: ConsultaExistencias,
        unidad_de_trabajo: UnidadDeTrabajo,
        auditoria: RegistroAuditoria,
    ) -> None:
        self.consultas = consultas
        self.facturacion = facturacion
        self.inventario = inventario
        self.existencias = existencias
        self.uow = unidad_de_trabajo
        self.auditoria = auditoria

    def cuenta_de_cobro(self, id_consulta: uuid.UUID) -> CuentaDeCobro:
        return self.facturacion.cuenta(self._consulta_cerrada(id_consulta), hoy())

    def ajustar_linea(
        self,
        id_consulta: uuid.UUID,
        id_linea: uuid.UUID,
        id_lote: uuid.UUID | None,
        cantidad: int | None,
        usuario: Usuario,
    ) -> CuentaDeCobro:
        """Cambio de lote o cantidad en la cuenta de cobro; las reglas pueden disparar D1 o D2."""
        consulta = self._consulta_sin_facturar(id_consulta)
        item = next((i for i in consulta.items_aplicados if i.id == id_linea), None)
        if item is None:
            raise ErrorDeNegocio(
                "LINEA_NO_EDITABLE", "Solo se ajustan los productos prescritos.", 422
            )
        dia = hoy()
        nueva_cantidad = cantidad or item.cantidad
        if id_lote:
            lote = self.existencias.obtener_lote(id_lote)
        else:
            lote = item.lote or self.existencias.proponer_lote(
                item.producto_id, nueva_cantidad, dia
            )
        if lote is None or lote.producto_id != item.producto_id:
            raise ErrorDeNegocio(
                "LOTE_NO_CORRESPONDE", "El lote no corresponde a ese producto.", 422
            )
        self.inventario.validar_dispensacion(lote, nueva_cantidad, dia)

        self.uow.iniciar()
        item.lote = lote
        item.cantidad = nueva_cantidad
        self.auditoria.registrar(
            usuario,
            "AJUSTAR_CUENTA",
            "consulta",
            consulta.id,
            {"producto": item.producto.nombre, "lote": lote.codigo, "cantidad": nueva_cantidad},
        )
        self.uow.confirmar()
        return self.facturacion.cuenta(consulta, dia)

    def facturar_atencion(
        self,
        id_consulta: uuid.UUID,
        usuario: Usuario,
        pago: DatosPago,
        simular_falla: bool = False,
    ) -> Factura:
        consulta = self._consulta_sin_facturar(id_consulta)
        dia = hoy()
        cuenta = self.facturacion.cuenta(consulta, dia)
        self.facturacion.liquidar_pago(cuenta.total, pago)

        self.uow.iniciar()
        try:
            for linea in cuenta.productos:
                if linea.lote is None:
                    raise ErrorDeNegocio(
                        "EXISTENCIA_INSUFICIENTE",
                        f"No hay existencias vigentes de {linea.descripcion}.",
                        409,
                        {
                            "producto": linea.descripcion,
                            "disponible": 0,
                            "solicitado": linea.cantidad,
                            "lote": None,
                        },
                    )
                # ReglaLoteVigente y ReglaExistenciaSuficiente se validan dentro del descuento.
                self.inventario.descontar(linea.lote.id, linea.cantidad, consulta.id, dia)
                if linea.item is not None:
                    linea.item.lote_id = linea.lote.id
            if simular_falla:
                raise FallaSimulada("Falla provocada para la demostración")
            factura = self.facturacion.emitir(cuenta, pago)
            self.auditoria.registrar(
                usuario,
                "FACTURAR_ATENCION",
                "factura",
                factura.id,
                {"numero": factura.numero, "total": str(factura.total)},
            )
            self.uow.confirmar()
            return factura
        except ErrorDeNegocio:
            self.uow.revertir()
            raise
        except Exception as error:
            self.uow.revertir()
            self._registrar_falla(usuario, id_consulta, error)
            raise ErrorDeNegocio(
                "FALLA_TRANSACCION",
                "No se pudo cerrar la facturación. Para proteger tus datos, la operación se "
                "canceló completa. No quedó nada a medias.",
                500,
                {
                    "historia_clinica": "sin cambios",
                    "inventario": "sin descuentos",
                    "factura": "no creada",
                },
            ) from error

    def anular_factura(self, id_factura: uuid.UUID, motivo: str, usuario: Usuario) -> Factura:
        """D4: anula la factura y devuelve al inventario lo que salió por esa atención."""
        factura = self.facturacion.obtener(id_factura)
        if factura.estado == EstadoFactura.ANULADA:
            raise ErrorDeNegocio("FACTURA_YA_ANULADA", "La factura ya estaba anulada.", 409)
        self.uow.iniciar()
        try:
            reversas = self.inventario.reversar_consulta(factura.consulta_id)
            self.facturacion.anular(factura, motivo, usuario)
            self.auditoria.registrar(
                usuario,
                "ANULAR_FACTURA",
                "factura",
                factura.id,
                {"numero": factura.numero, "motivo": motivo.strip(), "reversas": len(reversas)},
            )
            self.uow.confirmar()
        except Exception:
            self.uow.revertir()
            raise
        return factura

    def _consulta_cerrada(self, id_consulta: uuid.UUID) -> Consulta:
        consulta = self.consultas.obtener(id_consulta)
        if consulta is None:
            raise ErrorDeNegocio("CONSULTA_NO_ENCONTRADA", "La consulta no existe.", 404)
        if consulta.estado != EstadoConsulta.CERRADA:
            raise ErrorDeNegocio("CONSULTA_ABIERTA", "Cierra la atención antes de facturarla.", 409)
        return consulta

    def _consulta_sin_facturar(self, id_consulta: uuid.UUID) -> Consulta:
        consulta = self._consulta_cerrada(id_consulta)
        if self.facturacion.de_consulta(consulta.id) is not None:
            raise ErrorDeNegocio("FACTURA_YA_EMITIDA", "Esta atención ya tiene factura.", 409)
        return consulta

    def _registrar_falla(self, usuario: Usuario, id_consulta: uuid.UUID, error: Exception) -> None:
        """Deja rastro de la falla en una transacción aparte, ya revertida la principal."""
        try:
            self.uow.iniciar()
            self.auditoria.registrar(
                usuario,
                "FALLA_FACTURACION",
                "consulta",
                id_consulta,
                {"error": type(error).__name__},
            )
            self.uow.confirmar()
        except Exception:  # noqa: BLE001 - el rastro es de mejor esfuerzo; el error ya se reportó
            self.uow.revertir()
