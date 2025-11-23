FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# build de Vite (usa tu configuración)
RUN npm run build

EXPOSE 5173

# Servimos el build con vite preview en el puerto 5173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
