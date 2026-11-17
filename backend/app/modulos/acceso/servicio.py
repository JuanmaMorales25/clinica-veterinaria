import hashlib
import hmac
import logging
import uuid
from datetime import timedelta
from typing import NoReturn

import jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import obtener_configuracion
from app.core.db import ahora
from app.core.errores import ErrorDeNegocio
from app.core.seguridad import cifrar_contrasena, crear_token, verificar_contrasena
from app.modulos.acceso.esquemas import (
    RespuestaLogin,
    SolicitudLogin,
    SolicitudRecuperacion,
    SolicitudRegistro,
    SolicitudRestablecer,
    UsuarioSalida,
)
from app.modulos.acceso.modelos import Rol, Usuario
from app.modulos.acceso.repositorio import RepositorioUsuario
from app.modulos.pacientes.modelos import PreferenciaNotificacion, Propietario

logger = logging.getLogger(__name__)


class ServicioAcceso:
    def __init__(self, sesion: Session, repositorio: RepositorioUsuario | None = None) -> None:
        self.sesion = sesion
        self.repositorio = repositorio or RepositorioUsuario(sesion)

    def iniciar_sesion(self, datos: SolicitudLogin) -> RespuestaLogin:
        configuracion = obtener_configuracion()
        correo = str(datos.correo).lower()
        usuario = self.repositorio.por_correo(correo, bloquear=True)

        if usuario is None:
            self._credenciales_incorrectas(configuracion.max_intentos_login - 1)
        if not usuario.estado:
            raise ErrorDeNegocio("CUENTA_BLOQUEADA", "La cuenta está bloqueada.", 423)
        if not verificar_contrasena(datos.contrasena, usuario.contrasena_hash):
            usuario.intentos_fallidos += 1
            restantes = max(configuracion.max_intentos_login - usuario.intentos_fallidos, 0)
            if usuario.intentos_fallidos >= configuracion.max_intentos_login:
                usuario.estado = False
                self.sesion.commit()
                raise ErrorDeNegocio("CUENTA_BLOQUEADA", "La cuenta está bloqueada.", 423)
            self.sesion.commit()
            self._credenciales_incorrectas(restantes)

        usuario.intentos_fallidos = 0
        self.sesion.commit()
        return RespuestaLogin(
            token=crear_token(usuario), usuario=UsuarioSalida.model_validate(usuario)
        )

    def registrar(self, datos: SolicitudRegistro) -> RespuestaLogin:
        correo = str(datos.correo).lower()
        if not datos.autorizacion_datos:
            raise ErrorDeNegocio(
                "AUTORIZACION_REQUERIDA",
                "Autoriza el uso de tus datos para crear la cuenta.",
                422,
            )
        if self.repositorio.por_correo(correo):
            raise ErrorDeNegocio("CORREO_REGISTRADO", "Ya existe una cuenta con ese correo.", 409)

        propietario = self.repositorio.propietario_por_documento(datos.documento_identidad)
        if propietario is not None:
            correo_coincide = propietario.correo.lower() == correo
            telefono_coincide = _solo_digitos(propietario.telefono) == _solo_digitos(datos.telefono)
            if not correo_coincide or not telefono_coincide:
                raise ErrorDeNegocio(
                    "DATOS_PROPIETARIO_NO_COINCIDEN",
                    "Los datos no coinciden con el registro de la clínica.",
                    409,
                )
            if propietario.usuario_id is not None:
                raise ErrorDeNegocio(
                    "PROPIETARIO_YA_VINCULADO", "El propietario ya tiene una cuenta.", 409
                )
            propietario.autorizacion_datos = True
            if propietario.preferencia is None:
                propietario.preferencia = PreferenciaNotificacion()
        else:
            propietario = Propietario(
                documento_identidad=datos.documento_identidad,
                nombre=datos.nombre.strip(),
                telefono=datos.telefono.strip(),
                correo=correo,
                autorizacion_datos=True,
                preferencia=PreferenciaNotificacion(),
            )
            self.sesion.add(propietario)

        usuario = Usuario(
            nombre=datos.nombre.strip(),
            correo_electronico=correo,
            contrasena_hash=cifrar_contrasena(datos.contrasena),
            rol=Rol.PROPIETARIO,
        )
        propietario.usuario = usuario
        self.repositorio.agregar(usuario)
        try:
            self.sesion.commit()
        except IntegrityError as error:
            self.sesion.rollback()
            raise ErrorDeNegocio(
                "DATOS_REGISTRO_DUPLICADOS",
                "No fue posible crear la cuenta con esos datos.",
                409,
            ) from error

        return RespuestaLogin(
            token=crear_token(usuario), usuario=UsuarioSalida.model_validate(usuario)
        )

    def solicitar_recuperacion(self, datos: SolicitudRecuperacion) -> None:
        correo = str(datos.correo).lower()
        usuario = self.repositorio.por_correo(correo)
        if usuario is None:
            return

        configuracion = obtener_configuracion()
        token = jwt.encode(
            {
                "sub": str(usuario.id),
                "uso": "recuperacion_contrasena",
                "version_contrasena": _version_contrasena(usuario.contrasena_hash),
                "exp": ahora() + timedelta(hours=1),
            },
            configuracion.jwt_secreto,
            algorithm=configuracion.jwt_algoritmo,
        )
        enlace = f"{configuracion.url_frontend.rstrip('/')}/acceso/restablecer?token={token}"
        try:
            from app.core.correo import enviar_correo

            enviar_correo(
                correo,
                "Recupera el acceso a tu cuenta",
                f"Para restablecer tu contraseña, abre este enlace (vence en una hora):\n{enlace}",
            )
        except Exception:
            # La respuesta al navegador no revela si la cuenta existe ni si el correo se pudo enviar.
            logger.exception("No se pudo enviar el enlace de recuperación")

    def restablecer_contrasena(self, datos: SolicitudRestablecer) -> None:
        configuracion = obtener_configuracion()
        try:
            contenido = jwt.decode(
                datos.token,
                configuracion.jwt_secreto,
                algorithms=[configuracion.jwt_algoritmo],
            )
        except jwt.ExpiredSignatureError as error:
            raise ErrorDeNegocio(
                "ENLACE_RECUPERACION_VENCIDO", "El enlace de recuperación venció.", 410
            ) from error
        except jwt.InvalidTokenError as error:
            raise ErrorDeNegocio(
                "ENLACE_RECUPERACION_INVALIDO", "El enlace de recuperación no es válido.", 400
            ) from error

        if contenido.get("uso") != "recuperacion_contrasena":
            raise ErrorDeNegocio(
                "ENLACE_RECUPERACION_INVALIDO", "El enlace de recuperación no es válido.", 400
            )
        try:
            usuario_id = uuid.UUID(contenido["sub"])
        except (KeyError, ValueError) as error:
            raise ErrorDeNegocio(
                "ENLACE_RECUPERACION_INVALIDO", "El enlace de recuperación no es válido.", 400
            ) from error
        usuario = self.repositorio.por_id(usuario_id, bloquear=True)
        if usuario is None or not hmac.compare_digest(
            str(contenido.get("version_contrasena", "")),
            _version_contrasena(usuario.contrasena_hash) if usuario is not None else "",
        ):
            raise ErrorDeNegocio(
                "ENLACE_RECUPERACION_INVALIDO", "El enlace de recuperación no es válido.", 400
            )

        usuario.contrasena_hash = cifrar_contrasena(datos.contrasena)
        usuario.intentos_fallidos = 0
        usuario.estado = True
        self.sesion.commit()

    @staticmethod
    def _credenciales_incorrectas(intentos_restantes: int) -> NoReturn:
        raise ErrorDeNegocio(
            "CREDENCIALES_INCORRECTAS",
            "El correo o la contraseña no coinciden.",
            401,
            {"intentos_restantes": intentos_restantes},
        )


def _solo_digitos(valor: str) -> str:
    return "".join(caracter for caracter in valor if caracter.isdigit())


def _version_contrasena(contrasena_hash: str) -> str:
    secreto = obtener_configuracion().jwt_secreto.encode()
    return hmac.new(secreto, contrasena_hash.encode(), hashlib.sha256).hexdigest()
