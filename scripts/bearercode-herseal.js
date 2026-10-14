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
     --controleer          alleen lezen, NA de migratie: exit 0 als er niets
                           meer te migreren is en geen verlopen of ingetrokken
                           record een geldig zegel draagt, anders exit 1
     --moment=ISO          (bij --controleer) het migratiemoment; standaard nu
     --zegel-sinds=ISO     (bij --controleer) wanneer het zegel live ging

   Elke collectie krijgt naast de telling `opnieuwUitgeven`: de records die
   dicht blijven, met alleen een pad en niet-geheime velden (max 500, de rest
   telt `nietInLijst`).

   GEEN ONBEDOELDE SLEUTELWISSEL. De server valt zonder RTG_BEARER_RING terug
   op een van RTG_SECRET_KEY afgeleide sleutel; de migratie SCHRIJFT daar niet
   mee. Wie zo zegelt en later een eigen ring zonder `geheim` instelt, maakt
   elk gemigreerd record stil onbruikbaar. --uitvoeren vraagt dus een
   expliciet gezette RTG_BEARER_RING (uit de secrets manager van productie),
   anders exit 65. De proef zegt welke kid hij zou gebruiken. Er wordt nooit
   sleutelmateriaal geprint, alleen de kid. */
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

/* Het werk per collectie, los van de omgeving: de toetsen geven er een eigen
   opslag aan (met bewerkCollectie) om een uitval halverwege na te spelen. */
async function migreer({ opslag, opties, uitvoeren = false, controle = false }) {
  const { metLijst, controleer } = require('../server/kern/bearercode-migratie');
  const collecties = {}, afwijkingen = [];
  for (const naam of Object.keys(opslag.db.data || {})) {
    const o = Object.assign({}, opties, { wortel: naam });
    const proef = (controle ? controleer : metLijst)(controle ? opslag.db.data[naam] : JSON.parse(JSON.stringify(opslag.db.data[naam])), o);
    if (!proef.bekeken) continue;
    collecties[naam] = proef;
    if (controle) afwijkingen.push(...proef.afwijkingen.map(a => naam + ': ' + a));
    else if (uitvoeren && (proef.gemigreerd || proef.geroteerd)) collecties[naam] = await opslag.bewerkCollectie(naam, bron => metLijst(bron, o));
  }
  return { collecties, afwijkingen };
}

const tijd = naam => { const v = argument(naam); return v == null ? null : Number.isFinite(Date.parse(v)) ? v : NaN; };

async function main() {
  const uitvoeren = process.argv.includes('--uitvoeren');
  const controle = process.argv.includes('--controleer');
  if (uitvoeren && controle) { process.stderr.write('Kies --uitvoeren of --controleer, niet allebei\n'); return 64; }
  if (uitvoeren && argument('bevestig') !== BEVESTIGING) {
    process.stderr.write('Schrijven vraagt --uitvoeren --bevestig=' + BEVESTIGING + '\n');
    return 64;
  }
  const dagen = argument('max-rest-dagen');
  const maxRestMs = dagen == null ? null : Number(dagen) * 86400000;
  if (dagen != null && !(maxRestMs > 0)) { process.stderr.write('--max-rest-dagen is een positief getal\n'); return 64; }
  const moment = tijd('moment'), zegelSinds = tijd('zegel-sinds');
  if (Number.isNaN(moment) || Number.isNaN(zegelSinds)) { process.stderr.write('--moment en --zegel-sinds zijn een ISO-tijdstip\n'); return 64; }
  const ring = require('../server/kern/bearercode-sleutelring').ring();
  if (!ring || ring.fout) { process.stderr.write('Geen zegelsleutel: ' + (ring && ring.fout) + '\n'); return 65; }
  const expliciet = String(process.env.RTG_BEARER_RING || '').trim() !== '';
  if (uitvoeren && !expliciet) {
    process.stderr.write('Schrijven geweigerd: RTG_BEARER_RING is niet gezet. Dan zou de migratie zegelen met de van ' +
      'RTG_SECRET_KEY afgeleide sleutel (kid ' + ring.actief + '), en een latere eigen ring zonder `geheim` maakt die ' +
      'records stil onbruikbaar. Zet RTG_BEARER_RING expliciet (kid:<64 hex>[,geheim]) met de waarde van productie.\n');
    return 65;
  }

  const namespaces = kandidaten();
  const opties = { crypto, namespaces, nu: () => new Date().toISOString(), roteer: process.argv.includes('--roteer'), maxRestMs, moment, zegelSinds };
  const opslag = require('../server/db');
  const rapport = { modus: controle ? 'controle' : uitvoeren ? 'uitvoeren' : 'proef', uitgevoerd: uitvoeren, kid: ring.actief,
    ringBron: expliciet ? 'RTG_BEARER_RING' : 'afgeleid van RTG_SECRET_KEY', namespaces: namespaces.length };
  if (!expliciet && !controle) rapport.schrijven = 'geweigerd zonder RTG_BEARER_RING (de proef rekent met kid ' + ring.actief + ')';
  const werk = async () => Object.assign(rapport, await migreer({ opslag, opties, uitvoeren, controle }));
  opslag.load();
  if (opslag.STORE === 'postgres') await opslag.startPostgres(werk); else await werk();
  if (!controle) delete rapport.afwijkingen;
  process.stdout.write(JSON.stringify(rapport, null, 2) + '\n');
  if (controle && rapport.afwijkingen.length) { process.stderr.write('Controle: ' + rapport.afwijkingen.join('; ') + '\n'); return 1; }
  return 0;
}

if (require.main === module) main().then(c => process.exit(c || 0), e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
module.exports = { kandidaten, migreer, BEVESTIGING };
