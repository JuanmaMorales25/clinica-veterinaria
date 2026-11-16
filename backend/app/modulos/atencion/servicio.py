import uuid
from datetime import date, timedelta

from app.core.config import obtener_configuracion
from app.core.db import ahora
from app.core.errores import ErrorDeNegocio
from app.core.unidad_de_trabajo import UnidadDeTrabajo
from app.modulos.acceso.modelos import Usuario
from app.modulos.atencion.esquemas import (
    AlergiaSalida,
    AtencionFicha,
    ConsultaDetalle,
    DatosConsulta,
    DecisionAlerta,
    FacturaResumen,
    FichaPaciente,
    LoteSalida,
    MedicamentoCatalogo,
    NotaSalida,
    OpcionesVacunacion,
    OpcionVacuna,
    PrescripcionSalida,
    RegistroAlerta,
    ResumenMascota,
    SolicitudPrescripcion,
    SolicitudVacunacion,
    VacunacionSalida,
    VacunaFicha,
)
from app.modulos.atencion.modelos import (
    Consulta,
    EstadoConsulta,
    ItemAplicado,
    NotaAclaratoria,
    ServicioPrestado,
    Vacunacion,
)
from app.modulos.atencion.repositorio import RepositorioConsulta
from app.modulos.auditoria.servicio import RegistroAuditoria
from app.modulos.inventario.servicio import ConsultaExistencias, ReglaDispensacion
from app.modulos.notificaciones.programador import ProgramadorRecordatorios
from app.modulos.pacientes.modelos import Mascota
from app.modulos.pacientes.repositorio import RepositorioMascota

SERVICIO_CONSULTA = "Consulta general"


def hoy() -> date:
    return ahora().date()


class ServicioAtencion:
    """Consulta clínica: registro, prescripción con revisión de alergias, cierre y notas."""

    def __init__(
        self,
        consultas: RepositorioConsulta,
        mascotas: RepositorioMascota,
        unidad_de_trabajo: UnidadDeTrabajo,
        auditoria: RegistroAuditoria,
        vacunacion: "ServicioVacunacion",
    ) -> None:
        self.consultas = consultas
        self.mascotas = mascotas
        self.uow = unidad_de_trabajo
        self.auditoria = auditoria
        self.vacunacion = vacunacion

    # --- Lectura ---

    def buscar_pacientes(self, texto: str) -> list[ResumenMascota]:
        return [self.resumen_mascota(mascota) for mascota in self.mascotas.buscar(texto)]

    def ficha(self, id_mascota: uuid.UUID) -> FichaPaciente:
        mascota = self._mascota(id_mascota)
        historial = self.consultas.historial_de_mascota(mascota.id)
        abierta = next((c for c in historial if c.estado == EstadoConsulta.ABIERTA), None)
        return FichaPaciente(
            **self.resumen_mascota(mascota).model_dump(),
            vacunas=[
                VacunaFicha(
                    biologico=vacuna.esquema.biologico,
                    fecha_aplicacion=vacuna.fecha_aplicacion,
                    fecha_proxima_dosis=vacuna.fecha_proxima_dosis,
                    refuerzo_programado=bool(
                        vacuna.fecha_proxima_dosis and vacuna.fecha_proxima_dosis >= hoy()
                    ),
                )
                for vacuna in self._ultima_por_esquema(mascota.id)
            ],
            atenciones=[
                AtencionFicha(
                    id=consulta.id,
                    fecha=consulta.fecha,
                    motivo=consulta.motivo or "Consulta en curso",
                    veterinario=consulta.veterinario.nombre,
                    estado=consulta.estado,
                )
                for consulta in historial
            ],
            consulta_abierta_id=abierta.id if abierta else None,
        )

    def detalle(self, id_consulta: uuid.UUID) -> ConsultaDetalle:
        consulta = self._consulta(id_consulta)
        factura = self.consultas.factura_de_consulta(consulta.id)
        return ConsultaDetalle(
            id=consulta.id,
            estado=consulta.estado,
            fecha=consulta.fecha,
            cerrada_en=consulta.cerrada_en,
            veterinario=consulta.veterinario.nombre,
            motivo=consulta.motivo,
            peso=consulta.peso,
            temperatura=consulta.temperatura,
            frecuencia_cardiaca=consulta.frecuencia_cardiaca,
            hallazgos=consulta.hallazgos,
            diagnostico=consulta.diagnostico,
            plan_tratamiento=consulta.plan_tratamiento,
            mascota=self.resumen_mascota(consulta.mascota),
            servicios=[prestado.servicio.nombre for prestado in consulta.servicios_prestados],
            prescripciones=[self._prescripcion(item) for item in consulta.items_aplicados],
            vacunaciones=[self.vacunacion.a_salida(v) for v in consulta.vacunaciones],
            notas=[
                NotaSalida(id=nota.id, texto=nota.texto, autor=nota.autor.nombre, fecha=nota.fecha)
                for nota in consulta.notas
            ],
            factura=(
                FacturaResumen(id=factura.id, numero=factura.numero, estado=factura.estado)
                if factura
                else None
            ),
        )

    def catalogo_medicamentos(self) -> list[MedicamentoCatalogo]:
        return [
            MedicamentoCatalogo(id=p.id, nombre=p.nombre, principio_activo=p.principio_activo)
            for p in self.consultas.medicamentos()
        ]

    def opciones_vacunacion(self, id_consulta: uuid.UUID) -> OpcionesVacunacion:
        return self.vacunacion.opciones(self._consulta(id_consulta))

    def resumen_mascota(self, mascota: Mascota) -> ResumenMascota:
        historial = self.consultas.historial_de_mascota(mascota.id)
        cerradas = [c for c in historial if c.estado == EstadoConsulta.CERRADA]
        return ResumenMascota(
            id=mascota.id,
            nombre=mascota.nombre,
            especie=mascota.especie,
            raza=mascota.raza,
            edad=mascota.describir_edad(hoy()),
            numero_historia=mascota.numero_historia,
            fotografia=mascota.fotografia,
            alergias=[
                AlergiaSalida(descripcion=a.descripcion, severidad=a.severidad)
                for a in mascota.alergias
            ],
            esquema_al_dia=self._esquema_al_dia(mascota.id),
            ultima_atencion=cerradas[0].fecha.date() if cerradas else None,
            propietario_nombre=mascota.propietario.nombre,
            propietario_telefono=mascota.propietario.telefono,
        )

    # --- Escritura ---

    def iniciar_consulta(self, id_mascota: uuid.UUID, usuario: Usuario) -> Consulta:
        """Abre la consulta de la mascota o retoma la que quedó abierta."""
        mascota = self._mascota(id_mascota)
        abierta = self.consultas.abierta_de_mascota(mascota.id)
        if abierta:
            return abierta
        self.uow.iniciar()
        cita = self.consultas.cita_de_hoy(mascota.id, hoy())
        consulta = Consulta(
            id=uuid.uuid4(),
            mascota=mascota,
            veterinario=usuario,
            cita_id=cita.id if cita else None,
            motivo="",
            peso=mascota.peso,
        )
        servicio = self.consultas.servicio_por_nombre(SERVICIO_CONSULTA)
        if servicio:
            consulta.servicios_prestados.append(ServicioPrestado(servicio=servicio))
        self.consultas.agregar(consulta)
        self.auditoria.registrar(
            usuario, "ABRIR_CONSULTA", "consulta", consulta.id, {"mascota": mascota.nombre}
        )
        self.uow.confirmar()
        return consulta

    def actualizar(self, id_consulta: uuid.UUID, datos: DatosConsulta, usuario: Usuario) -> None:
        consulta = self._consulta_abierta(id_consulta)
        self.uow.iniciar()
        for campo, valor in datos.model_dump().items():
            setattr(consulta, campo, valor.strip() if isinstance(valor, str) else valor)
        self.uow.confirmar()

    def registrar_alerta(
        self, id_consulta: uuid.UUID, datos: DecisionAlerta, usuario: Usuario
    ) -> RegistroAlerta:
        """C1/C2: queda constancia de quién revisó u omitió la alerta, cuándo y por qué."""
        consulta = self._consulta_abierta(id_consulta)
        motivo = (datos.motivo or "").strip() or None
        if datos.decision == "OMITIDA" and not motivo:
            raise ErrorDeNegocio(
                "MOTIVO_REQUERIDO", "Escribe el motivo para omitir la alerta.", 422
            )
        self.uow.iniciar()
        accion = (
            "REVISAR_ALERTA_ALERGIA" if datos.decision == "REVISADA" else "OMITIR_ALERTA_ALERGIA"
        )
        self.auditoria.registrar(
            usuario,
            accion,
            "consulta",
            consulta.id,
            {"alergias": [a.descripcion for a in consulta.mascota.alergias], "motivo": motivo},
        )
        self.uow.confirmar()
        return RegistroAlerta(
            decision=datos.decision, motivo=motivo, usuario=usuario.nombre, fecha=ahora()
        )

    def prescribir(
        self, id_consulta: uuid.UUID, datos: SolicitudPrescripcion, usuario: Usuario
    ) -> PrescripcionSalida:
        consulta = self._consulta_abierta(id_consulta)
        alergias = consulta.mascota.alergias
        motivo = (datos.motivo_omision_alerta or "").strip() or None
        # C1: con alergias registradas no se prescribe sin revisar la alerta u omitirla con motivo.
        if alergias and not datos.alerta_revisada and not motivo:
            raise ErrorDeNegocio(
                "ALERGIA_SIN_REVISAR",
                f"{consulta.mascota.nombre} tiene alergias registradas. Revísalas antes de prescribir.",
                409,
                {"alergias": [a.descripcion for a in alergias]},
            )
        producto = self.consultas.obtener_producto(datos.producto_id)
        if producto is None:
            raise ErrorDeNegocio("PRODUCTO_NO_ENCONTRADO", "El medicamento no existe.", 404)
        self.uow.iniciar()
        item = ItemAplicado(
            id=uuid.uuid4(),
            producto=producto,
            producto_id=producto.id,
            cantidad=datos.cantidad,
            dosis=datos.dosis,
            via_administracion=datos.via_administracion,
            frecuencia=datos.frecuencia,
            duracion=datos.duracion,
            alerta_revisada=datos.alerta_revisada,
            motivo_omision_alerta=motivo,
        )
        consulta.items_aplicados.append(item)
        self.auditoria.registrar(
            usuario, "PRESCRIBIR", "consulta", consulta.id, {"producto": producto.nombre}
        )
        self.uow.confirmar()
        return self._prescripcion(item)

    def quitar_prescripcion(self, id_consulta: uuid.UUID, id_item: uuid.UUID) -> None:
        consulta = self._consulta_abierta(id_consulta)
        item = next((i for i in consulta.items_aplicados if i.id == id_item), None)
        if item is None:
            raise ErrorDeNegocio("PRESCRIPCION_NO_ENCONTRADA", "La prescripción no existe.", 404)
        self.uow.iniciar()
        consulta.items_aplicados.remove(item)
        self.consultas.eliminar_item(item)
        self.uow.confirmar()

    def registrar_vacunacion(
        self, id_consulta: uuid.UUID, datos: SolicitudVacunacion, usuario: Usuario
    ) -> VacunacionSalida:
        return self.vacunacion.registrar(self._consulta_abierta(id_consulta), datos, usuario)

    def cerrar(self, id_consulta: uuid.UUID, usuario: Usuario) -> None:
        consulta = self._consulta_abierta(id_consulta)
        faltantes = [
            campo
            for campo, valor in (("motivo", consulta.motivo), ("diagnostico", consulta.diagnostico))
            if not (valor or "").strip()
        ]
        if faltantes:
            raise ErrorDeNegocio(
                "DATOS_INCOMPLETOS",
                "Completa el motivo y el diagnóstico antes de cerrar la atención.",
                422,
                {"campos": faltantes},
            )
        self.uow.iniciar()
        consulta.estado = EstadoConsulta.CERRADA
        consulta.cerrada_en = ahora()
        for vacuna in consulta.vacunaciones:
            self.vacunacion.programar_aviso(vacuna, consulta.mascota)
        self.auditoria.registrar(usuario, "CERRAR_CONSULTA", "consulta", consulta.id)
        self.uow.confirmar()

    def agregar_nota(self, id_consulta: uuid.UUID, texto: str, usuario: Usuario) -> NotaSalida:
        """C4: el registro cerrado no se edita; la corrección queda como nota fechada y firmada."""
        consulta = self._consulta(id_consulta)
        if consulta.estado != EstadoConsulta.CERRADA:
            raise ErrorDeNegocio(
                "REGISTRO_ABIERTO", "La consulta sigue abierta: corrígela directamente.", 409
            )
        self.uow.iniciar()
        nota = NotaAclaratoria(id=uuid.uuid4(), autor=usuario, texto=texto.strip(), fecha=ahora())
        consulta.notas.append(nota)
        self.auditoria.registrar(usuario, "AGREGAR_NOTA_ACLARATORIA", "consulta", consulta.id)
        self.uow.confirmar()
        return NotaSalida(id=nota.id, texto=nota.texto, autor=usuario.nombre, fecha=nota.fecha)

    # --- Apoyo ---

    def _mascota(self, id_mascota: uuid.UUID) -> Mascota:
        mascota = self.mascotas.obtener(id_mascota)
        if mascota is None:
            raise ErrorDeNegocio("PACIENTE_NO_ENCONTRADO", "El paciente no existe.", 404)
        return mascota

    def _consulta(self, id_consulta: uuid.UUID) -> Consulta:
        consulta = self.consultas.obtener(id_consulta)
        if consulta is None:
            raise ErrorDeNegocio("CONSULTA_NO_ENCONTRADA", "La consulta no existe.", 404)
        return consulta

    def _consulta_abierta(self, id_consulta: uuid.UUID) -> Consulta:
        consulta = self._consulta(id_consulta)
        if consulta.estado == EstadoConsulta.CERRADA:
            # RN-03: la historia clínica cerrada no se modifica; se agrega una nota aclaratoria.
            raise ErrorDeNegocio(
                "REGISTRO_CERRADO",
                "La consulta está cerrada y no puede editarse. Agrega una nota aclaratoria.",
                409,
            )
        return consulta

    def _ultima_por_esquema(self, id_mascota: uuid.UUID) -> list[Vacunacion]:
        ultimas: dict[uuid.UUID, Vacunacion] = {}
        for vacuna in self.consultas.vacunaciones_de_mascota(id_mascota):
            ultimas.setdefault(vacuna.esquema_id, vacuna)
        return list(ultimas.values())

    def _esquema_al_dia(self, id_mascota: uuid.UUID) -> bool:
        return all(
            vacuna.fecha_proxima_dosis is None or vacuna.fecha_proxima_dosis >= hoy()
            for vacuna in self._ultima_por_esquema(id_mascota)
        )

    @staticmethod
    def _prescripcion(item: ItemAplicado) -> PrescripcionSalida:
        return PrescripcionSalida(
            id=item.id,
            producto_id=item.producto_id or item.producto.id,
            producto=item.producto.nombre,
            cantidad=item.cantidad,
            dosis=item.dosis,
            via_administracion=item.via_administracion,
            frecuencia=item.frecuencia,
            duracion=item.duracion,
            alerta_revisada=item.alerta_revisada,
            motivo_omision_alerta=item.motivo_omision_alerta,
        )


class ServicioVacunacion:
    """Aplicación de vacunas según el esquema de la especie y aviso de la próxima dosis."""

    def __init__(
        self,
        consultas: RepositorioConsulta,
        existencias: ConsultaExistencias,
        reglas: list[ReglaDispensacion],
        programador: ProgramadorRecordatorios,
        unidad_de_trabajo: UnidadDeTrabajo,
        auditoria: RegistroAuditoria,
    ) -> None:
        self.consultas = consultas
        self.existencias = existencias
        self.reglas = reglas
        self.programador = programador
        self.uow = unidad_de_trabajo
        self.auditoria = auditoria

    def opciones(self, consulta: Consulta) -> OpcionesVacunacion:
        return OpcionesVacunacion(
            dias_aviso=obtener_configuracion().dias_aviso_proxima_dosis,
            opciones=[
                OpcionVacuna(
                    esquema_id=esquema.id,
                    biologico=esquema.biologico,
                    laboratorio=esquema.producto.laboratorio,
                    numero_dosis=esquema.numero_dosis,
                    intervalo_dias=esquema.intervalo_dias,
                    lotes=[
                        LoteSalida(
                            id=lote.id,
                            codigo=lote.codigo,
                            fecha_vencimiento=lote.fecha_vencimiento,
                            disponible=lote.cantidad_disponible,
                        )
                        for lote in self.existencias.lotes_vigentes(esquema.producto_id, hoy())
                    ],
                )
                for esquema in self.consultas.esquemas_de_especie(consulta.mascota.especie)
            ],
        )

    def registrar(
        self, consulta: Consulta, datos: SolicitudVacunacion, usuario: Usuario
    ) -> VacunacionSalida:
        esquema = self.consultas.obtener_esquema(datos.esquema_id)
        if esquema is None or esquema.especie.lower() != consulta.mascota.especie.lower():
            raise ErrorDeNegocio(
                "ESQUEMA_NO_APLICA", "Ese biológico no está en el esquema de la especie.", 422
            )
        lote = next(
            (
                lote
                for lote in self.existencias.lotes_del_producto(esquema.producto_id)
                if lote.id == datos.lote_id
            ),
            None,
        )
        if lote is None:
            raise ErrorDeNegocio("LOTE_NO_ENCONTRADO", "El lote no corresponde al biológico.", 404)
        for regla in self.reglas:
            regla.validar(lote, 1, hoy())

        fecha_aplicacion = datos.fecha_aplicacion or hoy()
        self.uow.iniciar()
        # Una sola aplicación por biológico en la misma consulta: si se corrige, se reemplaza.
        anterior = next((v for v in consulta.vacunaciones if v.esquema_id == esquema.id), None)
        if anterior:
            consulta.vacunaciones.remove(anterior)
            self.consultas.eliminar_vacunacion(anterior)
        vacuna = Vacunacion(
            id=uuid.uuid4(),
            esquema=esquema,
            lote=lote,
            fecha_aplicacion=fecha_aplicacion,
            fecha_proxima_dosis=esquema.calcular_proxima_dosis(fecha_aplicacion),
        )
        consulta.vacunaciones.append(vacuna)
        self.auditoria.registrar(
            usuario,
            "REGISTRAR_VACUNACION",
            "consulta",
            consulta.id,
            {"biologico": esquema.biologico, "lote": lote.codigo},
        )
        self.uow.confirmar()
        return self.a_salida(vacuna)

    def programar_aviso(self, vacuna: Vacunacion, mascota: Mascota) -> None:
        self.programador.programar_proxima_dosis(vacuna, mascota)

    @staticmethod
    def a_salida(vacuna: Vacunacion) -> VacunacionSalida:
        dias_aviso = obtener_configuracion().dias_aviso_proxima_dosis
        proxima = vacuna.fecha_proxima_dosis
        return VacunacionSalida(
            id=vacuna.id,
            esquema_id=vacuna.esquema_id or vacuna.esquema.id,
            biologico=vacuna.esquema.biologico,
            laboratorio=vacuna.esquema.producto.laboratorio,
            lote_id=vacuna.lote_id or vacuna.lote.id,
            lote_codigo=vacuna.lote.codigo,
            lote_vence=vacuna.lote.fecha_vencimiento,
            fecha_aplicacion=vacuna.fecha_aplicacion,
            fecha_proxima_dosis=proxima,
            fecha_aviso=proxima - timedelta(days=dias_aviso) if proxima else None,
        )
