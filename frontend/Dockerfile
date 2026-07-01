# Etapa 1: Compilación de Vite/React
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar dependencias primero para aprovechar la caché de Docker
COPY package*.json ./
# Configurar reintentos por si hay cortes de internet y usar npm ci (más rápido y seguro en Docker)
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --network-timeout=1000000

# Copiar el resto del código y compilar para producción
COPY . .
RUN npm run build

# Etapa 2: Servidor Nginx
FROM nginx:alpine

# Eliminar la configuración default de Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar la configuración personalizada
COPY nginx.conf /etc/nginx/conf.d/

# Copiar los archivos compilados desde la etapa 1
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
