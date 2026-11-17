from datetime import time
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Configuracion(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://clinica:clinica@localhost:5435/clinica"

    jwt_secreto: str = "solo-para-desarrollo-cambiar-en-produccion"
    jwt_algoritmo: str = "HS256"
    sesion_minutos: int = 30
    max_intentos_login: int = 5

    cors_origenes: str = "http://localhost:4200"
    url_frontend: str = "http://localhost:4200"
    zona_horaria: str = "America/Bogota"

    smtp_host: str = "localhost"
    smtp_puerto: int = 1025
    correo_remitente: str = "patitas@clinica.veterinaria.com"
    # En el despliegue el correo sale por la API HTTP de Mailpit en lugar de SMTP.
    correo_api_url: str = ""
    # Mismo formato que MP_UI_AUTH de Mailpit: "usuario:clave".
    correo_api_auth: str = ""

    carne_enlace_horas: int = 24
    dias_aviso_proxima_dosis: int = 7
    dias_aviso_cita: int = 1

    # Valores de demostración; la clínica puede ajustarlos por variables de entorno.
    agenda_hora_apertura: time = time(9, 0)
    agenda_hora_cierre: time = time(17, 0)
    agenda_intervalo_minutos: int = 30
    agenda_dias_atencion: str = "0,1,2,3,4"

    # Permite provocar a propósito las fallas de los flujos alternos (por ejemplo, D3).
    modo_demo: bool = True

    @field_validator("database_url")
    @classmethod
    def normalizar_url(cls, valor: str) -> str:
        # Los proveedores en la nube entregan postgres:// y SQLAlchemy necesita el driver.
        for prefijo in ("postgres://", "postgresql://"):
            if valor.startswith(prefijo):
                return "postgresql+psycopg://" + valor.removeprefix(prefijo)
        return valor

    @field_validator("url_frontend", "correo_api_url")
    @classmethod
    def completar_esquema(cls, valor: str) -> str:
        return valor if not valor or valor.startswith("http") else f"https://{valor}"

    @property
    def lista_cors(self) -> list[str]:
        # Render entrega solo el dominio del servicio; se completa con https://.
        origenes = [origen.strip() for origen in self.cors_origenes.split(",") if origen.strip()]
        return [origen if origen.startswith("http") else f"https://{origen}" for origen in origenes]

    @property
    def dias_agenda(self) -> frozenset[int]:
        return frozenset(
            int(dia.strip())
            for dia in self.agenda_dias_atencion.split(",")
            if dia.strip().isdigit() and 0 <= int(dia.strip()) <= 6
        )


@lru_cache
def obtener_configuracion() -> Configuracion:
    return Configuracion()
