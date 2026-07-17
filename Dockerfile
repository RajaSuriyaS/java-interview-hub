# ---- Java Interview Hub: small, production-ready Node image ----
# Node 22 is required for the built-in node:sqlite module (progress persistence).

# ---- deps: production-only node_modules ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# ---- assets: build the purged, minified Tailwind stylesheet ----
# Runs the JIT once at build time so the browser never loads the CDN engine.
FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY tailwind.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build:css

# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3030
# SQLite database location — mount a volume here so progress survives redeploys.
ENV DATA_DIR=/data

# non-root user + writable data dir
RUN addgroup -S app && adduser -S app -G app \
 && mkdir -p /data && chown app:app /data

COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js db.js auth.js billing.js challenges.mjs ai.mjs ./
COPY scripts ./scripts
COPY public ./public
# Overwrite the tracked stylesheet with the freshly built one.
COPY --from=assets /app/public/css/tailwind.css ./public/css/tailwind.css

USER app
EXPOSE 3030
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:3030/health || exit 1

CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
