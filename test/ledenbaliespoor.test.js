/* GEEN AANTOONBAAR JOURNAAL, GEEN INZAGE.

   De ledenbalie opent het dossier van een lid: codenaam, pas, land, stad, lid
   sinds, abonnementsstand, klachten. Dat mag, met een reden, door een mens op
   naam -- en het hele privacy-ontwerp van dit huis leunt erop dat daar een
   spoor van overblijft. Dat spoor faalde OPEN, en niemand had dat gekozen:

     try { inzagelog.noteer(...); } catch (e) {}
     return { ok: true, lid: {...} };

   Drie dingen konden daar stil misgaan, en bij alle drie kreeg de medewerker
   het dossier te zien terwijl er geen regel stond. Een uitzondering verdween in
   de lege catch. Zonder database legde noteer() de regel in een verse array die
   meteen daarna werd weggegooid -- en meldde succes. En ook zonder uitzondering
   betekent save() niet dat er iets STAAT: binnen een bundel zet hij alleen een
   vlag, en in PostgreSQL-modus markeert hij dat de responsepoort later moet
   committen. Uitgevoerd, geaccepteerd, gecommit en duurzaam bewezen zijn vier
   dingen, en de code las ze als een.

   GEMETEN MET DE MUTATIE, 13 september 2026. Met de poort eruit levert
   /api/office/balie/dossier onder `schrijf-verloren` gewoon 200 met de codenaam
   erin, en staat er geen journaalregel. Dat is de toestand van vóór deze toets.

   WAT HIER WORDT BEWEERD, EN WAT NIET:
     - zonder verraad werkt de balie gewoon (de eerste vraag, niet de laatste);
     - onder een liegende opslag komt er GEEN 2xx uit -- niet bij het dossier,
       niet bij het zoeken, en niet bij het herstel dat een bericht verstuurt;
     - het antwoord wordt ECHT afgewacht: een vergeten `await` in de kern stuurt
       een Promise, en die serialiseert naar `{}` met een keurige 200.

   Er staat hier NIETS over de andere 41 aanroepers van noteer(). Die gaan per
   plek om, met een reden -- bij een lijstscherm dat een naam toont is weigeren
   iets anders dan bij het openen van een kluis. Een toets die nu vastlegt dat
   de rest nog write-behind is, zou de volgende stap tegenhouden in plaats van
   bewaken.

   Draai los: node --test test/ledenbaliespoor.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const mappen = [];
const verseMap = () => { const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lbs-')); mappen.push(m); return m; };

function api(base, pad, body, token) {
  return fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* Een reden moet INHOUD hebben (server/kern/ledenbalie.js: redenOf); "test"
   haalt de grens niet, en dan meet deze toets de reden-controle in plaats van
   het journaal. */
const REDEN = 'Controle van het abonnement na een vraag van het lid zelf';

/* Twee servers: een eerlijke en een liegende, elk met een eigen datamap -- een
   opslag die schrijfacties weggooit hoort niet in de map van een andere toets
   te wroeten. */
let eerlijk, leugen, balieA, balieB, lidId;
test.before(async () => {
  eerlijk = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap() } });
  leugen = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap(), RTG_VERRAAD: 'schrijf-verloren' } });
  balieA = await kantoorAlsPersoon(eerlijk.base);
  balieB = await kantoorAlsPersoon(leugen.base);
  /* Een codenaam van twee tekens die in de zaaiset voorkomt; zonder treffer
     meet de rest van deze toets niets. */
  for (const proef of ['en', 'er', 'aa', 'de', 'an']) {
    const z = await api(eerlijk.base, '/api/office/balie/zoek', { codenaam: proef }, balieA);
    if (z.body && z.body.treffers && z.body.treffers.length) { lidId = z.body.treffers[0].id; break; }
  }
});
test.after(() => {
  stop(eerlijk && eerlijk.child);
  stop(leugen && leugen.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('1. zonder verraad doet de balie gewoon haar werk', async () => {
  assert.ok(lidId != null, 'geen lid gevonden om in te zien; dan meet de rest van deze toets niets');
  const d = await api(eerlijk.base, '/api/office/balie/dossier', { id: lidId, reden: REDEN }, balieA);
  assert.equal(d.status, 200, 'de balie hoort met een geldige reden gewoon open te gaan: ' + JSON.stringify(d.body));
  assert.ok(d.body.lid && d.body.lid.codename, 'er hoort een dossier in te zitten');
  /* EEN VERGETEN await IS HIER DE GEVAARLIJKSTE FOUT. Een Promise serialiseert
     naar {} en gaat met 200 de deur uit; het dossier is dan leeg maar het
     antwoord ziet er goed uit. Daarom wordt de INHOUD getoetst en niet de code. */
  assert.equal(typeof d.body.lid.pas, 'string', 'het antwoord is niet afgewacht: een Promise wordt {}');
});

test('2. onder een liegende opslag gaat het dossier NIET open', async () => {
  const d = await api(leugen.base, '/api/office/balie/dossier', { id: lidId, reden: REDEN }, balieB);
  assert.ok(d.status >= 500, 'het dossier kwam met ' + d.status + ' terug terwijl het spoor niet vaststaat: ' +
    JSON.stringify(d.body).slice(0, 200));
  assert.ok(!d.body.lid, 'er is een dossier meegestuurd zonder dat het spoor vaststaat');
  assert.equal(d.body.spoor, 'niet-bevestigd', 'de weigering hoort te zeggen WAAROM; anders is een opslagstoring ' +
    'niet te onderscheiden van een verkeerde reden');
});

test('3. ook het ZOEKEN gaat niet door zonder spoor', async () => {
  /* Een zoekopdracht toont codenaam, pas, land en stad van maximaal twintig
     leden. Dat zonder spoor laten passeren is de weg waarlangs men een dossier
     leest zonder het te openen. */
  const z = await api(leugen.base, '/api/office/balie/zoek', { codenaam: 'en' }, balieB);
  assert.ok(z.status >= 500, 'het zoeken gaf ' + z.status + ' terwijl het spoor niet vaststaat');
  assert.ok(!(z.body.treffers && z.body.treffers.length), 'er zijn treffers meegestuurd zonder spoor');
});

test('4. het herstel verstuurt NIETS zonder spoor, en zegt dat erbij', async () => {
  /* Dit zet een stroom in gang naar de telefoon en het adres van een lid. Een
     mislukte commit mag geen bericht achterlaten dat niemand kan verklaren. */
  const h = await api(leugen.base, '/api/office/balie/herstel', { id: lidId, reden: REDEN }, balieB);
  assert.ok(h.status >= 500, 'het herstel gaf ' + h.status + ' terwijl het spoor niet vaststaat');
  assert.match(String(h.body.error || ''), /niets verstuurd/i,
    'de weigering hoort te zeggen dat er niets is verstuurd; anders belt de medewerker het lid na over een ' +
    'bericht dat nooit is verstuurd');
});

test('5. de gedeelde kantoorcode komt hier nog steeds niet door', async () => {
  /* De poort van deze stap zit NA balieAuth. Zou hij ervoor komen te staan, dan
     kreeg de gedeelde code een 503 in plaats van de 403 die uitlegt dat deze
     handelingen een naam dragen -- en dan is een grens een muur geworden. */
  const office = await api(eerlijk.base, '/api/office/login', { code: process.env.OFFICE_CODE || 'RTG-OFFICE' });
  if (!office.body || !office.body.token) return;   // geen gedeelde code in deze opstelling
  const d = await api(eerlijk.base, '/api/office/balie/dossier', { id: lidId, reden: REDEN }, office.body.token);
  assert.equal(d.status, 403, 'de gedeelde code hoort 403 te krijgen en niet de 503 van het spoor');
  assert.match(String(d.body.error || ''), /zetel op naam/i);
});
