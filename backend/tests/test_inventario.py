"""Reglas de dispensación RN-04 y RN-06, y selección FEFO del lote."""

import uuid
from datetime import date

import pytest

from app.core.errores import ErrorDeNegocio
from app.modulos.inventario.modelos import Lote, MovimientoInventario, Producto, TipoMovimiento
from app.modulos.inventario.repositorio import RepositorioLote
from app.modulos.inventario.servicio import (
    ReglaExistenciaSuficiente,
    ReglaLoteVigente,
    ServicioInventario,
)

HOY = date(2026, 11, 16)
OMEPRAZOL = Producto(id=uuid.uuid4(), nombre="Omeprazol 10 mg")


def lote(codigo: str, cantidad: int, vence: date) -> Lote:
    return Lote(
        id=uuid.uuid4(),
        codigo=codigo,
        producto=OMEPRAZOL,
        producto_id=OMEPRAZOL.id,
        cantidad_disponible=cantidad,
        fecha_vencimiento=vence,
    )


class RepositorioEnMemoria(RepositorioLote):
    def __init__(self, *lotes: Lote) -> None:
        self.lotes = {l.id: l for l in lotes}
        self.movimientos: list[MovimientoInventario] = []

    def obtener(self, id_lote, bloquear=False):
        return self.lotes.get(id_lote)

    def lotes_del_producto(self, id_producto):
        return sorted(
            (l for l in self.lotes.values() if l.cantidad_disponible > 0),
            key=lambda l: l.fecha_vencimiento,
        )

    def lotes_vigentes(self, id_producto, hoy):
        return [l for l in self.lotes_del_producto(id_producto) if l.fecha_vencimiento >= hoy]

    def agregar_movimiento(self, movimiento):
        self.movimientos.append(movimiento)

    def salidas_de_consulta(self, id_consulta):
        return [
            m
            for m in self.movimientos
            if m.consulta_id == id_consulta and m.tipo == TipoMovimiento.SALIDA_USO
        ]

    def obtener_producto(self, id_producto):
        return OMEPRAZOL


VENCIDO = lote("L-1987", 2, date(2026, 10, 5))
VIGENTE = lote("L-2481", 3, date(2027, 3, 12))


def inventario(*lotes: Lote) -> ServicioInventario:
    copias = [lote(l.codigo, l.cantidad_disponible, l.fecha_vencimiento) for l in lotes]
    return ServicioInventario(RepositorioEnMemoria(*copias))


def test_fefo_ignora_vencidos_y_elige_el_que_vence_primero():
    servicio = inventario(VENCIDO, VIGENTE, lote("L-3000", 10, date(2027, 9, 1)))
    assert servicio.proponer_lote(OMEPRAZOL.id, 2, HOY).codigo == "L-2481"


def test_fefo_salta_al_siguiente_lote_si_no_alcanza():
    servicio = inventario(VIGENTE, lote("L-3000", 10, date(2027, 9, 1)))
    assert servicio.proponer_lote(OMEPRAZOL.id, 5, HOY).codigo == "L-3000"


def test_d1_lote_vencido_sugiere_el_vigente():
    servicio = inventario(VIGENTE)
    with pytest.raises(ErrorDeNegocio) as error:
        ReglaLoteVigente(servicio).validar(VENCIDO, 2, HOY)
    assert error.value.codigo == "LOTE_VENCIDO"
    assert error.value.detalle["lote"] == "L-1987"
    assert error.value.detalle["lote_sugerido"]["codigo"] == "L-2481"


def test_d2_existencia_insuficiente_informa_disponible_y_solicitado():
    with pytest.raises(ErrorDeNegocio) as error:
        ReglaExistenciaSuficiente().validar(VIGENTE, 5, HOY)
    assert error.value.codigo == "EXISTENCIA_INSUFICIENTE"
    assert (error.value.detalle["disponible"], error.value.detalle["solicitado"]) == (3, 5)


def test_descontar_y_reversar_dejan_el_saldo_igual():
    servicio = inventario(VIGENTE)
    id_lote = next(iter(servicio.lotes.lotes))
    id_consulta = uuid.uuid4()
    salida = servicio.descontar(id_lote, 2, id_consulta, HOY)
    assert salida.saldo_resultante == 1
    [reversa] = servicio.reversar_consulta(id_consulta)
    assert reversa.tipo == TipoMovimiento.REVERSA
    assert reversa.saldo_resultante == 3


def test_descontar_valida_las_reglas_antes_de_tocar_el_saldo():
    servicio = inventario(VENCIDO)
    id_lote = next(iter(servicio.lotes.lotes))
    with pytest.raises(ErrorDeNegocio):
        servicio.descontar(id_lote, 1, uuid.uuid4(), HOY)
    assert servicio.lotes.lotes[id_lote].cantidad_disponible == 2
    assert servicio.lotes.movimientos == []
