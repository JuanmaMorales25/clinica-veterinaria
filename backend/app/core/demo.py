"""Fallas que se provocan a propósito en la sustentación (teclas 1 a 5 del Figma).

Solo responden con MODO_DEMO=true; en cualquier otro caso devuelven 404.
"""

from datetime import timedelta

import jwt
from fastapi import APIRouter, Depends

from app.core.config import obtener_configuracion
from app.core.db import ahora
from app.core.errores import ErrorDeNegocio
from app.core.seguridad import obtener_usuario_actual
from app.modulos.acceso.modelos import Usuario


def requiere_modo_demo() -> None:
    if not obtener_configuracion().modo_demo:
        raise ErrorDeNegocio("NO_DISPONIBLE", "Esta función no está disponible.", 404)


router = APIRouter(
    prefix="/demo", tags=["Demostración"], dependencies=[Depends(requiere_modo_demo)]
)


@router.post("/sesion-expirada")
def expirar_sesion(_: Usuario = Depends(obtener_usuario_actual)) -> None:
    """Tecla 2: provoca A4 sin esperar los 30 minutos de inactividad."""
    raise ErrorDeNegocio("SESION_EXPIRADA", "Tu sesión se cerró por inactividad.", 401)


@router.get("/carne-vencido")
def crear_enlace_vencido_demo() -> dict[str, str]:
    """Tecla 5: genera un enlace firmado cuya vigencia ya terminó (E1)."""
    configuracion = obtener_configuracion()
    token = jwt.encode(
        {
            "sub": "00000000-0000-0000-0000-000000000000",
            "uso": "carne_publico",
            "exp": ahora() - timedelta(seconds=1),
        },
        configuracion.jwt_secreto,
        algorithm=configuracion.jwt_algoritmo,
    )
    return {"token": token}
