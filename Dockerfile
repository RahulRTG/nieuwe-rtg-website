# Bouw de Rust-motor los van de kleine Node-runtime-image. Cargo gebruikt het
# vastgezette Cargo.lock; de uiteindelijke container krijgt alleen de binary.
FROM rust:1.97-slim AS motor-builder
WORKDIR /src/motor
COPY motor/Cargo.toml motor/Cargo.lock ./
COPY motor/src ./src
RUN cargo test --release --locked && cargo build --release --locked

# RTG / RTFoundation productie-image.
# Node 22 (nodig voor --experimental-sqlite en de ingebouwde test-runner).
FROM node:22-slim

# Alleen productie-afhankelijkheden; de dev-tools (terser, axe) horen niet in de
# runtime-image. npm ci is reproduceerbaar op basis van de lockfile.
ENV NODE_ENV=production
# Threadpool voor scrypt (wachtwoord-hashing): server.js zet hem standaard op
# het aantal CPU-kernen van de host. Alleen expliciet zetten als je wilt afwijken:
#   docker run -e UV_THREADPOOL_SIZE=8 ...
WORKDIR /app

COPY package.json package-lock.json ./
# Het project heeft GEEN afhankelijkheden (ook de minifier is eigen code), dus
# dit installeert niets. We doen het toch: npm ci faalt als de lockfile en
# package.json uit elkaar lopen, en dat is precies de bewaking die we willen.
RUN npm ci && npm cache clean --force

# De rest van de broncode.
COPY . .
COPY --from=motor-builder /src/motor/target/release/rtg-motor /app/rtg-motor

# Frontend-build: minify de serveerbare JS naar public/dist/min en stempel de
# service-worker caches. Alles met eigen scripts, dus niets om achteraf te
# snoeien.
RUN npm run build

# Data en back-ups op een volume, zodat ze een herbouw van de container
# overleven. De niet-root gebruiker 'node' moet erin kunnen schrijven.
RUN mkdir -p /app/server/data /app/motor-data && chown -R node:node /app/server/data /app/motor-data /app/rtg-motor
VOLUME ["/app/server/data"]

# Nooit als root draaien.
USER node

EXPOSE 3000 3100

# Container-gezondheid: de load balancer/orchestrator gebruikt /api/health.
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# server.js herstart zichzelf met --experimental-sqlite; direct starten kan ook.
CMD ["node", "--experimental-sqlite", "server/server.js"]
