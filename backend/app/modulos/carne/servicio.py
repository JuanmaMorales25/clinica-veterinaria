import uuid
from datetime import timedelta
from typing import NoReturn

import jwt
from sqlalchemy.orm import Session

from app.core.config import obtener_configuracion
from app.core.db import ahora
from app.core.errores import ErrorDeNegocio
from app.modulos.acceso.modelos import Usuario
from app.modulos.carne.esquemas import (
    AlergiaCarnet,
    CarnetMascotaSalida,
    EnlaceCarneSalida,
    VacunaCarnet,
)
from app.modulos.carne.repositorio import RepositorioCarne
from app.modulos.pacientes.modelos import Mascota, Propietario


class ServicioCarne:
    def __init__(self, sesion: Session, repositorio: RepositorioCarne | None = None) -> None:
        self.sesion = sesion
        self.repositorio = repositorio or RepositorioCarne(sesion)

    def obtener_privado(self, mascota_id: uuid.UUID, usuario: Usuario) -> CarnetMascotaSalida:
        propietario = self._propietario(usuario.id)
        mascota = self._mascota(mascota_id)
        if mascota.propietario_id != propietario.id:
            raise ErrorDeNegocio("CARNET_NO_ENCONTRADO", "No encontramos ese carné.", 404)
        return self._crear_salida(mascota)

    def crear_enlace(self, mascota_id: uuid.UUID, usuario: Usuario) -> EnlaceCarneSalida:
        self.obtener_privado(mascota_id, usuario)
        configuracion = obtener_configuracion()
        token = jwt.encode(
            {
                "sub": str(mascota_id),
                "uso": "carne_publico",
                "exp": ahora() + timedelta(hours=configuracion.carne_enlace_horas),
            },
            configuracion.jwt_secreto,
            algorithm=configuracion.jwt_algoritmo,
        )
        enlace = f"{configuracion.url_frontend.rstrip('/')}/carne/{token}"
        return EnlaceCarneSalida(enlace=enlace)

    def obtener_publico(self, token: str) -> CarnetMascotaSalida:
        configuracion = obtener_configuracion()
        try:
            contenido = jwt.decode(
                token,
                configuracion.jwt_secreto,
                algorithms=[configuracion.jwt_algoritmo],
            )
        except jwt.ExpiredSignatureError as error:
            raise ErrorDeNegocio(
                "ENLACE_VENCIDO",
                "El enlace del carné venció. Solicita uno nuevo al propietario.",
                410,
            ) from error
        except jwt.InvalidTokenError as error:
            raise ErrorDeNegocio(
                "ENLACE_INVALIDO", "El enlace del carné no es válido.", 404
            ) from error

        if contenido.get("uso") != "carne_publico":
            self._enlace_invalido()
        try:
            mascota_id = uuid.UUID(contenido["sub"])
        except (KeyError, ValueError) as error:
            raise ErrorDeNegocio(
                "ENLACE_INVALIDO", "El enlace del carné no es válido.", 404
            ) from error
        mascota = self.repositorio.mascota(mascota_id)
        if mascota is None:
            self._enlace_invalido()
        return self._crear_salida(mascota)

    def _propietario(self, usuario_id: uuid.UUID) -> Propietario:
        propietario = self.repositorio.propietario_de(usuario_id)
        if propietario is None:
            raise ErrorDeNegocio(
                "PROPIETARIO_NO_ENCONTRADO", "No encontramos tu ficha de propietario.", 404
            )
        return propietario

    def _mascota(self, mascota_id: uuid.UUID) -> Mascota:
        mascota = self.repositorio.mascota(mascota_id)
        if mascota is None:
            raise ErrorDeNegocio("CARNET_NO_ENCONTRADO", "No encontramos ese carné.", 404)
        return mascota

    def _crear_salida(self, mascota: Mascota) -> CarnetMascotaSalida:
        vacunas = self.repositorio.vacunas_de(mascota.id)
        hoy = ahora().date()
        historial = [
            VacunaCarnet(
                biologico=vacuna.esquema.biologico,
                fecha_aplicacion=vacuna.fecha_aplicacion,
                fecha_proxima_dosis=vacuna.fecha_proxima_dosis,
            )
            for vacuna in vacunas
        ]
        proximas = [
            vacuna
            for vacuna in historial
            if vacuna.fecha_proxima_dosis is not None and vacuna.fecha_proxima_dosis >= hoy
        ]
        return CarnetMascotaSalida(
            id=mascota.id,
            nombre=mascota.nombre,
            especie=mascota.especie,
            raza=mascota.raza,
            edad=mascota.describir_edad(hoy),
            numero_historia=mascota.numero_historia,
            alergias=[
                AlergiaCarnet(descripcion=alergia.descripcion, severidad=alergia.severidad)
                for alergia in mascota.alergias
            ],
            vacunas=historial,
            proximas_dosis=proximas,
        )

    @staticmethod
    def _enlace_invalido() -> NoReturn:
        raise ErrorDeNegocio("ENLACE_INVALIDO", "El enlace del carné no es válido.", 404)
