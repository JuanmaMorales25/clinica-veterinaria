import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.config import obtener_configuracion
from app.core.correo import Adjunto, enviar_correo
from app.core.db import obtener_sesion
from app.core.errores import ErrorDeNegocio
from app.core.seguridad import requiere_rol
from app.core.unidad_de_trabajo import UnidadDeTrabajoSQLAlchemy
from app.modulos.acceso.modelos import ROLES_PERSONAL, Rol, Usuario
from app.modulos.atencion.repositorio import RepositorioConsultaSQLAlchemy
from app.modulos.atencion.servicio import hoy
from app.modulos.auditoria.servicio import RegistroAuditoriaBD
from app.modulos.facturacion.comprobante_pdf import generar_pdf
from app.modulos.facturacion.esquemas import (
    ComprobanteSalida,
    CuentaDeCobroSalida,
    EnvioComprobante,
    SolicitudAjuste,
    SolicitudAnulacion,
    SolicitudPago,
)
from app.modulos.facturacion.presentacion import cuenta_a_salida, factura_a_salida
from app.modulos.facturacion.repositorio import RepositorioFacturaSQLAlchemy
from app.modulos.facturacion.servicio import (
    CierreAtencionFacade,
    DatosPago,
    GeneradorCuentaConsulta,
    ServicioFacturacion,
)
from app.modulos.inventario.repositorio import RepositorioLoteSQLAlchemy
from app.modulos.inventario.servicio import ServicioInventario
from app.modulos.notificaciones.modelos import MensajeEnviado
from app.modulos.pacientes.modelos import TipoCanal

router = APIRouter(prefix="/facturacion", tags=["Facturación"])

personal = requiere_rol(*ROLES_PERSONAL)
# D4: la anulación la hace el administrador (Figma: "Responsable: Administrador").
administrador = requiere_rol(Rol.ADMINISTRADOR)


def obtener_fachada(sesion: Session = Depends(obtener_sesion)) -> CierreAtencionFacade:
    inventario = ServicioInventario(RepositorioLoteSQLAlchemy(sesion))
    facturacion = ServicioFacturacion(
        RepositorioFacturaSQLAlchemy(sesion), GeneradorCuentaConsulta(inventario)
    )
    return CierreAtencionFacade(
        consultas=RepositorioConsultaSQLAlchemy(sesion),
        facturacion=facturacion,
        inventario=inventario,
        existencias=inventario,
        unidad_de_trabajo=UnidadDeTrabajoSQLAlchemy(sesion),
        auditoria=RegistroAuditoriaBD(sesion),
    )


@router.get("/consultas/{id_consulta}/cuenta", response_model=CuentaDeCobroSalida)
def cuenta_de_cobro(
    id_consulta: uuid.UUID,
    _: Usuario = Depends(personal),
    fachada: CierreAtencionFacade = Depends(obtener_fachada),
):
    cuenta = fachada.cuenta_de_cobro(id_consulta)
    return cuenta_a_salida(cuenta, hoy(), fachada.facturacion.de_consulta(id_consulta))


@router.put("/consultas/{id_consulta}/lineas/{id_linea}", response_model=CuentaDeCobroSalida)
def ajustar_linea(
    id_consulta: uuid.UUID,
    id_linea: uuid.UUID,
    datos: SolicitudAjuste,
    usuario: Usuario = Depends(personal),
    fachada: CierreAtencionFacade = Depends(obtener_fachada),
):
    cuenta = fachada.ajustar_linea(id_consulta, id_linea, datos.lote_id, datos.cantidad, usuario)
    return cuenta_a_salida(cuenta, hoy())


@router.post(
    "/consultas/{id_consulta}/facturar",
    response_model=ComprobanteSalida,
    status_code=status.HTTP_201_CREATED,
)
def facturar_atencion(
    id_consulta: uuid.UUID,
    datos: SolicitudPago,
    usuario: Usuario = Depends(personal),
    fachada: CierreAtencionFacade = Depends(obtener_fachada),
):
    simular = datos.simular_falla and obtener_configuracion().modo_demo
    factura = fachada.facturar_atencion(
        id_consulta, usuario, DatosPago(datos.medio, datos.valor_recibido), simular_falla=simular
    )
    return factura_a_salida(factura, hoy(), fachada.alertas_stock(factura, hoy()))


@router.get("/consultas/{id_consulta}/factura", response_model=ComprobanteSalida)
def factura_de_consulta(
    id_consulta: uuid.UUID,
    _: Usuario = Depends(personal),
    fachada: CierreAtencionFacade = Depends(obtener_fachada),
):
    factura = fachada.facturacion.de_consulta(id_consulta)
    if factura is None:
        raise ErrorDeNegocio("FACTURA_NO_ENCONTRADA", "La atención todavía no tiene factura.", 404)
    return factura_a_salida(factura, hoy(), fachada.alertas_stock(factura, hoy()))


@router.post("/facturas/{id_factura}/anular", response_model=ComprobanteSalida)
def anular_factura(
    id_factura: uuid.UUID,
    datos: SolicitudAnulacion,
    usuario: Usuario = Depends(administrador),
    fachada: CierreAtencionFacade = Depends(obtener_fachada),
):
    factura = fachada.anular_factura(id_factura, datos.motivo, usuario)
    return factura_a_salida(factura, hoy(), fachada.alertas_stock(factura, hoy()))


@router.get("/facturas/{id_factura}/pdf", response_class=Response)
def descargar_comprobante(
    id_factura: uuid.UUID,
    _: Usuario = Depends(personal),
    fachada: CierreAtencionFacade = Depends(obtener_fachada),
):
    comprobante = factura_a_salida(fachada.facturacion.obtener(id_factura), hoy())
    return Response(
        generar_pdf(comprobante),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{comprobante.numero}.pdf"'},
    )


@router.post("/facturas/{id_factura}/enviar", response_model=EnvioComprobante)
def enviar_comprobante(
    id_factura: uuid.UUID,
    usuario: Usuario = Depends(personal),
    fachada: CierreAtencionFacade = Depends(obtener_fachada),
    sesion: Session = Depends(obtener_sesion),
):
    comprobante = factura_a_salida(fachada.facturacion.obtener(id_factura), hoy())
    asunto = f"Comprobante {comprobante.numero} · Clínica Veterinaria"
    cuerpo = (
        f"Hola, {comprobante.propietario}.\n\n"
        f"Adjuntamos el comprobante {comprobante.numero} de la atención de "
        f"{comprobante.paciente.nombre}.\n\nGracias por confiar en nosotros."
    )
    try:
        enviar_correo(
            comprobante.correo_propietario,
            asunto,
            cuerpo,
            (Adjunto(f"{comprobante.numero}.pdf", generar_pdf(comprobante)),),
        )
    except Exception as error:
        raise ErrorDeNegocio(
            "CORREO_NO_ENVIADO", "No se pudo enviar el correo. Intenta de nuevo.", 502
        ) from error
    sesion.add(
        MensajeEnviado(
            canal=TipoCanal.CORREO,
            destinatario=comprobante.correo_propietario,
            asunto=asunto,
            cuerpo=cuerpo,
        )
    )
    RegistroAuditoriaBD(sesion).registrar(
        usuario, "ENVIAR_COMPROBANTE", "factura", id_factura, {"numero": comprobante.numero}
    )
    sesion.commit()
    return EnvioComprobante(destinatario=comprobante.correo_propietario)
