from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import modelos  # noqa: F401  (registra todas las tablas)
from app.core.config import obtener_configuracion
from app.core.errores import ErrorDeNegocio, manejar_error_de_negocio
from app.core.seguridad import CABECERA_TOKEN_RENOVADO
from app.modulos.acceso.rutas import router as rutas_acceso

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

api = APIRouter(prefix="/api")


@api.get("/salud", tags=["Salud"])
def salud() -> dict[str, str]:
    return {"estado": "ok"}


api.include_router(rutas_acceso)

app.include_router(api)
