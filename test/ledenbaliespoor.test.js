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

/* ============================================================================
   `vast` VOLGT DE UITSLAG EN NIET HET VOORNEMEN.

   Dit was bijna een valse bevestiging in precies het veld dat zegt hoe hard de
   regel zelf staat. `bijeen({duurzaam:true})` gooit alleen wanneer bevestigen
   MOGELIJK was en toch mislukte (server/db/bijeen.js) -- terecht, want een
   opslag die niet kan tellen mag geen transactie laten mislukken. Maar op zo'n
   opslag SLAAGT de commit dus zonder dat er iets is aangetoond, en de eerste
   versie van deze laag schreef daar onvoorwaardelijk `vast: true`.

   Op sqlite (de opstelling van deze toets) KAN het worden aangetoond. De ANDERE
   kant -- een opslag die het niet kan -- is toets 7 hieronder, en die hoefde
   niet op PostgreSQL te wachten: `persistentieStand()` geeft `null` voor ELKE
   niet-sqlite opslag (server/db/duurzaam.js), dus de json-opslag loopt door
   exact dezelfde tak.

   DE MUTATIE: laat `vast` weer op `true` staan ongeacht `kanBewijzen()` ->
   deze toets blijft groen, want sqlite kan het aantonen. Dat is de eerlijke
   grens van deze toets, en de reden dat de bron-controle eronder staat.
   ========================================================================== */
test('6. een journaalregel zegt of zijn duurzaamheid is AANGETOOND', async () => {
  const d = await api(eerlijk.base, '/api/office/balie/dossier', { id: lidId, reden: REDEN }, balieA);
  assert.equal(d.status, 200, 'de opzet van deze toets vraagt een geslaagde inzage');

  /* Het journaal van een lid leest zijn eigen regels niet terug met `vast`
     erin (voorBetrokkene geeft alleen at/waarom/bron -- de kijker is
     persoonsdata van een ander). De bewering wordt daarom op de BRON
     vastgelegd: `vast` hangt aan kanBewijzen() en niet aan een constante. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'inzagelog-vast.js'), 'utf8');
  assert.doesNotMatch(bron, /extra:\s*\{[^}]*vast:\s*true/,
    'inzagelog-vast.js schrijft weer onvoorwaardelijk `vast: true`; op een opslag die duurzaamheid ' +
    'niet kan bevestigen is dat een bevestiging die niemand heeft gegeven');
  assert.match(bron, /vast:\s*hard/,
    '`vast` hoort de uitslag van kanBewijzen() te dragen');
  assert.match(bron, /vastWaarom/,
    'staat er `vast: false`, dan hoort de REDEN erbij -- anders is het niet van een storing te onderscheiden');
});

/* ============================================================================
   DE ANDERE KANT: EEN OPSLAG DIE HET NIET KAN AANTONEN.

   `persistentieStand()` geeft `null` voor elke niet-sqlite opslag, en
   `bijeen({duurzaam:true})` gooit dan NIET -- de commit slaagt zonder dat er
   iets is aangetoond (server/db/bijeen.js: alleen gooien waar bevestigen
   mogelijk was). Twee dingen moeten daar tegelijk waar zijn, en ze trekken de
   andere kant op:

     - de inzage gaat DOOR. De weigering hangt aan de commit en niet aan de
       bewijsbaarheid ervan; anders sluit een opslag zonder teller de hele
       balie, en dat is een storing in plaats van een grens.
     - de regel LIEGT NIET. Hij draagt `vast: false` met de reden, want een
       spoor dat niet kan zeggen hoe hard het zelf staat, is geen bewijs.

   Dit is de tak waar PostgreSQL doorheen loopt, hier beproefd met de
   json-opslag omdat het dezelfde tak is -- niet een benadering ervan.

   DE MUTATIE: zet `vast: hard` terug op `vast: true` -> deze toets zakt op de
   tweede bewering, terwijl toets 6 groen blijft. Dat is precies waarom het er
   twee zijn.
   ========================================================================== */
test('7. een opslag die niets kan aantonen laat de inzage door en zegt het erbij', async () => {
  const kaal = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap(), RTG_STORE: 'json' } });
  try {
    const balie = await kantoorAlsPersoon(kaal.base);
    assert.ok(balie, 'geen kantoorsessie op de json-opslag');

    let lid = null;
    for (const proef of ['en', 'er', 'aa', 'de', 'an']) {
      const z = await api(kaal.base, '/api/office/balie/zoek', { codenaam: proef }, balie);
      if (z.body && z.body.treffers && z.body.treffers.length) { lid = z.body.treffers[0]; break; }
    }
    assert.ok(lid, 'geen lid gevonden op de json-opslag');

    const d = await api(kaal.base, '/api/office/balie/dossier', { id: lid.id, reden: REDEN }, balie);
    assert.equal(d.status, 200,
      'de inzage hoort DOOR te gaan als de opslag duurzaamheid niet kan aantonen; ' +
      'een weigering daar is een storing en geen grens: ' + JSON.stringify(d.body).slice(0, 160));

    /* En nu het spoor zelf. Het techniekbord geeft de samenvatting met de
       recente regels; het lid krijgt ze niet zo te zien (voorBetrokkene laat de
       kijker weg -- dat is persoonsdata van een ander). */
    const st = await fetch(kaal.base + '/api/techniek/status',
      { headers: { Authorization: 'Bearer ' + (await eigenaarsToken(kaal.base)) } });
    const bord = await st.json().catch(() => ({}));
    const recent = (bord.inzage && bord.inzage.recent) || [];
    const regel = recent.find(r => String(r.bron || '').startsWith('ledenbalie'));
    assert.ok(regel, 'geen journaalregel van de ledenbalie teruggevonden: ' + JSON.stringify(recent).slice(0, 200));
    assert.equal(regel.stand, 'toegestaan',
      'de regel hoort te zeggen dat inzage is VERLEEND, nooit dat er is ingezien');
    assert.equal(regel.vast, false,
      'de regel claimt `vast: true` op een opslag die duurzaamheid niet kan bevestigen -- ' +
      'dat is een bevestiging die niemand heeft gegeven');
    assert.match(String(regel.vastWaarom || ''), /niet bevestigen/,
      'staat er `vast: false`, dan hoort de REDEN erbij; anders is het niet van een storing te onderscheiden');
  } finally {
    stop(kaal && kaal.child);
  }
});

/* Het eigenaarstoken opent het techniekbord (techAuth verifieert het als ECHT
   account en magInzien() laat de eigenaar door; een demo-persona strandt al op
   de eerste stap). Zelfde weg als scripts/lib/proefsleutels.js. */
async function eigenaarsToken(base) {
  const r = await api(base, '/api/auth/login', { login: 'Rahul', password: 'Imran' });
  return (r.body && r.body.token) || '';
}
