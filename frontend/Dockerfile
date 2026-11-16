FROM node:24-alpine AS construccion

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# URL pública de la API; se fija al construir la imagen.
ARG API_URL=http://localhost:8000/api
RUN sed -i "s|http://localhost:8000/api|${API_URL}|" src/environments/environment.ts \
    && pnpm build

FROM nginx:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=construccion /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80
