import uuid
from abc import ABC, abstractmethod
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import obtener_configuracion
from app.modulos.agenda.modelos import Cita, EstadoCita, Servicio
from app.modulos.atencion.modelos import (
    Consulta,
    EsquemaVacunacion,
    EstadoConsulta,
    ItemAplicado,
    Vacunacion,
)
from app.modulos.facturacion.modelos import Factura
from app.modulos.inventario.modelos import Producto, TipoProducto


class RepositorioConsulta(ABC):
    @abstractmethod
    def obtener(self, id_consulta: uuid.UUID) -> Consulta | None: ...

    @abstractmethod
    def agregar(self, consulta: Consulta) -> None: ...

    @abstractmethod
    def abierta_de_mascota(self, id_mascota: uuid.UUID) -> Consulta | None: ...

    @abstractmethod
    def historial_de_mascota(self, id_mascota: uuid.UUID) -> list[Consulta]: ...

    @abstractmethod
    def vacunaciones_de_mascota(self, id_mascota: uuid.UUID) -> list[Vacunacion]:
        """De la más reciente a la más antigua."""

    @abstractmethod
    def esquemas_de_especie(self, especie: str) -> list[EsquemaVacunacion]: ...

    @abstractmethod
    def obtener_esquema(self, id_esquema: uuid.UUID) -> EsquemaVacunacion | None: ...

    @abstractmethod
    def obtener_item(self, id_item: uuid.UUID) -> ItemAplicado | None: ...

    @abstractmethod
    def eliminar_item(self, item: ItemAplicado) -> None: ...

    @abstractmethod
    def eliminar_vacunacion(self, vacunacion: Vacunacion) -> None: ...

    @abstractmethod
    def medicamentos(self) -> list[Producto]: ...

    @abstractmethod
    def obtener_producto(self, id_producto: uuid.UUID) -> Producto | None: ...

    @abstractmethod
    def servicio_por_nombre(self, nombre: str) -> Servicio | None: ...

    @abstractmethod
    def cita_de_hoy(self, id_mascota: uuid.UUID, hoy: date) -> Cita | None: ...

    @abstractmethod
    def factura_de_consulta(self, id_consulta: uuid.UUID) -> Factura | None: ...


class RepositorioConsultaSQLAlchemy(RepositorioConsulta):
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def obtener(self, id_consulta: uuid.UUID) -> Consulta | None:
        return self.sesion.scalar(
            select(Consulta)
            .where(Consulta.id == id_consulta)
            .options(
                selectinload(Consulta.items_aplicados).selectinload(ItemAplicado.producto),
                selectinload(Consulta.vacunaciones).selectinload(Vacunacion.esquema),
                selectinload(Consulta.vacunaciones).selectinload(Vacunacion.lote),
                selectinload(Consulta.servicios_prestados),
                selectinload(Consulta.notas),
            )
        )

    def agregar(self, consulta: Consulta) -> None:
        self.sesion.add(consulta)

    def abierta_de_mascota(self, id_mascota: uuid.UUID) -> Consulta | None:
        return self.sesion.scalar(
            select(Consulta)
            .where(Consulta.mascota_id == id_mascota, Consulta.estado == EstadoConsulta.ABIERTA)
            .order_by(Consulta.fecha.desc())
            .limit(1)
        )

    def historial_de_mascota(self, id_mascota: uuid.UUID) -> list[Consulta]:
        return list(
            self.sesion.scalars(
                select(Consulta)
                .where(Consulta.mascota_id == id_mascota)
                .options(selectinload(Consulta.veterinario))
                .order_by(Consulta.fecha.desc())
            )
        )

    def vacunaciones_de_mascota(self, id_mascota: uuid.UUID) -> list[Vacunacion]:
        return list(
            self.sesion.scalars(
                select(Vacunacion)
                .join(Vacunacion.consulta)
                .where(Consulta.mascota_id == id_mascota)
                .options(selectinload(Vacunacion.esquema))
                .order_by(Vacunacion.fecha_aplicacion.desc())
            )
        )

    def esquemas_de_especie(self, especie: str) -> list[EsquemaVacunacion]:
        return list(
            self.sesion.scalars(
                select(EsquemaVacunacion)
                .where(EsquemaVacunacion.especie.ilike(especie))
                .options(selectinload(EsquemaVacunacion.producto))
                .order_by(EsquemaVacunacion.biologico)
            )
        )

    def obtener_esquema(self, id_esquema: uuid.UUID) -> EsquemaVacunacion | None:
        return self.sesion.get(EsquemaVacunacion, id_esquema)

    def obtener_item(self, id_item: uuid.UUID) -> ItemAplicado | None:
        return self.sesion.get(ItemAplicado, id_item)

    def eliminar_item(self, item: ItemAplicado) -> None:
        self.sesion.delete(item)

    def eliminar_vacunacion(self, vacunacion: Vacunacion) -> None:
        self.sesion.delete(vacunacion)

    def medicamentos(self) -> list[Producto]:
        return list(
            self.sesion.scalars(
                select(Producto)
                .where(Producto.tipo.in_([TipoProducto.MEDICAMENTO, TipoProducto.INSUMO]))
                .order_by(Producto.nombre)
            )
        )

    def obtener_producto(self, id_producto: uuid.UUID) -> Producto | None:
        return self.sesion.get(Producto, id_producto)

    def servicio_por_nombre(self, nombre: str) -> Servicio | None:
        return self.sesion.scalar(select(Servicio).where(Servicio.nombre == nombre))

    def cita_de_hoy(self, id_mascota: uuid.UUID, hoy: date) -> Cita | None:
        zona = ZoneInfo(obtener_configuracion().zona_horaria)
        inicio = datetime.combine(hoy, time.min, tzinfo=zona)
        fin = datetime.combine(hoy, time.max, tzinfo=zona)
        return self.sesion.scalar(
            select(Cita)
            .where(
                Cita.mascota_id == id_mascota,
                Cita.fecha_hora.between(inicio, fin),
                Cita.estado == EstadoCita.CONFIRMADA,
            )
            .order_by(Cita.fecha_hora)
            .limit(1)
        )

    def factura_de_consulta(self, id_consulta: uuid.UUID) -> Factura | None:
        return self.sesion.scalar(select(Factura).where(Factura.consulta_id == id_consulta))
