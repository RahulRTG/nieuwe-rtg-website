# RTG / RTFoundation productie-image.
# Node 22 (nodig voor --experimental-sqlite en de ingebouwde test-runner).
FROM node:22-slim

# Alleen productie-afhankelijkheden; de dev-tools (terser, axe) horen niet in de
# runtime-image. npm ci is reproduceerbaar op basis van de lockfile.
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# De rest van de broncode.
COPY . .

# Data en back-ups op een volume, zodat ze een herbouw van de container
# overleven. De niet-root gebruiker 'node' moet erin kunnen schrijven.
RUN mkdir -p /app/server/data && chown -R node:node /app/server/data
VOLUME ["/app/server/data"]

# Nooit als root draaien.
USER node

EXPOSE 3000

# Container-gezondheid: de load balancer/orchestrator gebruikt /api/health.
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# server.js herstart zichzelf met --experimental-sqlite; direct starten kan ook.
CMD ["node", "--experimental-sqlite", "server/server.js"]
