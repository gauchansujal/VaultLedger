# --- Build stage ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# --- Production stage ---
FROM node:20-alpine AS production

# Run as a non-root user - reduces blast radius if the container is ever compromised
RUN addgroup -S vaultledger && adduser -S vaultledger -G vaultledger

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER vaultledger

EXPOSE 5000

# Basic healthcheck so orchestrators (Docker Compose, Kubernetes, etc.) know when the
# container is actually ready to serve traffic, not just "process started"
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
