FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api ./apps/api
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared ./packages/shared

# Ensure TypeScript base config is available for workspace package builds
COPY tsconfig.base.json ./

RUN npm ci
RUN npm run build -w packages/shared && npm run build -w apps/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
# The generated .sql migrations are runtime assets: the container applies them on
# startup via dist/db/migrate.js, which needs only drizzle-orm, not drizzle-kit.
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["npm", "start"]
