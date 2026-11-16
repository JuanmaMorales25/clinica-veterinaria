# Clínica Veterinaria

Plataforma web para una clínica veterinaria: agenda en línea, historia clínica y vacunación,
inventario integrado con facturación y carné digital con recordatorios.

Proyecto del curso **Diseño de Sistemas de Información (580304012-4)**, Institución
Universitaria ITM. Equipo: Juan Manuel Morales Cartagena, Felipe Correa López y María José
Bolaños Guerra.

## Arquitectura

Monolito modular, tal como se definió en el Entregable 2 (modelo C4, nivel 2):

| Contenedor | Tecnología | Carpeta |
|---|---|---|
| Aplicación web | Angular 22 | `frontend/` |
| API de negocio | Python 3.13 + FastAPI | `backend/` |
| Base de datos | PostgreSQL 17 | `docker-compose.yml` |
| Programador de tareas | APScheduler dentro de la API | `backend/app/modulos/notificaciones/` |
| Servicio de correo (pruebas) | Mailpit | `docker-compose.yml` |

Patrones GoF del MVP: **Facade** (`CierreAtencionFacade`, HU-MVP-02 y 03), **State** (`Cita` y
`EstadoCita`, HU-MVP-01) y **Strategy** (`CanalNotificacion`, HU-MVP-04).

## Cómo correrlo

### Todo con Docker

```bash
docker compose up -d --build
```

| Servicio | URL |
|---|---|
| Aplicación web | http://localhost:8080 |
| API (documentación interactiva) | http://localhost:8000/docs |
| Bandeja de correos de prueba | http://localhost:8025 |
| PostgreSQL | `localhost:5435` (usuario, clave y base: `clinica`) |

La API aplica las migraciones y carga los datos de demostración al arrancar.

### Desarrollo (recarga en caliente)

Requisitos: [uv](https://docs.astral.sh/uv/), Node 24 o superior y pnpm.

```bash
docker compose up -d db mailpit          # base de datos y correo

cd backend
uv sync
uv run alembic upgrade head
uv run python -m app.semilla
uv run fastapi dev app/main.py           # http://localhost:8000

cd ../frontend
pnpm install
pnpm start                               # http://localhost:4200
```

Pruebas y estilo:

```bash
cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check .
cd frontend && pnpm build
```

## Usuarios de demostración

Todos usan la contraseña `Clinica2026*`.

| Rol | Correo |
|---|---|
| Administrador | admin@clinica.veterinaria.com |
| Veterinaria (Dra. Ramírez) | dra.ramirez@clinica.veterinaria.com |
| Auxiliar / recepción | recepcion@clinica.veterinaria.com |
| Propietaria (María Gómez) | maria.gomez@correo.com |

Mascotas: **Manolito** (perro, HC-00481, alergia a la penicilina), **Almendra** (hámster,
HC-00355) y **Luna** (gata, HC-00502, de un propietario sin cuenta para probar la vinculación
por número de historia).

## Organización del equipo

El reparto del trabajo, las convenciones y el detalle de cada flujo están en
[`docs/GUIA_EQUIPO.md`](docs/GUIA_EQUIPO.md).
