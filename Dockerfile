# ---- Java Interview Hub: small, production-ready Node image ----
# Node 22 is required for the built-in node:sqlite module (progress persistence).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

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
COPY package.json server.js db.js auth.js ./
COPY public ./public

USER app
EXPOSE 3030
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:3030/health || exit 1

CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
