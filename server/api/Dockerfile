FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# su-exec: tiny helper to drop privileges from root → app after
# the entrypoint has read files only root can see (Docker secrets).
RUN apk add --no-cache su-exec

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
 && addgroup -S app \
 && adduser -S -G app app \
 && chown -R app:app /app

EXPOSE 8080
# IMPORTANT: do NOT set USER here — the entrypoint starts as root
# so it can read /run/secrets/*, then exec's node as "app".
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
