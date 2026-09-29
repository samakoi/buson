# Imagem da API do Bus On (produção e staging). Usada pelo deploy/docker-compose.yml.
# Etapa 1: instala tudo e compila o TypeScript
FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Etapa 2: só o necessário para rodar (sem código-fonte nem ferramentas de desenvolvimento)
FROM node:24-bookworm-slim
# openssl: Prisma | mysql-client + tar: backups
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl default-mysql-client tar \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    UPLOADS_DIR=/app/uploads \
    BACKUP_DIR=/backups \
    TZ=America/Fortaleza \
    CHECKPOINT_DISABLE=1
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /app/uploads /backups && chown node:node /app/uploads /backups
ARG APP_VERSAO=dev
ENV APP_VERSAO=$APP_VERSAO
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3333)+'/api/v1/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
