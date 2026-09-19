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

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache wget
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/api/package.json api/package.json
COPY --from=build /app/api/prisma api/prisma
COPY --from=build /app/api/prisma.config.ts api/prisma.config.ts
COPY --from=build /app/api/dist api/dist
COPY api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "api/dist/main.js"]
