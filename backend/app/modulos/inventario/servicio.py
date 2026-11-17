import uuid
from abc import ABC, abstractmethod
from datetime import date

from app.core.errores import ErrorDeNegocio
from app.modulos.inventario.modelos import Lote, MovimientoInventario, TipoMovimiento
from app.modulos.inventario.repositorio import RepositorioLote


def describir_lote(lote: Lote | None) -> dict | None:
    if lote is None:
        return None
    return {
        "id": str(lote.id),
        "codigo": lote.codigo,
        "fecha_vencimiento": lote.fecha_vencimiento.isoformat(),
        "disponible": lote.cantidad_disponible,
    }


class ConsultaExistencias(ABC):
    """Lectura del inventario: qué lotes hay y cuál conviene usar."""

    @abstractmethod
    def obtener_lote(self, id_lote: uuid.UUID) -> Lote: ...

    @abstractmethod
    def proponer_lote(self, id_producto: uuid.UUID, cantidad: int, hoy: date) -> Lote | None: ...

    @abstractmethod
    def lotes_del_producto(self, id_producto: uuid.UUID) -> list[Lote]: ...

    @abstractmethod
    def lotes_vigentes(self, id_producto: uuid.UUID, hoy: date) -> list[Lote]: ...

    @abstractmethod
    def existencia_disponible(self, id_producto: uuid.UUID, hoy: date) -> int: ...


class DescuentoInventario(ABC):
    """Escritura del inventario que hace el cierre de la atención."""

    @abstractmethod
    def validar_dispensacion(self, lote: Lote, cantidad: int, hoy: date) -> None: ...

    @abstractmethod
    def descontar(
        self, id_lote: uuid.UUID, cantidad: int, id_consulta: uuid.UUID, hoy: date
    ) -> MovimientoInventario: ...

    @abstractmethod
    def reversar_consulta(self, id_consulta: uuid.UUID) -> list[MovimientoInventario]: ...


class ReglaDispensacion(ABC):
    @abstractmethod
    def validar(self, lote: Lote, cantidad: int, hoy: date) -> None: ...


class ReglaLoteVigente(ReglaDispensacion):
    """RN-04: un lote vencido no se dispensa ni se factura (D1)."""

    def __init__(self, existencias: ConsultaExistencias) -> None:
        self.existencias = existencias

    def validar(self, lote: Lote, cantidad: int, hoy: date) -> None:
        if not lote.esta_vencido(hoy):
            return
        sugerido = self.existencias.proponer_lote(lote.producto_id, cantidad, hoy)
        raise ErrorDeNegocio(
            "LOTE_VENCIDO",
            f"El lote {lote.codigo} de {lote.producto.nombre} venció el "
            f"{lote.fecha_vencimiento:%d/%m/%Y} y no puede dispensarse ni facturarse. "
            "Usa el lote vigente con vencimiento más próximo.",
            409,
            {
                "producto": lote.producto.nombre,
                "lote": lote.codigo,
                "lote_id": str(lote.id),
                "fecha_vencimiento": lote.fecha_vencimiento.isoformat(),
                "cantidad": cantidad,
                "lote_sugerido": describir_lote(sugerido),
            },
        )


class ReglaExistenciaSuficiente(ReglaDispensacion):
    """RN-06: no se descuenta más de lo que queda en el lote (D2)."""

    def validar(self, lote: Lote, cantidad: int, hoy: date) -> None:
        if cantidad <= lote.cantidad_disponible:
            return
        raise ErrorDeNegocio(
            "EXISTENCIA_INSUFICIENTE",
            f"Solo hay {lote.cantidad_disponible} unidades disponibles de "
            f"{lote.producto.nombre} y la atención usó {cantidad}. "
            "No se puede facturar más de lo que hay en inventario.",
            409,
            {
                "producto": lote.producto.nombre,
                "lote": lote.codigo,
                "lote_id": str(lote.id),
                "fecha_vencimiento": lote.fecha_vencimiento.isoformat(),
                "disponible": lote.cantidad_disponible,
                "solicitado": cantidad,
            },
        )


class ServicioInventario(ConsultaExistencias, DescuentoInventario):
    def __init__(
        self, lotes: RepositorioLote, reglas: list[ReglaDispensacion] | None = None
    ) -> None:
        self.lotes = lotes
        self.reglas = reglas or [ReglaLoteVigente(self), ReglaExistenciaSuficiente()]

    # --- ConsultaExistencias ---

    def obtener_lote(self, id_lote: uuid.UUID) -> Lote:
        return self._lote(id_lote)

    def proponer_lote(self, id_producto: uuid.UUID, cantidad: int, hoy: date) -> Lote | None:
        """FEFO: el lote vigente que vence primero y alcanza; si ninguno alcanza, el primero."""
        vigentes = self.lotes.lotes_vigentes(id_producto, hoy)
        for lote in vigentes:
            if lote.cantidad_disponible >= cantidad:
                return lote
        return vigentes[0] if vigentes else None

    def lotes_del_producto(self, id_producto: uuid.UUID) -> list[Lote]:
        return self.lotes.lotes_del_producto(id_producto)

    def lotes_vigentes(self, id_producto: uuid.UUID, hoy: date) -> list[Lote]:
        return self.lotes.lotes_vigentes(id_producto, hoy)

    def existencia_disponible(self, id_producto: uuid.UUID, hoy: date) -> int:
        return sum(lote.cantidad_disponible for lote in self.lotes_vigentes(id_producto, hoy))

    # --- DescuentoInventario ---

    def validar_dispensacion(self, lote: Lote, cantidad: int, hoy: date) -> None:
        for regla in self.reglas:
            regla.validar(lote, cantidad, hoy)

    def descontar(
        self, id_lote: uuid.UUID, cantidad: int, id_consulta: uuid.UUID, hoy: date
    ) -> MovimientoInventario:
        lote = self._lote(id_lote, bloquear=True)
        self.validar_dispensacion(lote, cantidad, hoy)
        lote.cantidad_disponible -= cantidad
        movimiento = MovimientoInventario(
            lote=lote,
            lote_id=lote.id,
            consulta_id=id_consulta,
            tipo=TipoMovimiento.SALIDA_USO,
            cantidad=cantidad,
            saldo_resultante=lote.cantidad_disponible,
        )
        self.lotes.agregar_movimiento(movimiento)
        return movimiento

    def reversar_consulta(self, id_consulta: uuid.UUID) -> list[MovimientoInventario]:
        """Devuelve al inventario lo que salió por una atención cuya factura se anula (D4)."""
        reversas = []
        for salida in self.lotes.salidas_de_consulta(id_consulta):
            lote = self._lote(salida.lote_id, bloquear=True)
            lote.cantidad_disponible += salida.cantidad
            reversa = MovimientoInventario(
                lote=lote,
                lote_id=lote.id,
                consulta_id=id_consulta,
                tipo=TipoMovimiento.REVERSA,
                cantidad=salida.cantidad,
                saldo_resultante=lote.cantidad_disponible,
            )
            self.lotes.agregar_movimiento(reversa)
            reversas.append(reversa)
        return reversas

    # --- Entradas ---

    def registrar_entrada(self, id_lote: uuid.UUID, cantidad: int) -> MovimientoInventario:
        if cantidad <= 0:
            raise ErrorDeNegocio("CANTIDAD_INVALIDA", "La cantidad debe ser mayor que cero.")
        lote = self._lote(id_lote, bloquear=True)
        lote.cantidad_disponible += cantidad
        movimiento = MovimientoInventario(
            lote=lote,
            lote_id=lote.id,
            tipo=TipoMovimiento.ENTRADA,
            cantidad=cantidad,
            saldo_resultante=lote.cantidad_disponible,
        )
        self.lotes.agregar_movimiento(movimiento)
        return movimiento

    def _lote(self, id_lote: uuid.UUID, bloquear: bool = False) -> Lote:
        lote = self.lotes.obtener(id_lote, bloquear=bloquear)
        if lote is None:
            raise ErrorDeNegocio("LOTE_NO_ENCONTRADO", "El lote no existe.", 404)
        return lote
