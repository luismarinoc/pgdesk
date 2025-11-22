# Etapa 1: Build con Node
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Etapa 2: Servir con Nginx
FROM nginx:alpine

# Borramos el contenido por defecto de Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copiamos el build Vite (dist)
COPY --from=build /app/dist /usr/share/nginx/html

# Archivo de configuración para SPA (si lo necesitas más adelante)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
