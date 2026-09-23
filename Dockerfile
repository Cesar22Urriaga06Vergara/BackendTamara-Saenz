# ---- build ----
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
# Solo dependencias de producción. `typeorm` (CLI), `mysql2`, `dotenv` y `reflect-metadata`
# están en "dependencies", así que `npm run deploy:migrate` funciona sin devDependencies.
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 3010
# Ejecuta migraciones pendientes contra Aiven antes de levantar la API. Si una migración falla,
# el contenedor no arranca y Render muestra el error en el deploy en vez de servir un esquema parcial.
CMD ["npm", "run", "start:prod"]
