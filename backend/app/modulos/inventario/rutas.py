import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import obtener_sesion
from app.core.seguridad import requiere_rol
from app.modulos.acceso.modelos import ROLES_PERSONAL, Usuario
from app.modulos.auditoria.servicio import RegistroAuditoriaBD
from app.modulos.facturacion.esquemas import SolicitudEntrada
from app.modulos.inventario.repositorio import RepositorioLoteSQLAlchemy
from app.modulos.inventario.servicio import ServicioInventario

router = APIRouter(prefix="/inventario", tags=["Inventario"])

personal = requiere_rol(*ROLES_PERSONAL)


class SaldoLote(BaseModel):
    lote_id: uuid.UUID
    codigo: str
    disponible: int


@router.post("/lotes/{id_lote}/entradas", response_model=SaldoLote)
def registrar_entrada(
    id_lote: uuid.UUID,
    datos: SolicitudEntrada,
    usuario: Usuario = Depends(personal),
    sesion: Session = Depends(obtener_sesion),
):
    """Ingreso de unidades a un lote (botón de D2 "Registrar entrada de inventario")."""
    movimiento = ServicioInventario(RepositorioLoteSQLAlchemy(sesion)).registrar_entrada(
        id_lote, datos.cantidad
    )
    lote = movimiento.lote
    RegistroAuditoriaBD(sesion).registrar(
        usuario, "ENTRADA_INVENTARIO", "lote", lote.id, {"cantidad": datos.cantidad}
    )
    sesion.commit()
    return SaldoLote(lote_id=lote.id, codigo=lote.codigo, disponible=lote.cantidad_disponible)
