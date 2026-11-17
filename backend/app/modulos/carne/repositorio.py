import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modulos.atencion.modelos import Consulta, Vacunacion
from app.modulos.pacientes.modelos import Mascota, Propietario


class RepositorioCarne:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def propietario_de(self, usuario_id: uuid.UUID) -> Propietario | None:
        return self.sesion.scalar(
            select(Propietario)
            .where(Propietario.usuario_id == usuario_id)
            .options(selectinload(Propietario.preferencia))
        )

    def mascota(self, mascota_id: uuid.UUID) -> Mascota | None:
        return self.sesion.scalar(
            select(Mascota)
            .where(Mascota.id == mascota_id)
            .options(
                selectinload(Mascota.alergias),
                selectinload(Mascota.propietario),
            )
        )

    def vacunas_de(self, mascota_id: uuid.UUID) -> list[Vacunacion]:
        return list(
            self.sesion.scalars(
                select(Vacunacion)
                .join(Vacunacion.consulta)
                .where(Consulta.mascota_id == mascota_id)
                .options(selectinload(Vacunacion.esquema))
                .order_by(Vacunacion.fecha_aplicacion.desc())
            )
        )
