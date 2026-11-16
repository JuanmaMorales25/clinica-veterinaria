import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.db import obtener_sesion
from app.core.seguridad import requiere_rol
from app.core.unidad_de_trabajo import UnidadDeTrabajoSQLAlchemy
from app.modulos.acceso.modelos import ROLES_PERSONAL, Rol, Usuario
from app.modulos.atencion.esquemas import (
    ConsultaDetalle,
    DatosConsulta,
    DecisionAlerta,
    FichaPaciente,
    MedicamentoCatalogo,
    NotaSalida,
    OpcionesVacunacion,
    PrescripcionSalida,
    RegistroAlerta,
    ResumenMascota,
    SolicitudConsulta,
    SolicitudNota,
    SolicitudPrescripcion,
    SolicitudVacunacion,
    VacunacionSalida,
)
from app.modulos.atencion.repositorio import RepositorioConsultaSQLAlchemy
from app.modulos.atencion.servicio import ServicioAtencion, ServicioVacunacion
from app.modulos.auditoria.servicio import RegistroAuditoriaBD
from app.modulos.inventario.repositorio import RepositorioLoteSQLAlchemy
from app.modulos.inventario.servicio import (
    ReglaExistenciaSuficiente,
    ReglaLoteVigente,
    ServicioInventario,
)
from app.modulos.notificaciones.programador import ProgramadorRecordatoriosBD
from app.modulos.pacientes.repositorio import RepositorioMascotaSQLAlchemy

router = APIRouter(prefix="/atencion", tags=["Atención clínica"])

personal = requiere_rol(*ROLES_PERSONAL)
# Solo quien atiende escribe en la historia clínica.
clinico = requiere_rol(Rol.VETERINARIO, Rol.ADMINISTRADOR)


def obtener_servicio(sesion: Session = Depends(obtener_sesion)) -> ServicioAtencion:
    consultas = RepositorioConsultaSQLAlchemy(sesion)
    uow = UnidadDeTrabajoSQLAlchemy(sesion)
    auditoria = RegistroAuditoriaBD(sesion)
    inventario = ServicioInventario(RepositorioLoteSQLAlchemy(sesion))
    vacunacion = ServicioVacunacion(
        consultas,
        existencias=inventario,
        reglas=[ReglaLoteVigente(inventario), ReglaExistenciaSuficiente()],
        programador=ProgramadorRecordatoriosBD(sesion),
        unidad_de_trabajo=uow,
        auditoria=auditoria,
    )
    return ServicioAtencion(
        consultas, RepositorioMascotaSQLAlchemy(sesion), uow, auditoria, vacunacion
    )


@router.get("/pacientes", response_model=list[ResumenMascota])
def buscar_pacientes(
    q: str = Query("", max_length=80),
    _: Usuario = Depends(personal),
    servicio: ServicioAtencion = Depends(obtener_servicio),
):
    return servicio.buscar_pacientes(q)


@router.get("/pacientes/{id_mascota}", response_model=FichaPaciente)
def ficha_paciente(
    id_mascota: uuid.UUID,
    _: Usuario = Depends(personal),
    servicio: ServicioAtencion = Depends(obtener_servicio),
):
    return servicio.ficha(id_mascota)


@router.get("/medicamentos", response_model=list[MedicamentoCatalogo])
def catalogo_medicamentos(
    _: Usuario = Depends(personal), servicio: ServicioAtencion = Depends(obtener_servicio)
):
    return servicio.catalogo_medicamentos()


@router.post("/consultas", response_model=ConsultaDetalle, status_code=status.HTTP_201_CREATED)
def iniciar_consulta(
    datos: SolicitudConsulta,
    usuario: Usuario = Depends(clinico),
    servicio: ServicioAtencion = Depends(obtener_servicio),
):
    consulta = servicio.iniciar_consulta(datos.mascota_id, usuario)
    return servicio.detalle(consulta.id)


@router.get("/consultas/{id_consulta}", response_model=ConsultaDetalle)
def detalle_consulta(
    id_consulta: uuid.UUID,
    _: Usuario = Depends(personal),
    servicio: ServicioAtencion = Depends(obtener_servicio),
):
    return servicio.detalle(id_consulta)


@router.put("/consultas/{id_consulta}", response_model=ConsultaDetalle)
def actualizar_consulta(
    id_consulta: uuid.UUID,
    datos: DatosConsulta,
    usuario: Usuario = Depends(clinico),
    servicio: ServicioAtencion = Depends(obtener_servicio),
):
    servicio.actualizar(id_consulta, datos, usuario)
    return servicio.detalle(id_consulta)


@router.post("/consultas/{id_consulta}/alerta-alergia", response_model=RegistroAlerta)
def registrar_alerta(
    id_consulta: uuid.UUID,
    datos: DecisionAlerta,
    usuario: Usuario = Depends(clinico),
    servicio: ServicioAtencion = Depends(obtener_servicio),
):
    return servicio.registrar_alerta(id_consulta, datos, usuario)


@router.post(
    "/consultas/{id_consulta}/prescripciones",
    response_model=PrescripcionSalida,
    status_code=status.HTTP_201_CREATED,
)
def prescribir(
    id_consulta: uuid.UUID,
    datos: SolicitudPrescripcion,
    usuario: Usuario = Depends(clinico),
    servicio: ServicioAtencion = Depends(obtener_servicio),
):
    return servicio.prescribir(id_consulta, datos, usuario)


@router.delete(
    "/consultas/{id_consulta}/prescripciones/{id_item}", status_code=status.HTTP_204_NO_CONTENT
)
def quitar_prescripcion(
    id_consulta: uuid.UUID,
    id_item: uuid.UUID,
    _: Usuario = Depends(clinico),
    servicio: ServicioAtencion = Depends(obtener_servicio),
):
    servicio.quitar_prescripcion(id_consulta, id_item)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/consultas/{id_consulta}/vacunacion", response_model=OpcionesVacunacion)
def opciones_vacunacion(
    id_consulta: uuid.UUID,
    _: Usuario = Depends(personal),
    servicio: ServicioAtencion = Depends(obtener_servicio),
):
    return servicio.opciones_vacunacion(id_consulta)


@router.post(
    "/consultas/{id_consulta}/vacunaciones",
    response_model=VacunacionSalida,
    status_code=status.HTTP_201_CREATED,
)
def registrar_vacunacion(
    id_consulta: uuid.UUID,
    datos: SolicitudVacunacion,
    usuario: Usuario = Depends(clinico),
    servicio: ServicioAtencion = Depends(obtener_servicio),
):
    return servicio.registrar_vacunacion(id_consulta, datos, usuario)


@router.post("/consultas/{id_consulta}/cerrar", response_model=ConsultaDetalle)
def cerrar_consulta(
    id_consulta: uuid.UUID,
    usuario: Usuario = Depends(clinico),
    servicio: ServicioAtencion = Depends(obtener_servicio),
):
    servicio.cerrar(id_consulta, usuario)
    return servicio.detalle(id_consulta)


@router.post(
    "/consultas/{id_consulta}/notas",
    response_model=NotaSalida,
    status_code=status.HTTP_201_CREATED,
)
def agregar_nota(
    id_consulta: uuid.UUID,
    datos: SolicitudNota,
    usuario: Usuario = Depends(clinico),
    servicio: ServicioAtencion = Depends(obtener_servicio),
):
    return servicio.agregar_nota(id_consulta, datos.texto, usuario)
