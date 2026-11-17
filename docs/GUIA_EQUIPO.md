# Guía del equipo — Entrega 3

Este documento reúne lo necesario para construir el prototipo sin pisarnos: qué se entrega,
quién hace qué, cómo está organizado el código y qué reglas seguimos. Si algo no está aquí,
manda el Entregable 2 y el Figma.

## 1. Qué se entrega

**Entrega 3 — 19/11/2026 (20 %).** Prototipo funcional con backend, frontend y base de datos,
**con flujos alternos**, representación UML de artefactos estáticos y dinámicos, y
sustentación oral.

- El prototipo cubre las cuatro historias del MVP del Entregable 2.
- Se implementan **los 16 flujos alternos** que están diseñados en el Figma (A1–A4, B1–B2,
  C1–C4, D1–D4, E1–E2), no solo los principales.
- El sistema queda **desplegado** en internet. El diagrama de despliegue lo hace María José
  y debe coincidir con lo que realmente se publique (ver sección 9).

Fuentes de verdad:

- **Entregable 2**: arquitectura C4, diagramas de clases (figuras 4a y 4b), diagramas de
  actividades, patrones y análisis SOLID.
- **Figma**: <https://www.figma.com/design/pYzOhSvEfTj1guWO3aJ43n/Clinica-Veterinaria>.
  Página 1 = pantallas; página 2 = guía del prototipo (cómo se activa cada flujo alterno).

## 2. Reparto

Se divide **por historia**, con backend y frontend completos para cada quien, para que cada
uno defienda sus propios patrones en la sustentación. Quedan 17 pantallas para cada uno.

### Juanma — HU-MVP-02 y HU-MVP-03 (patrón Facade)

| Pantalla | Nodo Figma |
|---|---|
| M2.1 Buscar paciente | `151:268` |
| M2.2 Ficha consolidada del paciente | `151:311` |
| M2.3 Registrar consulta | `152:128` |
| M2.4 Prescripción habilitada | `152:193` |
| M2.5 Registrar vacunación | `152:256` |
| M2.6 Registro clínico cerrado | `152:307` |
| M3.1 Cuenta de cobro | `152:355` |
| M3.2 Registrar pago | `153:158` |
| M3.3 Comprobante emitido | `153:196` |
| C1 Alergia bloquea la prescripción | `140:311` |
| C2 Omitir alerta con motivo | `140:383` |
| C3 Borrador recuperado (pérdida de conexión) | `140:463` |
| C4 Corrección de un registro cerrado | `140:528` |
| D1 Lote vencido | `140:583` |
| D2 Existencia insuficiente | `140:635` |
| D3 Falla en la transacción (reversa total) | `143:75` |
| D4 Anulación de factura con motivo | `143:118` |

Además: la base del proyecto (estructura, modelos, migraciones, datos de demostración,
autenticación, estilos) y el despliegue.

### Pipe — Acceso, HU-MVP-01 y HU-MVP-04 (patrones State y Strategy)

| Pantalla | Nodo Figma |
|---|---|
| Página principal | `6:2886` |
| Iniciar Sesión | `36:5` |
| Registrarse | `43:57` |
| Agenda tu cita (elegir mascota) | `6:2687` |
| M1.1 Elegir servicio | `151:101` |
| M1.2 Elegir fecha y hora | `151:147` |
| M1.3 Solicitud enviada (pendiente) | `151:237` |
| M4.1 Carné digital de la mascota | `153:238` |
| M4.2 Preferencias de notificación | `153:312` |
| A1 Credenciales incorrectas | `140:82` |
| A2 Cuenta bloqueada (5 intentos) | `140:121` |
| A3 Recuperar contraseña (enlace enviado) | `140:145` |
| A4 Sesión expirada (30 min) | `140:167` |
| B1 Horario no disponible | `140:191` |
| B2 Número de historia inválido | `140:282` |
| E1 Enlace QR vencido o inválido | `143:167` |
| E2 Recordatorios desactivados | `143:193` |

Además: el programador de tareas que envía los recordatorios y una lista sencilla para que el
personal confirme las citas pendientes (RN-10). Esa lista no está en el Figma; basta con una
tabla con botones Confirmar y Cancelar en `/personal/citas`.

### María José

Diagrama de despliegue (sección 9).

## 3. Estructura del código

```
backend/
  app/
    core/            configuración, base de datos, seguridad, errores, unidad de trabajo
    modulos/
      acceso/        usuarios, inicio de sesión                       (Pipe)
      pacientes/     propietarios, mascotas, alergias                  (compartido)
      agenda/        servicios y citas — patrón State                  (Pipe)
      atencion/      consulta, vacunación, prescripción                (Juanma)
      inventario/    productos, lotes, movimientos                     (Juanma)
      facturacion/   factura, pago, CierreAtencionFacade               (Juanma)
      carne/         enlace firmado y código QR                        (Pipe)
      notificaciones/ recordatorios — patrón Strategy                  (Pipe)
      auditoria/     registro de quién hizo qué                        (compartido)
    modelos.py       importa todos los modelos (Alembic los necesita)
    semilla.py       datos de demostración
    main.py          crea la API y registra los routers
  alembic/           migraciones
  tests/
frontend/
  src/app/
    core/            sesión, interceptor, guardias por rol, errores de la API
    compartido/      encabezado, estado-etiqueta, aviso
    funcionalidades/
      acceso/  inicio/  agenda/  carne/                                (Pipe)
      atencion/  facturacion/                                          (Juanma)
```

Cada módulo del backend sigue el mismo esquema de archivos:

| Archivo | Contenido |
|---|---|
| `modelos.py` | Tablas (SQLAlchemy). **Ya están todas creadas.** |
| `esquemas.py` | Entradas y salidas de la API (Pydantic). |
| `repositorio.py` | Interfaz `RepositorioX` y su implementación con SQLAlchemy. |
| `servicio.py` | Reglas de negocio. Recibe repositorios por constructor. |
| `rutas.py` | `router = APIRouter(prefix="/<modulo>")`. Se registra en `app/main.py`. |

Cada pantalla del frontend es un componente independiente con carga diferida. Las rutas ya
existen en `app.routes.ts` apuntando a `enConstruccion(...)`: al terminar una pantalla, se
cambia esa línea por el `loadComponent` real.

### Piezas compartidas que ya existen

Antes de crear algo parecido, revisar si ya está:

| Pieza | Dónde | Para qué |
|---|---|---|
| `RepositorioMascota` | `backend/app/modulos/pacientes/repositorio.py` | Buscar y obtener mascotas con propietario y alergias. Se le pueden agregar métodos. |
| `Mascota.describir_edad(hoy)` | `pacientes/modelos.py` | Edad legible: "6 meses", "1 año". |
| `ProgramadorRecordatorios` | `backend/app/modulos/notificaciones/programador.py` | Interfaz del Entregable 2. `ProgramadorRecordatoriosBD` deja el aviso de la próxima dosis en la tabla `recordatorio` al cerrar la atención; el programador de tareas solo tiene que enviar los que estén `PROGRAMADO` y vencidos, respetando la preferencia del propietario (E2). |
| `enviar_correo(destinatario, asunto, cuerpo, adjuntos)` | `backend/app/core/correo.py` | Envío de correo listo para `CanalCorreo`: en local va por SMTP a Mailpit y en el despliegue por la API HTTP de Mailpit (`CORREO_API_URL`). Lo usa el comprobante de la factura. |
| Errores de validación | `app/main.py` | Los datos inválidos también responden `{codigo: "DATOS_INVALIDOS", mensaje, detalle: {campos}}`. |
| `/api/salud` | `app/main.py` | Devuelve `modo_demo` para que el frontend sepa si las teclas 1–5 están activas. |
| `/api/demo/...` | `app/core/demo.py` | Endpoints de las fallas provocadas. Solo responden con `MODO_DEMO=true`. |
| `escucharTeclaDemo(tecla, accion)` | `frontend/src/app/core/demo/demo.service.ts` | Registra una tecla de demostración en el constructor del componente. Ya se usa con la 2 (M2.1) y la 3 (C3). |
| `cv-tarjeta-paciente` | `frontend/src/app/compartido/tarjeta-paciente/` | Ficha del paciente en variante completa o compacta. |
| `cv-dialogo` | `frontend/src/app/compartido/dialogo/` | Ventana modal sobre fondo atenuado (`<dialog>` nativo). |
| `cv-estado-etiqueta`, `cv-aviso` | `frontend/src/app/compartido/` | Tipos `exito`, `alerta`, `advertencia`, `info` (morado, reloj de arena) y `neutro` (gris, candado). Aceptan `icono` para cambiar el icono. |
| Clases globales | `frontend/src/styles.scss` | `.titulo-pagina`, `.tarjeta__encabezado`, `.entrada--destacada`, `.entrada--solo-lectura`, `.ayuda`, `select.entrada`. |

## 4. Nombres que deben coincidir con el Entregable 2

El profesor va a comparar el código con los diagramas. Usar estos nombres tal cual:

| Módulo | Clases e interfaces |
|---|---|
| Facturación (Facade) | `CierreAtencionFacade.facturar_atencion(id_consulta, usuario)`, `ServicioFacturacion`, `GeneradorCuenta` (interfaz), `RepositorioFactura` |
| Atención | `ServicioAtencion`, `ServicioVacunacion`, `RepositorioConsulta` |
| Inventario | `ServicioInventario`, `DescuentoInventario`, `ConsultaExistencias`, `RepositorioLote`, `ReglaDispensacion`, `ReglaLoteVigente` (RN-04), `ReglaExistenciaSuficiente` (RN-06) |
| Transversal | `UnidadDeTrabajo` (`app/core/unidad_de_trabajo.py`), `RegistroAuditoria` (`app/modulos/auditoria/servicio.py`) |
| Agenda (State) | `Cita`, `EstadoCita` (interfaz), `CitaPendiente`, `CitaConfirmada`, `CitaAtendida`, `CitaCancelada`, `CitaNoAsistida`, error `TransicionNoPermitida` |
| Notificaciones (Strategy) | `ServicioNotificaciones`, `CanalNotificacion` con `enviar(propietario, mensaje)`, `CanalCorreo`, `CanalMensajeria`, `ProgramadorRecordatorios` (interfaz) |

Los ajustes que pidió el análisis SOLID ya van incluidos: `enviar(propietario, mensaje)` en vez
de `enviar(destinatario, mensaje)`, el error `TransicionNoPermitida`, y las interfaces
`GeneradorCuenta` y `ProgramadorRecordatorios`.

En la base de datos, el estado de la cita es una columna de texto (`EstadoCita` en
`agenda/modelos.py`). El patrón State se arma en el servicio: según el valor de la columna se
crea el objeto de estado y la cita le delega `confirmar()`, `cancelar()`, `marcar_atendida()` y
`marcar_no_asistida()`.

## 5. Flujos alternos: códigos de error

Toda regla incumplida se lanza con `ErrorDeNegocio(codigo, mensaje, estado_http, detalle)` y la
API responde `{"codigo", "mensaje", "detalle"}`. El frontend lee el `codigo` con `leerErrorApi()`
y muestra la pantalla del flujo alterno que corresponde. Códigos acordados:

| Flujo | Código | Estado HTTP | `detalle` |
|---|---|---|---|
| A1 | `CREDENCIALES_INCORRECTAS` | 401 | `intentos_restantes` |
| A2 | `CUENTA_BLOQUEADA` | 423 | — |
| A4 | `SESION_EXPIRADA` | 401 | — (ya lo maneja el interceptor) |
| B1 | `HORARIO_NO_DISPONIBLE` | 409 | `horarios_sugeridos` |
| B2 | `HISTORIA_NO_ENCONTRADA` | 404 | — |
| C1 | `ALERGIA_SIN_REVISAR` | 409 | `alergias` |
| C4 | `REGISTRO_CERRADO` | 409 | — |
| D1 | `LOTE_VENCIDO` | 409 | `producto`, `lote`, `fecha_vencimiento` |
| D2 | `EXISTENCIA_INSUFICIENTE` | 409 | `producto`, `disponible`, `solicitado` |
| D3 | `FALLA_TRANSACCION` | 500 | — |
| E1 | `ENLACE_VENCIDO` / `ENLACE_INVALIDO` | 410 / 404 | — |

A3 (recuperar contraseña) siempre responde que el enlace se envió, exista o no el correo, para
no revelar qué cuentas existen. C2, C3, D4 y E2 no son errores: son acciones con su propia
pantalla.

### Fallas que se provocan para la demostración

La página 2 del Figma asigna teclas para mostrar las fallas que no ocurren solas. Se mantienen
las mismas teclas en el prototipo, activas solo con `MODO_DEMO=true`:

| Tecla | Pantalla | Resultado |
|---|---|---|
| 1 | Inicio de sesión | A1 (y A2 al repetir). En el prototipo también ocurre de verdad con una contraseña errada. |
| 2 | Panel del personal (M2.1) | A4: vence la sesión al instante. |
| 3 | Registrar consulta | C3: simula la pérdida de conexión y recupera el borrador. |
| 4 | Registrar pago | D3: la API falla a mitad de la transacción y revierte todo. |
| 5 | Carné digital | E1: genera un enlace QR ya vencido. |

Los demás alternos salen de la operación normal, como dice la guía del Figma: "+ Agregar
Mascota" → B2, horario 10:00 → B1, "Prescribir medicamento" → C1/C2, nota aclaratoria → C4,
lote o cantidad en la cuenta de cobro → D1/D2, "Anular factura" → D4, interruptor de
recordatorios → E2.

## 6. Autenticación

- `POST /api/acceso/login` devuelve `{token, usuario}`. El token dura 30 minutos.
- Cada respuesta autenticada trae la cabecera `X-Token-Renovado` y el interceptor la guarda,
  así que la sesión vence por **inactividad** (A4), no por tiempo total.
- Backend: proteger rutas con `Depends(requiere_rol(Rol.VETERINARIO, ...))` o
  `Depends(obtener_usuario_actual)`.
- Frontend: `canActivate: [requiereRol('PROPIETARIO')]`. El personal entra a `/personal/pacientes`
  y el propietario a `/propietario`.
- El login actual es la versión mínima. Pipe le agrega el conteo de intentos, el bloqueo, la
  recuperación y el registro.

## 7. Notificaciones

- **Correo**: se envía con `enviar_correo()` de `app/core/correo.py`. En local va por SMTP a
  Mailpit, que lo atrapa y lo muestra en <http://localhost:8025>; en el despliegue sale por la
  API HTTP del Mailpit publicado. Así se ve en la demostración sin enviar correos reales.
- **Mensajería**: canal simulado. No llama a ningún servicio; guarda cada envío en la tabla
  `mensaje_enviado`.
- Los dos canales implementan `CanalNotificacion` (Strategy) y quedan intercambiables.
- La tabla `recordatorio` ya existe. La semilla deja uno programado para hoy (próxima dosis de
  Manolito en 7 días), para mostrar el envío en la sustentación.

## 8. Base de datos y migraciones

- Todos los modelos ya están creados y migrados. Si hace falta un campo o una tabla nueva:
  1. `git pull` primero, para no crear dos migraciones en paralelo.
  2. Cambiar el modelo y correr `uv run alembic revision --autogenerate -m "descripcion"`.
  3. Revisar el archivo generado y aplicarlo con `uv run alembic upgrade head`.
  4. Avisar en el grupo, porque el otro tiene que hacer `git pull` y `alembic upgrade head`.
- Fechas con zona horaria (`America/Bogota`); usar `ahora()` de `app/core/db.py`.
- Dinero en `Numeric(12, 2)`; en el frontend se muestra con `currency` y la configuración
  regional `es-CO`.

## 9. Despliegue (para el diagrama de María José)

El sistema se publica en **Render** (plan gratuito, región Oregón, EE. UU.) con el archivo
`render.yaml` de la raíz. Son las mismas piezas del `docker-compose.yml`:

| Nodo | Servicio en Render | Qué corre (artefacto) | URL pública | Se comunica con |
|---|---|---|---|---|
| Dispositivo del usuario (PC o celular) | — | Navegador con la aplicación Angular | — | Servidor web y API por HTTPS |
| Servidor web | Static Site `clinica-veterinaria-itm` (CDN de Render) | Archivos estáticos de Angular 22 (`frontend/dist/frontend/browser`) | https://clinica-veterinaria-itm.onrender.com | — |
| Servidor de aplicación | Web Service Docker `clinica-veterinaria-itm-api` | Contenedor `python:3.13-slim` con FastAPI + Uvicorn y el programador de tareas (APScheduler) (`backend/Dockerfile`) | https://clinica-veterinaria-itm-api.onrender.com | Base de datos por TCP 5432 en la red privada de Render; correo por HTTPS (API de Mailpit) |
| Servidor de base de datos | PostgreSQL 17 `clinica-veterinaria-itm-db` | Base de datos `clinica` | Solo red privada | — |
| Servicio de correo (pruebas) | Web Service con imagen `axllent/mailpit:v1.33` (`clinica-veterinaria-itm-correo`) | Bandeja web de los correos enviados | https://clinica-veterinaria-itm-correo.onrender.com (pide usuario y clave) | — |

Protocolos: HTTPS (TLS) entre el navegador y Render, REST/JSON entre Angular y la API, TCP 5432
entre la API y PostgreSQL. En local es lo mismo con Docker Compose: nginx en el puerto 8080, API
en el 8000, PostgreSQL en el 5435 y Mailpit en el 8025 (SMTP 1025).

Para tener en cuenta en la sustentación:

- Los servicios gratuitos se duermen tras 15 minutos sin uso y tardan cerca de un minuto en
  despertar: abrir la aplicación y la bandeja de correo un par de minutos antes.
- La base de datos gratuita vence 30 días después de creada; alcanza de sobra para la entrega.
- Al arrancar, la API aplica las migraciones y carga los datos de demostración si la base está
  vacía.

## 10. Forma de trabajo con Git

- Nadie sube directo a `main`. Cada historia va en su rama: `hu-01-citas`, `hu-02-atencion`,
  `hu-03-facturacion`, `hu-04-carne`, `acceso`.
- Pull request hacia `main` cuando la historia funcione. El otro la revisa y la integra.
- Antes de abrir el PR: `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .`
  y `pnpm build` sin errores.
- Mensajes de commit en español, en presente y cortos (por ejemplo: "Agrega el patrón State a
  la cita"). Cada uno firma con su propio usuario de Git, sin líneas de coautoría ni firmas
  automáticas.
- El código y los comentarios no mencionan las herramientas con las que se escribieron. Los
  comentarios explican el porqué de una regla (por ejemplo, "RN-04: no se dispensa un lote
  vencido"), no lo obvio.
- No se suben archivos de configuración personales del editor ni de otras herramientas.

## 11. Plan

| Día | Juanma | Pipe | María José |
|---|---|---|---|
| Lun 16 | Base del proyecto y repo | Revisar la guía y montar el entorno | Borrador del diagrama |
| Mar 17 | HU-02 y HU-03 con sus alternos | Acceso, HU-01 y HU-04 con sus alternos | Ajustar el diagrama al despliegue real |
| Mié 18 | Integración, despliegue y ensayo | Integración y ensayo | Diagrama final |
| Jue 19 | **Entrega y sustentación** | | |
