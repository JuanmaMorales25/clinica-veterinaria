"""Acceso (A1, A2, A3) y enlace público del carné (E1)."""

import uuid
from datetime import timedelta
from unittest.mock import Mock, patch

import jwt
import pytest

from app.core.config import obtener_configuracion
from app.core.db import ahora
from app.core.errores import ErrorDeNegocio
from app.core.seguridad import cifrar_contrasena
from app.modulos.acceso.esquemas import SolicitudLogin, SolicitudRecuperacion
from app.modulos.acceso.modelos import Rol, Usuario
from app.modulos.acceso.repositorio import RepositorioUsuario
from app.modulos.acceso.servicio import ServicioAcceso
from app.modulos.carne.repositorio import RepositorioCarne
from app.modulos.carne.servicio import ServicioCarne

CORREO = "maria@correo.com"
CLAVE = "Patitas2026*"


@pytest.fixture(scope="module")
def hash_clave() -> str:
    return cifrar_contrasena(CLAVE)


@pytest.fixture
def acceso(hash_clave):
    usuario = Usuario(
        id=uuid.uuid4(),
        nombre="María Gómez",
        correo_electronico=CORREO,
        contrasena_hash=hash_clave,
        rol=Rol.PROPIETARIO,
        intentos_fallidos=0,
        estado=True,
    )
    repositorio = Mock(spec=RepositorioUsuario)
    repositorio.por_correo.return_value = usuario
    return ServicioAcceso(Mock(), repositorio), usuario, repositorio


def iniciar(servicio: ServicioAcceso, clave: str, correo: str = CORREO):
    return servicio.iniciar_sesion(SolicitudLogin(correo=correo, contrasena=clave))


def test_login_correcto_reinicia_los_intentos(acceso):
    servicio, usuario, _ = acceso
    usuario.intentos_fallidos = 3
    respuesta = iniciar(servicio, CLAVE)
    assert respuesta.token
    assert usuario.intentos_fallidos == 0


def test_a1_clave_incorrecta_informa_los_intentos_restantes(acceso):
    servicio, usuario, _ = acceso
    with pytest.raises(ErrorDeNegocio) as error:
        iniciar(servicio, "otra-clave")
    assert error.value.codigo == "CREDENCIALES_INCORRECTAS"
    assert error.value.estado_http == 401
    assert error.value.detalle == {"intentos_restantes": 4}
    assert usuario.intentos_fallidos == 1


def test_a1_correo_inexistente_responde_igual(acceso):
    servicio, _, repositorio = acceso
    repositorio.por_correo.return_value = None
    with pytest.raises(ErrorDeNegocio) as error:
        iniciar(servicio, CLAVE, correo="nadie@correo.com")
    assert error.value.codigo == "CREDENCIALES_INCORRECTAS"


def test_a2_quinto_intento_fallido_bloquea_la_cuenta(acceso):
    servicio, usuario, _ = acceso
    for _ in range(4):
        with pytest.raises(ErrorDeNegocio):
            iniciar(servicio, "otra-clave")
    with pytest.raises(ErrorDeNegocio) as error:
        iniciar(servicio, "otra-clave")
    assert error.value.codigo == "CUENTA_BLOQUEADA"
    assert error.value.estado_http == 423
    assert usuario.estado is False
    with pytest.raises(ErrorDeNegocio) as error:
        iniciar(servicio, CLAVE)
    assert error.value.codigo == "CUENTA_BLOQUEADA"


def test_a3_recuperacion_no_revela_si_el_correo_existe(acceso):
    servicio, _, repositorio = acceso
    repositorio.por_correo.return_value = None
    with patch("app.core.correo.enviar_correo") as enviar:
        servicio.solicitar_recuperacion(SolicitudRecuperacion(correo="nadie@correo.com"))
    enviar.assert_not_called()


def test_a3_recuperacion_envia_enlace_al_correo_registrado(acceso):
    servicio, _, _ = acceso
    with patch("app.core.correo.enviar_correo") as enviar:
        servicio.solicitar_recuperacion(SolicitudRecuperacion(correo=CORREO))
    destinatario, _, cuerpo = enviar.call_args.args
    assert destinatario == CORREO
    assert "/acceso/restablecer?token=" in cuerpo


# --- E1: enlace público del carné ---


def token_carne(uso: str = "carne_publico", vence_en: timedelta = timedelta(hours=1)) -> str:
    configuracion = obtener_configuracion()
    return jwt.encode(
        {"sub": str(uuid.uuid4()), "uso": uso, "exp": ahora() + vence_en},
        configuracion.jwt_secreto,
        algorithm=configuracion.jwt_algoritmo,
    )


@pytest.mark.parametrize(
    ("token", "codigo", "estado_http"),
    [
        (token_carne(vence_en=timedelta(seconds=-1)), "ENLACE_VENCIDO", 410),
        ("no-es-un-token", "ENLACE_INVALIDO", 404),
        (token_carne(uso="recuperacion_contrasena"), "ENLACE_INVALIDO", 404),
    ],
)
def test_e1_enlace_del_carne_vencido_o_invalido(token, codigo, estado_http):
    servicio = ServicioCarne(Mock(), Mock(spec=RepositorioCarne))
    with pytest.raises(ErrorDeNegocio) as error:
        servicio.obtener_publico(token)
    assert error.value.codigo == codigo
    assert error.value.estado_http == estado_http
