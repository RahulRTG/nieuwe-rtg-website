/* GOLIVE: drie stukken van de keuring die los te beproeven zijn.

   scripts/golive.js is een script dat van boven naar beneden de hele omgeving
   keurt; wat hieronder staat, moest in een TOETS kunnen draaien zonder dat de
   hele keuring meedraait:

   - leesEnvBestand: .env.productie lezen MET DE LEZER VAN DE SERVER
     (scripts/docker/start.js leesEnv). De eigen lezer die er stond stripte geen
     aanhalingstekens en geen `export `, en dan keurde het rapport een andere
     stand dan de server draait: `RTG_REGISTRATIE_DICHT="0"` las als dicht en
     `export RTG_REGISTRATIE_DICHT=1` werd overgeslagen. null als het bestand
     niet te lezen is; een bestand dat niet te ONTLEDEN is gooit.
   - registratieRegel: wat de keuring over RTG_REGISTRATIE_DICHT zegt, met
     dezelfde fail-closed regel als de server (server/config/registratie.js).
   - beproefPostgres: de database echt aanraken. De pgwire-client is een
     EventEmitter en zendt een verbindingsfout OOK als 'error' uit, naast de
     afwijzing van connect(); zonder luisteraar viel de keuring bij een
     onbereikbare database om zonder rapport, in plaats van te blokkeren. De
     reden gaat GEMASKEERD terug: DATABASE_URL kan uit het wachtwoordbestand
     zijn samengesteld en een driverfout neemt de reeks nogal eens mee. */
'use strict';
const fs = require('fs');
const { leesEnv } = require('../docker/start');
const { zonderGeheim } = require('./geenlek');
const registratie = require('../../server/config/registratie');

function leesEnvBestand(pad) {
  let tekst;
  try { tekst = fs.readFileSync(pad, 'utf8'); } catch (e) { return null; }
  return leesEnv(tekst);
}

function registratieRegel(env) {
  if (registratie.dicht(env)) {
    return { teken: '⚠', tekst: 'Registratie staat DICHT bij besluit van de eigenaar (RTG_REGISTRATIE_DICHT): registreren, de eerste SSO-aanmelding en SCIM maken geen nieuw account. owner-init (scripts/eigenaar-aanmaken.js) werkt wel; heropenen is een besluit en een herstart.' };
  }
  return { teken: '✓', tekst: 'Registratie: open (RTG_REGISTRATIE_DICHT leeg of 0).' };
}

async function beproefPostgres(env, opties) {
  const { Client } = (opties && opties.pgwire) || require('../../server/pgwire');
  const c = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 4000 });
  c.on('error', () => {});
  const t0 = Date.now();
  try {
    await c.connect();
    await c.query('SELECT 1');
    await c.end();
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, reden: zonderGeheim(e && e.message ? e.message : e) };
  }
}

module.exports = { leesEnvBestand, registratieRegel, beproefPostgres };
