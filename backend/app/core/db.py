import enum
import uuid
from collections.abc import Iterator
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import DateTime, Enum, MetaData, create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.core.config import obtener_configuracion

CONVENCION_NOMBRES = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=CONVENCION_NOMBRES)


class ConId:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


class ConFechaCreacion:
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


def tipo_enum(clase: type[enum.Enum]) -> Enum:
    """Guarda el enumerado como texto, sin crear tipos propios en PostgreSQL."""
    return Enum(
        clase,
        native_enum=False,
        length=30,
        values_callable=lambda miembros: [miembro.value for miembro in miembros],
    )


def ahora() -> datetime:
    return datetime.now(ZoneInfo(obtener_configuracion().zona_horaria))


motor = create_engine(obtener_configuracion().database_url, pool_pre_ping=True)
SesionLocal = sessionmaker(bind=motor, autoflush=False, expire_on_commit=False)


def obtener_sesion() -> Iterator[Session]:
    with SesionLocal() as sesion:
        yield sesion
