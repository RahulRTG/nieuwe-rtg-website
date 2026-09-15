/* DE REFERENTIE ONDER EEN LIEGENDE OPSLAG -- geval 1 en 2 van de vijf.

   REPRESENTATIE.md par. 8 stelde vast dat `kern/vertegenwoordiging/handelen.js`
   als enige van de zeven mechanismen de vier spoor-eigenschappen haalt. Dat was
   een LEZING van de control flow, en sinds er een injector bestaat is dat niet
   goed genoeg: `server/lib/verraad.js` kan de opslag laten liegen, dus hoort de
   bewering beproefd te worden in plaats van afgeleid.

   WELKE TWEE GEVALLEN HIER STAAN, EN WAAROM NIET VIJF. De vijf gevallen zijn:

     1  oordeel weigert   spoor slaagt   geen uitvoering   -> geweigerde poging zichtbaar
     2  oordeel staat toe spoor faalt    geen uitvoering   -> geen handeling
     3  oordeel staat toe spoor slaagt   uitvoering slaagt
     4  oordeel staat toe spoor slaagt   uitvoering faalt
     5  uitvoering slaagt, het eindspoor faalt

   Drie tot en met vijf staan hier NIET, en dat is geen tekort van deze toets:
   `handel()` VOERT NIETS UIT. Hij zoekt de machtiging, oordeelt, legt vast en
   antwoordt; de enige aanroeper (`routes/vertegenwoordiging.js`) geeft dat
   antwoord rechtstreeks door. Er is dus geen uitvoering die kan slagen of falen.
   Het mechanisme dat die helft WEL heeft is `kern/appstore/brug.js` (`roepKaal`,
   met `m.doe()` in een try/catch), en dat schrijft geen spoor. De twee helften
   van het contract wonen vandaag in verschillende mechanismen.

   WAT HIER WORDT BEWEZEN:
     - zonder verraad doet de referentie gewoon haar werk;
     - een GEWEIGERDE poging levert 403 EN een regel in het spoor van de client;
     - onder een opslag die schrijfacties weggooit komt er GEEN 2xx uit, en na
       een herstart staat er ook geen regel -- de handeling ging niet door en
       het spoor is er niet: allebei, en niet een van beide.

   WAT HIER NIET WORDT BEWEZEN, en het staat er omdat het de volgende stap is:
   `gelukt` in de spoorregel volgt het OORDEEL en niet de uitvoering. Toets 4
   laat dat zien op de scherpst mogelijke manier -- een LEESbevoegdheid
   (`contract.lezen`) krijgt `gelukt: true` en het antwoord zegt "Uitgevoerd
   binnen de machtiging", terwijl er niets is uitgevoerd en niets is gelezen.
   Die toets legt de huidige toestand vast en keurt hem niet goed: wordt
   `gelukt` gesplitst in toegestaan + uitvoeringBekend (de vorm die
   kern/platformfout.js al draagt), dan hoort toets 4 MEE te veranderen. Hij
   staat er zodat die verandering opvalt in plaats van ongemerkt te gebeuren.

   Draai los: node --test test/handelenspoor.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, keurLidGoed } = require('./helper');

/* EEN DATAMAP DIE TWEE SERVERS NA ELKAAR DRAGEN, en dat is hier geen gemak maar
   de enige weg. Een machtiging vraagt een cliënt die `volwassen()` haalt (A3,
   RTG heeft het identiteitsbewijs gezien), en dus een keuring door het kantoor.
   Op een server die schrijfacties weggooit lukt die opbouw per definitie niet.
   De wereld wordt daarom EERLIJK gebouwd, de server gestopt, en dezelfde map
   opnieuw geopend door een server die liegt. */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-hspoor-'));
const OMGEVING = { RTG_DATA_DIR: TMP, SMTP_URL: '' };

let eerlijk, liegend, clientToken, agentToken, clientCode, mid;
let regelsVoor = 0;

const json = (r) => r.json().catch(() => ({}));
function api(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) })
    .then(async (r) => ({ status: r.status, body: await json(r) }));
}
const mijn = (base, token) => api(base, '/api/vertegenwoordiging/mijn', {}, token);

test.before(async () => {
  eerlijk = await startServer({ env: OMGEVING });

  const reg = async (naam, mail, tel, geb) => (await api(eerlijk.base, '/api/auth/register',
    { name: naam, email: mail, phone: tel, password: 'geheim123', geboortedatum: geb,
      tier: 'rtg', pasApp: 'rtg' })).body.token;
  clientToken = await reg('Client Een', 'hspoor-client@x.nl', '0612349001', '1990-03-04');
  agentToken = await reg('Agent Twee', 'hspoor-agent@x.nl', '0612349002', '1986-05-06');

  const st = await api(eerlijk.base, '/api/state', {}, clientToken);
  clientCode = st.body.state.user.codename;

  /* De 18+-poort is A3 en niet een ingetypte datum: zonder deze keuring weigert
     `voorstel` en meet de rest van dit bestand niets. */
  await keurLidGoed(eerlijk.base, clientToken, clientCode, '1990-03-04');

  /* `tot` is verplicht en dat is geen formaliteit: een machtiging zonder einde
     is een blanco cheque (kern/vertegenwoordiging/machtiging.js). Negentig dagen
     vooruit valt ruim binnen het maximum en ruim buiten deze toets. */
  const tot = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const v = await api(eerlijk.base, '/api/vertegenwoordiging/voorstel',
    { client: clientCode, hoedanigheid: 'zaakwaarnemer', bevoegdheden: ['contract.lezen'], tot }, agentToken);
  assert.equal(v.status, 200, 'het voorstel mislukte: ' + JSON.stringify(v.body).slice(0, 240));
  mid = v.body.machtiging && v.body.machtiging.id;
  assert.ok(mid, 'geen machtiging-id uit het voorstel: ' + JSON.stringify(v.body).slice(0, 240));

  const a = await api(eerlijk.base, '/api/vertegenwoordiging/aanvaard', { id: mid }, clientToken);
  assert.equal(a.status, 200, 'aanvaarden mislukte: ' + JSON.stringify(a.body).slice(0, 240));
});

test.after(() => {
  stop(eerlijk && eerlijk.child);
  stop(liegend && liegend.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. zonder verraad handelt de gemachtigde gewoon binnen zijn machtiging', async () => {
  const r = await api(eerlijk.base, '/api/vertegenwoordiging/handel',
    { id: mid, bevoegdheid: 'contract.lezen' }, agentToken);
  assert.equal(r.status, 200, 'binnen de machtiging hoort gewoon door te gaan: ' +
    JSON.stringify(r.body).slice(0, 240));
  assert.equal(r.body.ok, true);
  /* Niet op de statuscode alleen: een vergeten await stuurt een Promise, en die
     serialiseert naar {} met een keurige 200 (dezelfde val als in
     test/ledenbaliespoor.test.js). */
  assert.equal(typeof r.body.reden, 'string', 'het antwoord is niet afgewacht: een Promise wordt {}');
});

test('2. GEVAL 1: een geweigerde poging geeft 403 EN staat in het spoor van de client', async () => {
  /* `factuur.voorbereiden` BESTAAT als bevoegdheid maar staat niet in deze
     machtiging. Dat is met opzet: een onbekende sleutel zou de weigering van de
     sleutelcontrole meten in plaats van die van de machtiging. */
  const r = await api(eerlijk.base, '/api/vertegenwoordiging/handel',
    { id: mid, bevoegdheid: 'factuur.voorbereiden' }, agentToken);
  assert.equal(r.status, 403, 'een bevoegdheid buiten de machtiging hoort te worden geweigerd');
  assert.match(String(r.body.error), /niet in de machtiging/i, 'de reden hoort mee te komen');
  /* BEVINDING, EN ER WORDT HIER NIETS OP GETOETST. `handelen.js` zet bij een
     weigering `gelogd: true` -- de aanroeper hoort te weten dat zijn poging is
     vastgelegd. Dat veld bereikt niemand: `stuur()` in
     routes/vertegenwoordiging.js is
         (r && r.error) ? res.status(...).json({ error: r.error }) : res.json(r)
     en gooit bij ELK foutantwoord alles behalve `error` weg, voor alle acht de
     routes. Dezelfde vorm als de `res.append` in AFSPRAAK.md: een laag zet een
     veld, de laag erboven laat het stil vallen. Dat is een besluit (welke velden
     mogen mee op een weigering?) en geen bouwfoutje, dus het staat hier
     opgeschreven in plaats van dat deze toets het vastpint. */

  const m0 = await mijn(eerlijk.base, clientToken);
  assert.equal(m0.body.log && m0.body.log.some(x => x.bevoegdheid === 'factuur.voorbereiden'), true,
    'het bewijs dat de weigering is vastgelegd komt uit het spoor zelf, niet uit het antwoord');

  const m = await mijn(eerlijk.base, clientToken);
  const regels = (m.body.log || []).filter(x => x.soort === 'handeling');
  const geweigerd = regels.find(x => x.bevoegdheid === 'factuur.voorbereiden');
  assert.ok(geweigerd, 'de GEWEIGERDE poging staat niet in het spoor van de client -- een log met alleen ' +
    'successen is een reclamefolder');
  assert.equal(geweigerd.gelukt, false, 'de regel hoort te dragen dat het NIET mocht');
  assert.ok(geweigerd.reden && geweigerd.reden.length > 10, 'zonder reden is de regel niet te lezen');
});

test('3. het spoor staat bij de CLIENT en niet bij de gemachtigde', async () => {
  /* Anders is het geen spoor maar een werkbriefje: wie namens u handelt, hoort
     dat niet in zijn eigen dossier te kunnen houden. */
  const m = await mijn(eerlijk.base, agentToken);
  const eigen = (m.body.log || []).filter(x => x.soort === 'handeling');
  assert.equal(eigen.length, 0, 'de handelingen staan in het dossier van de gemachtigde');
  assert.ok((m.body.ikSta || []).some(x => x.id === mid), 'de gemachtigde hoort de machtiging wel te zien');
});

test('4. GEMETEN DUBBELZINNIGHEID: `gelukt` volgt het oordeel en niet de uitvoering', async () => {
  /* ZIE DE KOP. Deze toets keurt niets goed; hij legt vast wat er vandaag staat,
     zodat de splitsing van `gelukt` in toegestaan + uitvoeringBekend zichtbaar
     wordt in plaats van stil.

     `contract.lezen` is een LEESbevoegdheid zonder klaarzetten. Er wordt geen
     contract gelezen en er wordt niets uitgevoerd -- en toch luidt het antwoord
     "Uitgevoerd binnen de machtiging" en draagt de spoorregel `gelukt: true`. */
  const m = await mijn(eerlijk.base, clientToken);
  const regel = (m.body.log || []).find(x => x.soort === 'handeling' && x.bevoegdheid === 'contract.lezen');
  assert.ok(regel, 'de toegestane handeling uit toets 1 hoort in het spoor te staan');
  assert.equal(regel.gelukt, true, 'vandaag betekent `gelukt` hier: het oordeel stond het toe');

  const r = await api(eerlijk.base, '/api/vertegenwoordiging/handel',
    { id: mid, bevoegdheid: 'contract.lezen' }, agentToken);
  assert.match(String(r.body.let), /Uitgevoerd/,
    'de zin claimt uitvoering; wordt dit gesplitst, dan hoort DEZE regel mee te veranderen');

  const na = await mijn(eerlijk.base, clientToken);
  regelsVoor = (na.body.log || []).length;
  assert.ok(regelsVoor > 0, 'er staat iets in het spoor om straks mee te vergelijken');
});

test('5. GEVAL 2: onder een liegende opslag gaat de handeling NIET door', async () => {
  /* De eerlijke server wordt gestopt en dezelfde datamap gaat open onder een
     opslag die schrijfacties bevestigt en weggooit (`schrijf-verloren`, het
     verraad dat server/db/index.js save() vroegtijdig laat terugkeren). */
  stop(eerlijk.child);
  eerlijk.child = null;
  liegend = await startServer({ env: Object.assign({}, OMGEVING, { RTG_VERRAAD: 'schrijf-verloren' }) });

  const r = await api(liegend.base, '/api/vertegenwoordiging/handel',
    { id: mid, bevoegdheid: 'contract.lezen' }, agentToken);
  assert.ok(r.status >= 500, 'de handeling gaf ' + r.status + ' terwijl het spoor niet vaststaat: ' +
    JSON.stringify(r.body).slice(0, 240));
  assert.notEqual(r.body.ok, true, 'er is een geslaagde handeling gemeld zonder dat het spoor vaststaat');
  assert.ok(!r.body.let || !/Uitgevoerd/.test(String(r.body.let)),
    'het antwoord claimt uitvoering terwijl het spoor niet vaststaat');
});

test('6. en er blijft ook geen regel achter: geen handeling EN geen spoor', async () => {
  /* DE HELFT DIE EEN STATUSCODE NIET LAAT ZIEN. Een 503 met een blijvende regel
     zou betekenen dat de poging alsnog is vastgelegd; een regel zonder 503 zou
     betekenen dat zij is uitgevoerd. Het hoort geen van beide te zijn.

     BEVINDING VAN 15 SEPTEMBER 2026, EN ZIJ IS DE REDEN DAT HIER WORDT
     HERSTART. Vraag je het de LIEGENDE server, dan staat de regel er wel: het
     spoor groeide van 5 naar 6 terwijl de route 503 gaf. Dat is geen tweede
     defect maar de vorm van `vastleggen()`: `bijeen()` draait eerst de mutatie
     (die het geheugenmodel aanpast) en commit daarna; faalt de commit, dan
     keert de route netjes met 503 terug maar wordt het GEHEUGEN niet
     teruggedraaid. Er is in deze bundel geen rollback -- `ROLLBACK` bestaat in
     scripts/lib/crashtaxonomie.js als contract, maar niet als handeling hier.

     Wat dat praktisch betekent: tussen de mislukte commit en de eerstvolgende
     herstart leest een lezer op ditzelfde proces een regel die niet bestaat.
     Deze toets legt daarom vast wat WEL hard is -- na een herstart is er niets
     -- en de bevinding staat hierboven zodat zij een besluit kan worden in
     plaats van een verrassing. Wie de rollback bouwt, mag deze alinea korten. */
  stop(liegend.child);
  liegend.child = null;
  const na = await startServer({ env: OMGEVING });
  liegend = na;                                   // zodat test.after hem opruimt
  const m = await mijn(na.base, clientToken);
  assert.equal((m.body.log || []).length, regelsVoor,
    'na een herstart staat er een regel in het spoor die onder een liegende opslag is geschreven; ' +
    'dan was de 503 een halve waarheid');
});
