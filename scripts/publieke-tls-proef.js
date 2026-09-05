#!/usr/bin/env node
/* Publieke TLS-vrijgaveproef. Zie lib/publieke-tls-proef.js voor de grens:
   loopback mag alleen het TCP-doel vervangen; publieke hostname, SNI en
   trustcontrole kunnen niet worden uitgezet. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  FORMAAT,
  voerPubliekeTlsProef,
  schrijfBewijs
} = require('./lib/publieke-tls-proef');

function leesEnvWaarde(pad, naam) {
  const tekst = fs.readFileSync(path.resolve(pad), 'utf8');
  for (const regel of tekst.split(/\r?\n/)) {
    const i = regel.indexOf('=');
    if (i > 0 && regel.slice(0, i).trim() === naam) return regel.slice(i + 1).trim();
  }
  return '';
}

function gebruik() {
  console.error('Gebruik: node scripts/publieke-tls-proef.js https://app.example.nl [--connect-host=127.0.0.1] [--readiness-only] [--eis-release-commit] [--bewijs=pad] [--stil]');
}

function parse(argv) {
  const uit = { appUrl: '', connectHost: '', readinessOnly: false, eisReleaseCommit: false, bewijsPad: '', stil: false };
  for (const arg of argv) {
    if (/^https?:\/\//.test(arg) && !uit.appUrl) uit.appUrl = arg;
    else if (arg.startsWith('--env-file=')) uit.envFile = arg.slice(11);
    else if (arg.startsWith('--connect-host=')) uit.connectHost = arg.slice(15);
    else if (arg === '--readiness-only') uit.readinessOnly = true;
    else if (arg === '--eis-release-commit') uit.eisReleaseCommit = true;
    else if (arg.startsWith('--bewijs=')) uit.bewijsPad = arg.slice(9);
    else if (arg === '--stil') uit.stil = true;
    else throw new Error('onbekende optie: ' + arg);
  }
  if (!uit.appUrl && uit.envFile) uit.appUrl = leesEnvWaarde(uit.envFile, 'APP_URL');
  if (!uit.appUrl) throw new Error('APP_URL ontbreekt');
  return uit;
}

(async () => {
  let args;
  try { args = parse(process.argv.slice(2)); }
  catch (e) { gebruik(); console.error('[tls-proef] ' + e.message); process.exit(64); }
  try {
    const bewijs = await voerPubliekeTlsProef({
      appUrl: args.appUrl,
      connectHost: args.connectHost || undefined,
      readinessOnly: args.readinessOnly,
      eisReleaseCommit: args.eisReleaseCommit,
      releaseCommit: process.env.RTG_RELEASE_COMMIT
    });
    if (args.bewijsPad) schrijfBewijs(args.bewijsPad, bewijs);
    if (!args.stil) {
      console.log('✓ Publieke TLS vertrouwd voor ' + bewijs.appUrl +
        ' (' + bewijs.tls.protocol + ', nog ' + bewijs.tls.daysRemaining + ' dagen).');
      console.log('✓ HSTS: max-age=' + bewijs.ready.hsts.maxAge + '; includeSubDomains.');
      if (bewijs.redirect) console.log('✓ HTTP→HTTPS: ' + bewijs.redirect.status + ' naar ' + bewijs.redirect.location + '.');
      if (args.bewijsPad) console.log('✓ TLS-bewijs geschreven naar ' + args.bewijsPad + '.');
    }
  } catch (e) {
    if (args.bewijsPad) {
      /* Ook rood is bewijs. Het bevat geen ketenbytes, geheimen of vrij
         ingevoerde URL; alleen de vastgelegde poortuitkomst. Een latere
         releasepoort mag een ontbrekend én een rood bestand dus gelijkwaardig
         fail-closed behandelen. */
      let oorsprong = null;
      try { oorsprong = new URL(args.appUrl).origin; } catch (x) {}
      try {
        schrijfBewijs(args.bewijsPad, {
          formaat: FORMAAT,
          geslaagd: false,
          at: new Date().toISOString(),
          appUrl: oorsprong,
          connectMode: args.connectHost ? 'loopback-met-publieke-SNI' : 'publieke-DNS',
          releaseCommit: /^[a-f0-9]{40,64}$/i.test(String(process.env.RTG_RELEASE_COMMIT || ''))
            ? String(process.env.RTG_RELEASE_COMMIT).toLowerCase() : null,
          foutcode: String(e && e.code || 'RTG_PUBLIEKE_TLS_PROEF'),
          fout: String(e && e.message || e).slice(0, 500)
        });
      } catch (schrijfFout) {
        console.error('[tls-proef] rood bewijs kon niet worden geschreven: ' + schrijfFout.message);
      }
    }
    console.error('[tls-proef] GEWEIGERD: ' + String(e && e.message || e));
    process.exit(1);
  }
})();
