"""Reglas de la HU-MVP-02 probadas con repositorios simulados (sin base de datos)."""

import uuid
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import Mock

import pytest

from app.core.errores import ErrorDeNegocio
from app.core.unidad_de_trabajo import UnidadDeTrabajo
from app.modulos.acceso.modelos import Rol, Usuario
from app.modulos.agenda.modelos import Cita, EstadoCitaValor
from app.modulos.atencion.esquemas import DatosConsulta, DecisionAlerta, SolicitudPrescripcion
from app.modulos.atencion.modelos import Consulta, EsquemaVacunacion, EstadoConsulta, Vacunacion
from app.modulos.atencion.repositorio import RepositorioConsulta
from app.modulos.atencion.servicio import ServicioAtencion, ServicioVacunacion
from app.modulos.auditoria.servicio import RegistroAuditoria
from app.modulos.inventario.modelos import Producto, TipoProducto
from app.modulos.notificaciones.programador import ProgramadorRecordatorios
from app.modulos.pacientes.modelos import Alergia, Mascota, Propietario
from app.modulos.pacientes.repositorio import RepositorioMascota

VETERINARIA = Usuario(id=uuid.uuid4(), nombre="Dra. Ramírez", rol=Rol.VETERINARIO)


def mascota(alergias: list[str] | None = None) -> Mascota:
    return Mascota(
        id=uuid.uuid4(),
        nombre="Manolito",
        especie="Perro",
        numero_historia="HC-00481",
        propietario=Propietario(nombre="María Gómez", telefono="300 123 4567"),
        alergias=[
            Alergia(descripcion=a, severidad="Alta", fecha_registro=date(2026, 9, 1))
            for a in alergias or []
        ],
    )


def consulta(estado=EstadoConsulta.ABIERTA, alergias=None, **datos) -> Consulta:
    return Consulta(
        id=uuid.uuid4(),
        mascota=mascota(alergias),
        veterinario=VETERINARIA,
        motivo=datos.get("motivo", ""),
        diagnostico=datos.get("diagnostico"),
        estado=estado,
        items_aplicados=[],
        vacunaciones=datos.get("vacunaciones", []),
        notas=[],
    )


def servicio(con: Consulta) -> tuple[ServicioAtencion, Mock, Mock]:
    consultas = Mock(spec=RepositorioConsulta)
    consultas.obtener.return_value = con
    consultas.obtener_producto.return_value = Producto(
        id=uuid.uuid4(), nombre="Omeprazol 10 mg", tipo=TipoProducto.MEDICAMENTO
    )
    auditoria = Mock(spec=RegistroAuditoria)
    programador = Mock(spec=ProgramadorRecordatorios)
    uow = Mock(spec=UnidadDeTrabajo)
    vacunacion = ServicioVacunacion(consultas, Mock(), [], programador, uow, auditoria)
    atencion = ServicioAtencion(
        consultas, Mock(spec=RepositorioMascota), uow, auditoria, vacunacion
    )
    return atencion, auditoria, programador


def prescripcion(**cambios) -> SolicitudPrescripcion:
    return SolicitudPrescripcion(producto_id=uuid.uuid4(), cantidad=2, **cambios)


def test_c1_alergia_bloquea_la_prescripcion_sin_revision():
    atencion, _, _ = servicio(consulta(alergias=["Penicilina"]))
    with pytest.raises(ErrorDeNegocio) as error:
        atencion.prescribir(uuid.uuid4(), prescripcion(), VETERINARIA)
    assert error.value.codigo == "ALERGIA_SIN_REVISAR"
    assert error.value.detalle == {"alergias": ["Penicilina"]}


def test_prescripcion_con_alergia_revisada_queda_registrada():
    con = consulta(alergias=["Penicilina"])
    atencion, auditoria, _ = servicio(con)
    salida = atencion.prescribir(uuid.uuid4(), prescripcion(alerta_revisada=True), VETERINARIA)
    assert salida.alerta_revisada
    assert len(con.items_aplicados) == 1
    auditoria.registrar.assert_called_once()


def test_c2_omitir_alerta_exige_motivo_y_lo_audita():
    atencion, auditoria, _ = servicio(consulta(alergias=["Penicilina"]))
    with pytest.raises(ErrorDeNegocio) as error:
        atencion.registrar_alerta(uuid.uuid4(), DecisionAlerta(decision="OMITIDA"), VETERINARIA)
    assert error.value.codigo == "MOTIVO_REQUERIDO"

    datos = DecisionAlerta(decision="OMITIDA", motivo="Prueba cutánea negativa reciente")
    atencion.registrar_alerta(uuid.uuid4(), datos, VETERINARIA)
    _, accion, _, _, detalle = auditoria.registrar.call_args.args
    assert accion == "OMITIR_ALERTA_ALERGIA"
    assert detalle["motivo"] == "Prueba cutánea negativa reciente"


def test_sin_alergias_no_pide_revision():
    atencion, _, _ = servicio(consulta())
    assert atencion.prescribir(uuid.uuid4(), prescripcion(), VETERINARIA).cantidad == 2


def test_c4_registro_cerrado_no_se_edita():
    atencion, _, _ = servicio(consulta(estado=EstadoConsulta.CERRADA))
    with pytest.raises(ErrorDeNegocio) as error:
        atencion.actualizar(uuid.uuid4(), DatosConsulta(motivo="Otro"), VETERINARIA)
    assert error.value.codigo == "REGISTRO_CERRADO"


def test_c4_nota_aclaratoria_solo_en_registro_cerrado():
    abierta, _, _ = servicio(consulta())
    with pytest.raises(ErrorDeNegocio) as error:
        abierta.agregar_nota(uuid.uuid4(), "Corrección", VETERINARIA)
    assert error.value.codigo == "REGISTRO_ABIERTO"

    con = consulta(estado=EstadoConsulta.CERRADA)
    cerrada, _, _ = servicio(con)
    cerrada.agregar_nota(uuid.uuid4(), "  El peso se tomó sin collar. ", VETERINARIA)
    assert con.notas[0].texto == "El peso se tomó sin collar."


def test_cerrar_exige_motivo_y_diagnostico():
    atencion, _, _ = servicio(consulta(motivo="Control"))
    with pytest.raises(ErrorDeNegocio) as error:
        atencion.cerrar(uuid.uuid4(), VETERINARIA)
    assert error.value.detalle == {"campos": ["diagnostico"]}


def test_cerrar_programa_el_aviso_de_cada_vacuna():
    esquema = EsquemaVacunacion(biologico="Antirrábica", intervalo_dias=365)
    vacuna = Vacunacion(
        esquema=esquema,
        fecha_aplicacion=date(2026, 10, 20),
        fecha_proxima_dosis=esquema.calcular_proxima_dosis(date(2026, 10, 20)),
    )
    con = consulta(motivo="Control", diagnostico="Paciente sano", vacunaciones=[vacuna])
    atencion, _, programador = servicio(con)
    atencion.cerrar(uuid.uuid4(), VETERINARIA)
    assert con.estado == EstadoConsulta.CERRADA
    assert con.cerrada_en is not None
    programador.programar_proxima_dosis.assert_called_once_with(vacuna, con.mascota)
    assert vacuna.fecha_proxima_dosis == date(2027, 10, 20)


def test_cerrar_marca_atendida_la_cita_confirmada_del_dia():
    con = consulta(motivo="Control", diagnostico="Paciente sano")
    con.cita = Cita(estado=EstadoCitaValor.CONFIRMADA)
    atencion, _, _ = servicio(con)
    atencion.cerrar(uuid.uuid4(), VETERINARIA)
    assert con.cita.estado == EstadoCitaValor.ATENDIDA


@pytest.mark.parametrize(
    ("dias", "esperado"),
    [(10, "1 semana"), (190, "6 meses"), (40, "1 mes"), (380, "1 año"), (800, "2 años")],
)
def test_edad_legible(dias, esperado):
    hoy = date(2026, 11, 16)
    assert Mascota(fecha_nacimiento=hoy - timedelta(days=dias)).describir_edad(hoy) == esperado


def test_datos_de_consulta_validan_signos_vitales():
    with pytest.raises(ValueError):
        DatosConsulta(temperatura=Decimal(80))


def test_rn02_solo_el_veterinario_registra_y_cierra_la_atencion():
    from app.modulos.atencion.rutas import clinico

    assert clinico(VETERINARIA) is VETERINARIA
    for rol in (Rol.ADMINISTRADOR, Rol.AUXILIAR, Rol.PROPIETARIO):
        with pytest.raises(ErrorDeNegocio) as error:
            clinico(Usuario(id=uuid.uuid4(), nombre="Otro", rol=rol))
        assert error.value.codigo == "PERMISO_DENEGADO"
