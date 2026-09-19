# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN npm ci --ignore-scripts

FROM deps AS build
COPY api api
RUN npm run prisma:generate -w api && npm run build -w api

# Runtime dependencies only. Without this the image carries jest, eslint, typescript and
# testcontainers, which have no business in a production image.
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
# `--ignore-scripts` leaves the Prisma engines to be fetched on first use, which a non-root
# container cannot write and an offline one cannot reach. Resolve them here, as root, at build.
RUN npm ci --omit=dev --ignore-scripts && npx prisma --version

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/api/package.json api/package.json
COPY --from=build /app/api/prisma api/prisma
COPY --from=build /app/api/prisma.config.ts api/prisma.config.ts
COPY --from=build /app/api/dist api/dist
COPY api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "api/dist/main.js"]
