FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web ./apps/web
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/prisma ./apps/api/prisma
COPY packages/shared ./packages/shared

# Ensure TypeScript base config is available for workspace package builds
COPY tsconfig.base.json ./

RUN npm ci

# Baked into the build, not read at runtime: Next inlines NEXT_PUBLIC_* into the
# bundle and serializes next.config.js rewrites into the routes manifest during
# `next build`. Inside Compose the API is reachable as `api:4000`, not localhost.
ARG NEXT_PUBLIC_API_URL=http://api:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build -w packages/shared && npm run build -w apps/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/next.config.js ./apps/web/next.config.js
COPY --from=build /app/apps/web/.next ./apps/web/.next

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "start"]
