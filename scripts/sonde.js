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
/* --json=pad: de monsters ook als bestand afgeven, zodat scripts/triage.js er
   een duiding op kan doen (welke laag is stuk, helpt terugrollen). De tekst
   hierboven blijft de uitvoer voor mensen; dit is de uitvoer voor de triage. */
const JSON_UIT = (args.find(a => a.startsWith('--json=')) || '').slice(7);

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

/* Het certificaat van de basis-URL bekijken zonder er een verzoek overheen te
   sturen: een kale TLS-handdruk, de einddatum lezen, weer weg. Levert null
   als er niets te meten valt (http, of de handdruk faalt -- een kapotte
   handdruk valt al op de reizen zelf en hoort daar thuis). */
function certMonster(basisUrl) {
  if (!/^https:/.test(basisUrl)) return Promise.resolve(null);
  const { hostname, port } = new URL(basisUrl);
  return new Promise(resolve => {
    const tls = require('tls');
    let klaar = false;
    const af = uit => { if (!klaar) { klaar = true; try { s.destroy(); } catch {} resolve(uit); } };
    const s = tls.connect({ host: hostname, port: Number(port) || 443, servername: hostname, timeout: 10000 }, () => {
      const c = s.getPeerCertificate();
      const dagen = Math.floor((new Date(c.valid_to).getTime() - Date.now()) / 86400000);
      af({
        at: new Date().toISOString(), reis: 'tls-geldigheid', status: 0, ms: 0, dagen,
        gelukt: dagen >= 14, traag: false,
        reden: dagen >= 14 ? null : 'certificaat verloopt over ' + dagen + ' dagen -- de vernieuwing hoort rond dag 30 te draaien'
      });
    });
    s.on('error', () => af(null));
    s.on('timeout', () => af(null));
  });
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

  /* De vooruitkijkende TLS-meting. De reizen hierboven zien een verlopen
     certificaat pas als het al stuk is; het certificaat zelf kondigt dat
     weken eerder aan. Veertien dagen is de drempel omdat gangbare
     vernieuwing (Let's Encrypt) rond dertig dagen voor het einde draait:
     wie op veertien zit heeft geen krap certificaat maar een kapotte
     vernieuwing, en dat is een incident dat alleen nog niet pijn doet. */
  const cert = await certMonster(BASIS);
  if (cert) {
    monsters.push(cert);
    console.log((cert.gelukt ? '\u2713' : '\u2717') + ' ' + 'tls-geldigheid'.padEnd(30) + '   -' +
      '      - ms  ' + (cert.reden || ('certificaat nog ' + cert.dagen + ' dagen geldig')));
  }

  if (JSON_UIT) fs.writeFileSync(JSON_UIT, JSON.stringify({ basis: BASIS, monsters }, null, 2) + '\n');

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
