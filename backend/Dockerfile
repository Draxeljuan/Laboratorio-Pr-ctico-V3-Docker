# Usar una imagen ligera de Node.js
FROM node:22-alpine

# Crear y establecer el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/drogueria

# Copiar primero los archivos de dependencias para aprovechar la caché de Docker
COPY package*.json pnpm-lock.yaml* ./

# Habilitamos Corepack e instalamos pnpm de forma segura
RUN corepack enable && corepack prepare pnpm@11.4.0 --activate

# Instalar las dependencias de producción
RUN pnpm install 

# Copiar el resto del código fuente del backend
COPY . .

# Exponer el puerto en el que escuchará Express
EXPOSE 3000

# Comando para arrancar la aplicación
CMD ["pnpm", "start"]