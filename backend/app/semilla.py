"""Datos de demostración alineados con las pantallas del Figma.

Uso: uv run python -m app.semilla
Las fechas se calculan desde hoy para que los flujos (lote vencido, próxima dosis,
recordatorio) se puedan mostrar cualquier día.
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.db import SesionLocal, ahora
from app.core.seguridad import cifrar_contrasena
from app.modulos.acceso.modelos import Rol, Usuario
from app.modulos.agenda.modelos import Cita, EstadoCitaValor, Servicio
from app.modulos.atencion.modelos import (
    Consulta,
    EsquemaVacunacion,
    EstadoConsulta,
    ServicioPrestado,
    Vacunacion,
)
from app.modulos.facturacion.modelos import (
    DetalleFactura,
    Factura,
    MedioPago,
    Pago,
    TipoItemFactura,
)
from app.modulos.inventario.modelos import (
    Lote,
    MovimientoInventario,
    Producto,
    TipoMovimiento,
    TipoProducto,
)
from app.modulos.notificaciones.modelos import Recordatorio, TipoRecordatorio
from app.modulos.pacientes.modelos import (
    Alergia,
    Mascota,
    PreferenciaNotificacion,
    Propietario,
    TipoCanal,
)

CONTRASENA_DEMO = "Clinica2026*"


def _siguiente_dia_habil(dia: date) -> date:
    dia += timedelta(days=1)
    while dia.weekday() >= 5:
        dia += timedelta(days=1)
    return dia


def sembrar(sesion: Session) -> bool:
    if sesion.scalar(select(func.count()).select_from(Usuario)):
        return False

    momento = ahora()
    hoy = momento.date()
    zona = momento.tzinfo

    def a_las(dia: date, hora: int, minuto: int = 0) -> datetime:
        return datetime.combine(dia, time(hora, minuto), tzinfo=zona)

    clave = cifrar_contrasena(CONTRASENA_DEMO)

    def usuario(nombre: str, correo: str, rol: Rol) -> Usuario:
        return Usuario(nombre=nombre, correo_electronico=correo, rol=rol, contrasena_hash=clave)

    administrador = usuario("Andrés Restrepo", "admin@clinica.veterinaria.com", Rol.ADMINISTRADOR)
    veterinaria = usuario("Dra. Ramírez", "dra.ramirez@clinica.veterinaria.com", Rol.VETERINARIO)
    auxiliar = usuario("Camila Ríos", "recepcion@clinica.veterinaria.com", Rol.AUXILIAR)
    cuenta_maria = usuario("María Gómez", "maria.gomez@correo.com", Rol.PROPIETARIO)
    sesion.add_all([administrador, veterinaria, auxiliar, cuenta_maria])

    maria = Propietario(
        documento_identidad="1037654321",
        nombre="María Gómez",
        telefono="300 123 4567",
        correo="maria.gomez@correo.com",
        autorizacion_datos=True,
        usuario=cuenta_maria,
        preferencia=PreferenciaNotificacion(canal=TipoCanal.CORREO),
    )
    # Sin cuenta: sirve para vincular una mascota por número de historia al registrarse (B2).
    carlos = Propietario(
        documento_identidad="71234567",
        nombre="Carlos Pérez",
        telefono="310 987 6543",
        correo="carlos.perez@correo.com",
        autorizacion_datos=True,
        preferencia=PreferenciaNotificacion(canal=TipoCanal.MENSAJERIA),
    )
    manolito = Mascota(
        numero_historia="HC-00481",
        nombre="Manolito",
        especie="Perro",
        raza="Criollo",
        sexo="Macho",
        fecha_nacimiento=hoy - timedelta(days=190),
        fotografia="demo/manolito.jpg",
        peso=Decimal("12.4"),
        estado_reproductivo="Entero",
        propietario=maria,
        alergias=[
            Alergia(
                descripcion="Penicilina",
                severidad="Alta",
                fecha_registro=hoy - timedelta(days=60),
            )
        ],
    )
    almendra = Mascota(
        numero_historia="HC-00355",
        nombre="Almendra",
        especie="Hámster",
        raza="Sirio",
        sexo="Hembra",
        fecha_nacimiento=hoy - timedelta(days=380),
        peso=Decimal("0.15"),
        propietario=maria,
    )
    luna = Mascota(
        numero_historia="HC-00502",
        nombre="Luna",
        especie="Gato",
        raza="Angora",
        sexo="Hembra",
        fecha_nacimiento=hoy - timedelta(days=740),
        peso=Decimal("3.8"),
        estado_reproductivo="Esterilizada",
        propietario=carlos,
    )
    sesion.add_all([maria, carlos, manolito, almendra, luna])

    consulta_general = Servicio(
        nombre="Consulta general",
        descripcion="Revisión clínica y plan de tratamiento.",
        duracion_estimada=30,
        precio=Decimal(45000),
    )
    vacunacion = Servicio(
        nombre="Vacunación",
        descripcion="Aplicación de biológicos según el esquema de la especie.",
        duracion_estimada=20,
        precio=Decimal(15000),
    )
    desparasitacion = Servicio(
        nombre="Desparasitación",
        descripcion="Control de parásitos internos y externos.",
        duracion_estimada=20,
        precio=Decimal(25000),
    )
    procedimientos = Servicio(
        nombre="Procedimientos menores",
        descripcion="Curaciones y procedimientos ambulatorios.",
        duracion_estimada=45,
        precio=Decimal(60000),
    )
    sesion.add_all([consulta_general, vacunacion, desparasitacion, procedimientos])

    polivalente = Producto(
        nombre="Vacuna polivalente",
        tipo=TipoProducto.VACUNA,
        laboratorio="Laboratorio Andino",
        precio_venta=Decimal(40000),
        stock_minimo=5,
    )
    antirrabica = Producto(
        nombre="Antirrábica",
        tipo=TipoProducto.VACUNA,
        laboratorio="Laboratorio Andino",
        precio_venta=Decimal(30000),
        stock_minimo=5,
    )
    omeprazol = Producto(
        nombre="Omeprazol 10 mg",
        tipo=TipoProducto.MEDICAMENTO,
        principio_activo="Omeprazol",
        precio_venta=Decimal(5000),
        stock_minimo=5,
    )
    amoxicilina = Producto(
        nombre="Amoxicilina 250 mg",
        tipo=TipoProducto.MEDICAMENTO,
        principio_activo="Amoxicilina (penicilina)",
        precio_venta=Decimal(8000),
        stock_minimo=5,
    )
    albendazol = Producto(
        nombre="Albendazol 200 mg",
        tipo=TipoProducto.MEDICAMENTO,
        principio_activo="Albendazol",
        precio_venta=Decimal(6000),
        stock_minimo=5,
    )
    sesion.add_all([polivalente, antirrabica, omeprazol, amoxicilina, albendazol])

    lote_polivalente = Lote(
        producto=polivalente,
        codigo="L-2391",
        cantidad_disponible=10,
        fecha_vencimiento=hoy + timedelta(days=17),
    )
    lotes = [
        lote_polivalente,
        # Vencido a propósito (D1).
        Lote(
            producto=omeprazol,
            codigo="L-1987",
            cantidad_disponible=2,
            fecha_vencimiento=hoy - timedelta(days=42),
        ),
        # Solo 3 unidades: pedir 5 muestra la existencia insuficiente (D2).
        Lote(
            producto=omeprazol,
            codigo="L-2481",
            cantidad_disponible=3,
            fecha_vencimiento=hoy + timedelta(days=116),
        ),
        Lote(
            producto=antirrabica,
            codigo="AR-1043",
            cantidad_disponible=8,
            fecha_vencimiento=hoy + timedelta(days=272),
        ),
        Lote(
            producto=amoxicilina,
            codigo="L-3010",
            cantidad_disponible=20,
            fecha_vencimiento=hoy + timedelta(days=200),
        ),
        Lote(
            producto=albendazol,
            codigo="L-1520",
            cantidad_disponible=15,
            fecha_vencimiento=hoy + timedelta(days=150),
        ),
    ]
    sesion.add_all(lotes)

    esquema_polivalente = EsquemaVacunacion(
        especie="Perro",
        biologico="Vacuna polivalente",
        producto=polivalente,
        numero_dosis=3,
        intervalo_dias=21,
    )
    sesion.add_all(
        [
            esquema_polivalente,
            EsquemaVacunacion(
                especie="Perro",
                biologico="Antirrábica",
                producto=antirrabica,
                numero_dosis=1,
                intervalo_dias=365,
            ),
            EsquemaVacunacion(
                especie="Perro",
                biologico="Desparasitación interna",
                producto=albendazol,
                numero_dosis=1,
                intervalo_dias=90,
            ),
            EsquemaVacunacion(
                especie="Gato",
                biologico="Antirrábica",
                producto=antirrabica,
                numero_dosis=1,
                intervalo_dias=365,
            ),
        ]
    )

    # Atención anterior de Manolito: ya cerrada y facturada (F-0006).
    dia_atencion = hoy - timedelta(days=14)
    atencion_anterior = Consulta(
        mascota=manolito,
        veterinario=veterinaria,
        fecha=a_las(dia_atencion, 10, 30),
        motivo="Control y vacunación",
        peso=Decimal("11.9"),
        temperatura=Decimal("38.4"),
        frecuencia_cardiaca=108,
        hallazgos="Mucosas rosadas, hidratación normal.",
        diagnostico="Paciente sano",
        plan_tratamiento="Desparasitación oral",
        estado=EstadoConsulta.CERRADA,
        cerrada_en=a_las(dia_atencion, 11, 0),
    )
    vacuna_aplicada = Vacunacion(
        consulta=atencion_anterior,
        esquema=esquema_polivalente,
        lote=lote_polivalente,
        fecha_aplicacion=dia_atencion,
        fecha_proxima_dosis=esquema_polivalente.calcular_proxima_dosis(dia_atencion),
    )
    sesion.add_all(
        [
            atencion_anterior,
            ServicioPrestado(consulta=atencion_anterior, servicio=consulta_general),
            vacuna_aplicada,
        ]
    )
    sesion.flush()
    sesion.add(
        MovimientoInventario(
            lote=lote_polivalente,
            consulta_id=atencion_anterior.id,
            tipo=TipoMovimiento.SALIDA_USO,
            cantidad=1,
            fecha=a_las(dia_atencion, 11, 0),
            saldo_resultante=10,
        )
    )
    factura = Factura(
        consecutivo=6,
        consulta=atencion_anterior,
        total=Decimal(85000),
        emitida_en=a_las(dia_atencion, 11, 5),
        detalles=[
            DetalleFactura(
                descripcion="Consulta general",
                tipo_item=TipoItemFactura.SERVICIO,
                cantidad=1,
                precio_unitario=Decimal(45000),
                subtotal=Decimal(45000),
            ),
            DetalleFactura(
                descripcion="Vacuna polivalente",
                tipo_item=TipoItemFactura.PRODUCTO,
                lote_id=lote_polivalente.id,
                cantidad=1,
                precio_unitario=Decimal(40000),
                subtotal=Decimal(40000),
            ),
        ],
        pagos=[Pago(medio=MedioPago.TRANSFERENCIA, valor=Decimal(85000))],
    )
    sesion.add(factura)
    sesion.flush()
    sesion.execute(text("SELECT setval('factura_consecutivo_seq', 6)"))

    # La próxima dosis cae en 7 días, así que el aviso queda programado para hoy (RF-49).
    sesion.add(
        Recordatorio(
            mascota_id=manolito.id,
            vacunacion_id=vacuna_aplicada.id,
            tipo=TipoRecordatorio.PROXIMA_DOSIS,
            fecha_programada=a_las(hoy, 9, 0),
        )
    )

    dia_cita = _siguiente_dia_habil(hoy)
    sesion.add_all(
        [
            Cita(
                mascota=manolito,
                servicio=consulta_general,
                veterinario=veterinaria,
                fecha_hora=a_las(hoy, 10, 30),
                estado=EstadoCitaValor.CONFIRMADA,
            ),
            Cita(
                mascota=almendra,
                servicio=consulta_general,
                veterinario=veterinaria,
                fecha_hora=a_las(dia_cita, 9, 0),
                estado=EstadoCitaValor.CONFIRMADA,
            ),
            Cita(
                mascota=luna,
                servicio=vacunacion,
                veterinario=veterinaria,
                fecha_hora=a_las(dia_cita, 11, 0),
                estado=EstadoCitaValor.PENDIENTE,
            ),
        ]
    )

    sesion.commit()
    return True


if __name__ == "__main__":
    with SesionLocal() as sesion_semilla:
        if sembrar(sesion_semilla):
            print(
                f"Datos de demostración creados. Contraseña de todos los usuarios: {CONTRASENA_DEMO}"
            )
        else:
            print("La base ya tiene datos; no se cambió nada.")
