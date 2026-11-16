"""Envío de correos. En local va por SMTP a Mailpit; en el despliegue, por la API HTTP de Mailpit.

Lo usan el comprobante de facturación y el `CanalCorreo` de las notificaciones.
"""

import base64
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

import httpx

from app.core.config import obtener_configuracion

NOMBRE_REMITENTE = "Clínica Veterinaria"


@dataclass(frozen=True)
class Adjunto:
    nombre: str
    contenido: bytes
    tipo: str = "application/pdf"


def enviar_correo(
    destinatario: str, asunto: str, cuerpo: str, adjuntos: tuple[Adjunto, ...] = ()
) -> None:
    configuracion = obtener_configuracion()
    if configuracion.correo_api_url:
        _enviar_por_http(configuracion.correo_api_url, destinatario, asunto, cuerpo, adjuntos)
    else:
        _enviar_por_smtp(destinatario, asunto, cuerpo, adjuntos)


def _enviar_por_smtp(
    destinatario: str, asunto: str, cuerpo: str, adjuntos: tuple[Adjunto, ...]
) -> None:
    configuracion = obtener_configuracion()
    mensaje = EmailMessage()
    mensaje["From"] = f"{NOMBRE_REMITENTE} <{configuracion.correo_remitente}>"
    mensaje["To"] = destinatario
    mensaje["Subject"] = asunto
    mensaje.set_content(cuerpo)
    for adjunto in adjuntos:
        principal, secundario = adjunto.tipo.split("/", 1)
        mensaje.add_attachment(
            adjunto.contenido, maintype=principal, subtype=secundario, filename=adjunto.nombre
        )
    with smtplib.SMTP(configuracion.smtp_host, configuracion.smtp_puerto, timeout=10) as smtp:
        smtp.send_message(mensaje)


def _enviar_por_http(
    url_base: str, destinatario: str, asunto: str, cuerpo: str, adjuntos: tuple[Adjunto, ...]
) -> None:
    configuracion = obtener_configuracion()
    respuesta = httpx.post(
        f"{url_base.rstrip('/')}/api/v1/send",
        json={
            "From": {"Email": configuracion.correo_remitente, "Name": NOMBRE_REMITENTE},
            "To": [{"Email": destinatario}],
            "Subject": asunto,
            "Text": cuerpo,
            "Attachments": [
                {
                    "Content": base64.b64encode(adjunto.contenido).decode(),
                    "Filename": adjunto.nombre,
                    "ContentType": adjunto.tipo,
                }
                for adjunto in adjuntos
            ],
        },
        auth=_credenciales(configuracion.correo_api_auth),
        timeout=15,
    )
    respuesta.raise_for_status()


def _credenciales(auth: str) -> tuple[str, str] | None:
    usuario, _, clave = auth.partition(":")
    return (usuario, clave) if usuario and clave else None
