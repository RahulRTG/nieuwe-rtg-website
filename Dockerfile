# syntax=docker/dockerfile:1.7
# Bouw de Rust-motor los van de kleine Node-runtime-image. Cargo gebruikt het
# vastgezette Cargo.lock; de uiteindelijke container krijgt alleen de binary.
FROM rust:1.98-slim@sha256:17d1ba895198f9934c6314ec5346a0d5115372f3243390c3d731e242f35c2f27 AS motor-builder
WORKDIR /src/motor
COPY motor/Cargo.toml motor/Cargo.lock ./
COPY motor/src ./src
# De tests draaien vóór publicatie in CI en in de repositorykeuring. Een image-
# rebuild hoeft ze niet bij iedere bronwijziging opnieuw te compileren. De twee
# caches maken ook een koude dependencyronde herbruikbaar zonder in de runtime
# terecht te komen.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/src/motor/target \
    cargo build --release --locked && \
    cp /src/motor/target/release/rtg-motor /tmp/rtg-motor && \
    cp /src/motor/target/release/rtg-sentinel /tmp/rtg-sentinel

# De back-upsidecar gebruikt pg_dump uit het officiële PostgreSQL-image en
# alleen de OpenSSL-CLI extra. Daarmee kan hij naar een publieke sleutel
# versleutelen zonder ooit de offline privésleutel te bezitten.
FROM postgres:18-alpine@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2 AS backup-runtime
RUN apk add --no-cache openssl
COPY scripts/docker/backup.sh /usr/local/bin/rtg-backup
COPY scripts/docker/herstel.sh /usr/local/bin/rtg-herstel
RUN chmod 0555 /usr/local/bin/rtg-backup /usr/local/bin/rtg-herstel

# RTG / RTFoundation productie-image.
# Node 26: dezelfde major als CI draait, zodat de GELEVERDE runtime ook de
# beproefde is. node:sqlite laadt hier zonder vlag (dat is zo sinds 22.13,
# vandaar dat --experimental-sqlite uit de hele boom is); de ondergrens staat
# in package.json (engines) en wordt afgedwongen in server/server.js, vóór
# het eerste require.
FROM node:26-slim@sha256:c0753125a3789977aefe869cbebccf70e3cfd7ea84ca48547458f02e4f1d7146

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
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# Alleen expliciete, door het inhoudsbewijs gekende bron. `COPY . .` nam ook
# ontwerpbestanden, lokale artefacten en ongehashte rootregisters mee; dan kon
# de runtime veranderen zonder dat Sentinel het zag. Root-JSON wordt hieronder
# bewust volledig meegenomen en door release-bewijs.js volledig gehasht.
COPY server ./server
COPY public ./public
COPY scripts ./scripts
COPY motor/Cargo.toml motor/Cargo.lock ./motor/
COPY motor/src ./motor/src
COPY deploy ./deploy
COPY *.json ./
COPY index.html Dockerfile .dockerignore docker-compose.yml docker-compose.live.yml .env.example ./
COPY VERWERKINGSREGISTER.md DATALEK.md ./
COPY --from=motor-builder /tmp/rtg-motor /app/rtg-motor
COPY --from=motor-builder /tmp/rtg-sentinel /app/rtg-sentinel

# Frontend-build: minify de serveerbare JS naar public/dist/min en stempel de
# service-worker caches. Alles met eigen scripts, dus niets om achteraf te
# snoeien.
RUN npm run build

# Inhoudsbewijs in het image: na uitrol kan exact worden gecontroleerd welke
# Node-bron, frontend-build en Rust-binary deze container draagt.
ARG RTG_RELEASE_COMMIT
RUN node -e "if(!/^[a-f0-9]{40,64}$/i.test(process.env.RTG_RELEASE_COMMIT||''))throw Error('RTG_RELEASE_COMMIT ontbreekt: bouw productie-images alleen via de vrijgaveketen')"
RUN RTG_RELEASE_COMMIT="$RTG_RELEASE_COMMIT" node scripts/release-bewijs.js --uit /app/release-bewijs.json

# Data en back-ups op een volume, zodat ze een herbouw van de container
# overleven. De niet-root gebruiker 'node' moet erin kunnen schrijven.
RUN mkdir -p /app/server/data /app/motor-data /app/sentinel-data && \
    chown -R node:node /app/server/data /app/motor-data /app/sentinel-data /app/rtg-motor /app/rtg-sentinel
VOLUME ["/app/server/data"]

# Nooit als root draaien.
USER node

STOPSIGNAL SIGTERM

EXPOSE 3000 3100

# Container-gezondheid: de load balancer/orchestrator gebruikt /api/health.
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# node:sqlite laadt sinds Node 22.13 zonder vlag; server.js start direct.
CMD ["node", "server/server.js"]
