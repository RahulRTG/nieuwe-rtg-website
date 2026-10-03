# Network is available only while preparing dependencies. Each actual test is
# run in a fresh --network none container with its own loopback PG and Redis.
FROM node:26.10.0-bookworm AS node
FROM ubuntu:24.04
COPY --from=node /usr/local/ /usr/local/
RUN apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    git ca-certificates postgresql-16 redis-server libxml2-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/deps
COPY package.json package-lock.json ./
COPY browserinstall.js scripts/browserinstall.js
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/browsers
RUN npm ci && node scripts/browserinstall.js && chmod -R a+rX /opt/deps /opt/browsers
RUN groupadd --gid 10001 node && useradd --uid 10001 --gid 10001 --create-home node
USER node
WORKDIR /work
