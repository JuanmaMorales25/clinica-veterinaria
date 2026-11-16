from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


class ErrorDeNegocio(Exception):
    """Regla de negocio incumplida. El frontend decide qué flujo alterno mostrar según el código."""

    def __init__(
        self,
        codigo: str,
        mensaje: str,
        estado_http: int = 422,
        detalle: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(mensaje)
        self.codigo = codigo
        self.mensaje = mensaje
        self.estado_http = estado_http
        self.detalle = detalle or {}


async def manejar_error_de_negocio(_: Request, error: ErrorDeNegocio) -> JSONResponse:
    return JSONResponse(
        status_code=error.estado_http,
        content={"codigo": error.codigo, "mensaje": error.mensaje, "detalle": error.detalle},
    )
