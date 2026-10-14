#!/usr/bin/env node
/* Bearercode v2: de kale contracthash vervangen door het HMAC-zegel, of na
   een sleutelrotatie herzegelen onder de nieuwste kid.

   Het werk zelf staat in server/kern/bearercode-migratie.js; dit is alleen de
   ingang. Standaard een PROEF: niets wordt geschreven, de telling per
   collectie komt op stdout. Schrijven vraagt
     --uitvoeren --bevestig=HERZEGEL-BEARERCODE-V2
   en gaat per collectie door een collectietransactie (PostgreSQL: slot +
   FOR UPDATE), zodat een draaiende instance er niet tussen schrijft.

   Opties:
     --roteer              ook records onder een oudere kid naar de nieuwste
     --max-rest-dagen=N    alleen records die nog hooguit N dagen openstaan
                           (zie de grens in de kop van bearercode-migratie.js)

   De sleutel komt uit dezelfde ring als de server (RTG_BEARER_RING, anders
   afgeleid van RTG_SECRET_KEY): draai dit met de omgeving van productie. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const BEVESTIGING = 'HERZEGEL-BEARERCODE-V2';
const WORTEL = path.join(__dirname, '..');

/* De namespaces om de kale hash tegen te leggen: elke letterlijke
   `namespace: '...'` onder server/, plus de drie die uit een constante komen.
   Een namespace die hier ontbreekt, laat zijn records DICHT (ze tellen als
   kaleHashKloptNiet); test/bearercode-hmac.test.js houdt de lijst volledig. */
function kandidaten() {
  const gevonden = new Set();
  const loop = map => {
    for (const d of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, d.name);
      if (d.isDirectory()) { if (d.name !== 'data' && d.name !== 'node_modules') loop(p); continue; }
      if (!d.name.endsWith('.js')) continue;
      for (const m of fs.readFileSync(p, 'utf8').matchAll(/namespace:\s*['"]([^'"\n]+)['"]/g)) gevonden.add(m[1]);
    }
  };
  loop(path.join(WORTEL, 'server'));
  gevonden.add(require('../server/kern/link/cap-bak').DOEL);
  for (const p of Object.values(require('../server/kern/samen-toegang').PROFIELEN)) gevonden.add(p.doel);
  return [...gevonden].sort();
}

function argument(naam) {
  const a = process.argv.find(x => x.startsWith('--' + naam + '='));
  return a ? a.slice(naam.length + 3) : null;
}

async function main() {
  const uitvoeren = process.argv.includes('--uitvoeren');
  if (uitvoeren && argument('bevestig') !== BEVESTIGING) {
    process.stderr.write('Schrijven vraagt --uitvoeren --bevestig=' + BEVESTIGING + '\n');
    process.exit(64);
  }
  const dagen = argument('max-rest-dagen');
  const maxRestMs = dagen == null ? null : Number(dagen) * 86400000;
  if (dagen != null && !(maxRestMs > 0)) { process.stderr.write('--max-rest-dagen is een positief getal\n'); process.exit(64); }
  const ring = require('../server/kern/bearercode-sleutelring').ring();
  if (!ring || ring.fout) { process.stderr.write('Geen zegelsleutel: ' + (ring && ring.fout) + '\n'); process.exit(65); }

  const { herzegel } = require('../server/kern/bearercode-migratie');
  const namespaces = kandidaten();
  const opties = { crypto, namespaces, nu: () => new Date().toISOString(), roteer: process.argv.includes('--roteer'), maxRestMs };
  const opslag = require('../server/db');
  const rapport = { uitgevoerd: uitvoeren, kid: ring.actief, namespaces: namespaces.length, collecties: {} };
  const werk = async () => {
    for (const naam of Object.keys(opslag.db.data || {})) {
      const proef = herzegel(JSON.parse(JSON.stringify(opslag.db.data[naam])), opties);
      if (!proef.bekeken) continue;
      rapport.collecties[naam] = proef;
      if (uitvoeren && (proef.gemigreerd || proef.geroteerd)) {
        rapport.collecties[naam] = await opslag.bewerkCollectie(naam, bron => herzegel(bron, opties));
      }
    }
  };
  opslag.load();
  if (opslag.STORE === 'postgres') await opslag.startPostgres(werk); else await werk();
  process.stdout.write(JSON.stringify(rapport, null, 2) + '\n');
}

if (require.main === module) main().then(() => process.exit(0), e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
module.exports = { kandidaten, BEVESTIGING };
