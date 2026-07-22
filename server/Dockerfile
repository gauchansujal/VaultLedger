# --- Build stage ---
FROM node:20-slim AS build

WORKDIR /app

# argon2's prebuilt binary doesn't match every platform/Node ABI combination, so it may
# fall back to compiling from source here too - same reasoning as the production stage below.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# --- Production stage ---
FROM node:20-slim AS production

# Run as a non-root user - reduces blast radius if the container is ever compromised
RUN groupadd -r vaultledger && useradd -r -g vaultledger vaultledger

WORKDIR /app

# argon2's prebuilt binary doesn't match every possible platform/Node ABI combination,
# so it may fall back to compiling from source - these are node-gyp's build requirements.
# Unlike Alpine, node:slim's glibc headers are already present, so this compiles locally
# without needing to download anything extra over the network.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Build tools are no longer needed after native modules are compiled - remove them to
# keep the final image smaller and reduce attack surface.
RUN apt-get purge -y python3 make g++ && apt-get autoremove -y

COPY --from=build /app/dist ./dist

# Pre-create the uploads directory and hand ownership to the non-root user - the app
# writes avatar files here at runtime (see user.controller.ts), and without this the
# non-root USER below would lack permission to create it itself.
RUN mkdir -p uploads/avatars && chown -R vaultledger:vaultledger uploads

USER vaultledger

EXPOSE 5000

# Basic healthcheck so orchestrators (Docker Compose, Kubernetes, etc.) know when the
# container is actually ready to serve traffic, not just "process started"
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
