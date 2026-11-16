FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.13 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

EXPOSE 8000

# Aplica migraciones, carga los datos de demostración si la base está vacía y arranca la API.
CMD ["sh", "-c", "alembic upgrade head && python -m app.semilla && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
