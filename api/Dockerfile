FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src
ENV DATABASE_URL=postgresql://build:build@localhost:5432/bicycle
RUN npx prisma generate && npm run build \
  && npm prune --omit=dev \
  && npm install --no-save --omit=dev prisma@6.19.3 \
  && npx prisma generate

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
