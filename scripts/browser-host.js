#!/usr/bin/env node
'use strict';

/* Eén Chromium-proces per E2E-shard. Testprocessen verbinden als clients en
   maken nog steeds een verse context; processtart is niet langer de prijs van
   ieder bestand. Zonder endpointbestand doet de bestaande lader exact wat hij
   altijd deed. */
const fs = require('fs');
const { chromium } = require('playwright');

const pad = process.env.RTG_BROWSER_ENDPOINT_FILE;
if (!pad) throw new Error('RTG_BROWSER_ENDPOINT_FILE ontbreekt');

let server;
let stopt = false;
async function stop(code) {
  if (stopt) return;
  stopt = true;
  try { if (server) await server.close(); } catch (e) {}
  try { fs.rmSync(pad, { force: true }); } catch (e) {}
  process.exit(code);
}

(async () => {
  server = await chromium.launchServer({ headless: true });
  const tijdelijk = pad + '.tmp-' + process.pid;
  fs.writeFileSync(tijdelijk, server.wsEndpoint() + '\n', { mode: 0o600 });
  fs.renameSync(tijdelijk, pad);
  process.on('SIGTERM', () => stop(0));
  process.on('SIGINT', () => stop(0));
  server.on('close', () => stop(0));
})().catch((e) => { console.error('[browser-host] ' + e.message); stop(1); });
