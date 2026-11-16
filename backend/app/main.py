from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import modelos  # noqa: F401  (registra todas las tablas)
from app.core.config import obtener_configuracion
from app.core.demo import router as rutas_demo
from app.core.errores import ErrorDeNegocio, manejar_error_de_negocio
from app.core.seguridad import CABECERA_TOKEN_RENOVADO
from app.modulos.acceso.rutas import router as rutas_acceso
from app.modulos.atencion.rutas import router as rutas_atencion
from app.modulos.facturacion.rutas import router as rutas_facturacion
from app.modulos.inventario.rutas import router as rutas_inventario

configuracion = obtener_configuracion()

app = FastAPI(
    title="API Clínica Veterinaria",
    description="Monolito modular: agenda, atención clínica, inventario, facturación y carné.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=configuracion.lista_cors,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[CABECERA_TOKEN_RENOVADO],
)
app.add_exception_handler(ErrorDeNegocio, manejar_error_de_negocio)


@app.exception_handler(RequestValidationError)
async def manejar_datos_invalidos(_: Request, error: RequestValidationError) -> JSONResponse:
    # Misma forma que los errores de negocio, para que el frontend los lea igual.
    campos = [".".join(str(parte) for parte in e["loc"][1:]) for e in error.errors()]
    return JSONResponse(
        status_code=422,
        content={
            "codigo": "DATOS_INVALIDOS",
            "mensaje": "Revisa los datos ingresados.",
            "detalle": {"campos": campos},
        },
    )


api = APIRouter(prefix="/api")


@api.get("/salud", tags=["Salud"])
def salud() -> dict[str, str | bool]:
    return {"estado": "ok", "modo_demo": configuracion.modo_demo}


api.include_router(rutas_acceso)
api.include_router(rutas_atencion)
api.include_router(rutas_facturacion)
api.include_router(rutas_inventario)
api.include_router(rutas_demo)

app.include_router(api)
