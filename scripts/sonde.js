/* DE SONDE VAN BUITENAF -- de enige meting hier die niet van de app zelf komt.

   SLO.md noemt dit als het eerste gat onder "Wat hier NOG NIET staat, en eerlijk
   gezegd moet": alles wordt door de app zelf geteld, dus ligt de app plat dan
   telt er niets en ziet de grafiek er prima uit. Dit script is de kant die dat
   wel ziet, en het draait daarom op een ANDERE machine dan de server.

   Draaien:
     node scripts/sonde.js https://rtg.example.com
     node scripts/sonde.js https://rtg.example.com --melden --token=$RTG_METRICS_TOKEN

   Zonder --melden print hij de uitslag en gaat hij weg (exitcode 1 als er een
   reis mislukte, zodat cron of een pipeline er iets mee kan). Met --melden zet
   hij de monsters ook terug in de app, achter dezelfde poort als /api/metrics.

   WAT DIT WEL EN NIET BEWIJST. Vanaf een andere machine zitten TLS, DNS, de
   reverse proxy en het netwerk in de meting. Dat is precies wat er ontbreekt
   aan een sonde die in het serverproces zelf draait. Wat er nog steeds niet in
   zit: het netwerk van de klant en de browser van de klant. Een sonde is een
   ondergrens voor de storing, geen bovengrens voor de kwaliteit.

   De reizen komen uit SLO.json, hetzelfde bestand dat de doelen draagt. Dit
   script kent er dus geen enkele van zichzelf. */
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const BASIS = (args.find(a => /^https?:\/\//.test(a)) || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const MELDEN = args.includes('--melden');
const TOKEN = (args.find(a => a.startsWith('--token=')) || '').slice(8) || process.env.RTG_METRICS_TOKEN || '';
const NAAR = (args.find(a => a.startsWith('--naar=')) || '').slice(7) || BASIS;

const norm = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'SLO.json'), 'utf8'));
const REIZEN = Array.isArray(norm.reizen) ? norm.reizen : [];

async function loop(reis) {
  const begin = Date.now();
  const opties = { method: reis.methode || 'GET', redirect: 'manual', headers: { 'x-rtg-sonde': '1' } };
  if (reis.body) {
    opties.headers['content-type'] = 'application/json';
    opties.body = JSON.stringify(reis.body);
  }
  let status = 0, reden = null;
  try {
    const r = await fetch(BASIS + reis.pad, opties);
    status = r.status;
    await r.arrayBuffer();
  } catch (e) {
    reden = String((e && e.message) || e).slice(0, 120);
  }
  const ms = Date.now() - begin;
  const verwacht = Array.isArray(reis.verwacht) ? reis.verwacht : [200];
  const gelukt = verwacht.includes(status);
  return {
    at: new Date().toISOString(), reis: reis.id, status, ms, gelukt,
    traag: gelukt && ms > (reis.maxMs || 2000),
    reden: reden || (gelukt ? null : 'status ' + status + ' terwijl ' + verwacht.join('/') + ' werd verwacht')
  };
}

(async () => {
  if (!REIZEN.length) {
    console.error('SLO.json draagt geen reizen. Zonder reizen is er niets te lopen.');
    process.exit(2);
  }
  console.log('Sonde tegen ' + BASIS + ', ' + REIZEN.length + ' reizen.\n');

  const monsters = [];
  for (const reis of REIZEN) {
    /* Achter elkaar en niet tegelijk: vijf verzoeken op hetzelfde moment meten
       vooral elkaar. */
    const m = await loop(reis);
    monsters.push(m);
    console.log((m.gelukt ? (m.traag ? '⚠' : '✓') : '✗') + ' ' + reis.naam.padEnd(30) +
      String(m.status).padStart(4) + '  ' + String(m.ms).padStart(5) + ' ms' +
      (m.reden ? '  ' + m.reden : (m.traag ? '  trager dan de afgesproken ' + reis.maxMs + ' ms' : '')));
  }

  const mislukt = monsters.filter(m => !m.gelukt).length;
  console.log('\n' + (monsters.length - mislukt) + ' van ' + monsters.length + ' reizen gelukt.');

  if (MELDEN) {
    try {
      const r = await fetch(NAAR + '/api/sonde/melding', {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json' },
          TOKEN ? { authorization: 'Bearer ' + TOKEN } : {}),
        body: JSON.stringify({ monsters })
      });
      const d = await r.json().catch(() => ({}));
      /* Een 404 hier is de poort en niet een verdwaald pad: server/meetpoort.js
         antwoordt met 404 in plaats van 403 om niet te bevestigen dat het
         endpoint bestaat. Dat staat er daarom bij, anders zoekt de volgende
         persoon een half uur naar een route die er gewoon is. */
      console.log(r.ok ? 'Gemeld: ' + JSON.stringify(d)
        : 'Melden mislukt (' + r.status + ')' + (r.status === 404
          ? ': dat is meestal de poort en niet het pad -- zet --token of meld vanaf een intern adres.' : ''));
      if (!r.ok) process.exit(1);
    } catch (e) {
      console.log('Melden mislukt: ' + e.message);
      process.exit(1);
    }
  }

  process.exit(mislukt ? 1 : 0);
})();
