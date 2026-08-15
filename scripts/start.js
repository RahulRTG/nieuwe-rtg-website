#!/usr/bin/env node
/* Lokale ontwikkelstart. Een genegeerde .env.local mag machinegebonden
   instellingen bevatten; echte omgevingsvariabelen houden altijd voorrang.
   De parser is dezelfde letterlijk-lezen parser als de Docker/Mac-startlaag:
   nooit source, eval of shell-expansie. */
'use strict';

const fs = require('fs');
const path = require('path');
const { laadBestand } = require('./docker/start');

const wortel = path.join(__dirname, '..');
const envPad = process.env.RTG_ENV_FILE || path.join(wortel, '.env.local');
try {
  if (fs.existsSync(envPad)) {
    laadBestand(envPad, process.env);
    console.log('[start] lokale machineconfiguratie geladen uit ' + path.basename(envPad) + '.');
  }
} catch (e) {
  console.error('[start] machineconfiguratie geweigerd: ' + e.message);
  process.exit(78);
}

require('../server/trio');
