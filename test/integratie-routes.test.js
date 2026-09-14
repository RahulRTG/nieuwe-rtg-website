/* DE VIJF ROUTES DIE DEZE TAKKEN TOEVOEGDEN, over HTTP.

   `endpointsZonderTest` in NORM.json telt endpoints die in geen enkele toets
   voorkomen. Vier daarvan zijn hier bijgekomen, en ze hadden alle vier wel
   unit-toetsen maar geen enkele die ze als ROUTE aanroept.

   DE VIJFDE KWAM ER OP 13 SEPTEMBER 2026 BIJ, en die is de scherpste illustratie
   van alles hieronder: /api/supplier/activity HAD een toets, maar die monteerde
   de handler op een NAGEMAAKTE app. Over HTTP raakte hem alleen een script. De
   dekkingspoort (test/routedekking.test.js) vond hem daarom als enige gat van
   5042 routes -- met een harde nulgrens en geen norm om die eis mee te verlagen.
   Deze kop stond er toen al. Zie LAT.md regel 13.

   DE VIERDE STOND ER EERST NIET BIJ, en de deltapoort vond hem: de
   correctieroute wordt wel over HTTP beproefd, maar door
   scripts/tafelproef.js -- en dat is een SCRIPT en geen toets. Het verschil
   telt: een script draait in de meetronde, een toets in elke CI-run. In de
   woorden van de poort zelf: schrijf de toets in dezelfde wijziging, want
   een endpoint dat later een toets krijgt, krijgt hem niet.

   Het verschil met een unit-toets is echt: de eenheid kan kloppen terwijl de
   route niet gemonteerd is, achter de verkeerde poort hangt of een naam vraagt
   die de domeingrens niet kent -- dat laatste is hier twee keer gebeurd tijdens
   het bouwen.

   WAT ELKE TOETS HIER MEET is dus niet de logica (die staat in
   test/ankerpost.test.js en test/objectpagina.test.js) maar de BEDRADING: komt
   de aanroep aan, achter welke deur, en zegt het antwoord de waarheid over wat
   er wel en niet in bedrijf is.

   Draai los: node --test test/integratie-routes.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const wegwerp = require('../scripts/lib/wegwerpserver');

const KANTOOR = 'RTG-OFFICE-TOETS';
const ZAAK = 'KIKUNOI';          // de horecazaak uit de seed

let srv;
test.before(async () => {
  srv = await wegwerp.start({ naam: 'integratieroutes', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', OFFICE_CODE: KANTOOR, DEMO_SUPPLIER: ZAAK } });
});
test.after(() => { try { srv.klaar(); } catch (e) {} });

const post = async (pad, lijf, tok) => {
  const r = await fetch(srv.basis + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' },
      tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {}) });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const kantoor = async () => (await post('/api/office/login', { code: KANTOOR })).data.token;

test('1. de ankerpost zit achter de kantoordeur en nergens anders', async () => {
  for (const pad of ['/api/office/anker/post', '/api/office/anker/post/reken']) {
    const zonder = await post(pad, {});
    assert.equal(zonder.status, 401, pad + ' is zonder kantoorcode bereikbaar');
  }
});

test('2. zonder bestemming meldt de post zich als NIET in bedrijf, en niet als storing', async () => {
  /* De scherpste eigenschap van deze laag: geen bestemming is geen fout maar
     "niet in bedrijf", en dat hoort ook zo uit de route te komen. Een 500 zou
     hier betekenen dat de afwezigheid van een tweede machine als storing leest,
     en dan gaat iemand hem repareren in plaats van hem te BESLUITEN. */
  const K = await kantoor();
  const r = await post('/api/office/anker/post', {}, K);
  assert.equal(r.status, 200);
  assert.equal(r.data.post.inBedrijf, false);
  assert.match(r.data.post.reden, /RTG_ANKERPOST_URL/);
  assert.equal(r.data.ok, true, 'de route zelf slaagde niet, terwijl alleen de bestemming ontbreekt');
  /* De uitkomst van de POST staat apart van het `ok` van de route. Hier stond
     een Object.assign die de twee door elkaar liet lopen, en dan las "geen
     bestemming" als een mislukte aanroep. */
  assert.equal(r.data.uitkomst.ok, false);
  assert.ok(r.data.uitkomst.blok && r.data.uitkomst.blok.zegel, 'het blok van nu komt niet mee terug');
});

test('3. de grens van een tweede machine BINNEN RTG staat in het antwoord', async () => {
  /* Niet alleen in een document: wie deze route leest hoort te zien wat het
     anker niet bewijst. */
  const K = await kantoor();
  const r = await post('/api/office/anker', {}, K);
  assert.equal(r.status, 200);
  assert.match(r.data.post.grens, /beide machines|buiten dit huis/i);
  assert.equal(r.data.inBedrijf, false, 'de ankerdienst meldt zich als in bedrijf zonder blok naar buiten');
});

test('4. de objectpagina geeft alle tien secties, ook de lege', async () => {
  const lid = await post('/api/login', { tier: 'rtg' });
  const M = lid.data && lid.data.token;
  assert.ok(M, 'geen lidsessie (status ' + lid.status + ')');

  /* Een object dat dit lid niet kent geeft 404 -- en dat is dezelfde 404 als
     "bestaat niet", met opzet (zie routes/sociaal.js). */
  const weg = await post('/api/sociaal/object/pagina', { soort: 'groep', id: 'bestaat-niet' }, M);
  assert.equal(weg.status, 404);

  /* De persoon is de uitzondering: een codenaam waar dit lid niets mee heeft,
     bestaat wel en levert nul caps. Daarmee is de pagina te meten zonder een
     wereld op te bouwen -- en juist dan hoort hij TIEN secties te geven. */
  const p = await post('/api/sociaal/object/pagina', { soort: 'persoon', id: 'Sperwer' }, M);
  assert.equal(p.status, 200, 'de objectpagina is niet bereikbaar voor een lid');
  assert.equal(p.data.secties.length, 10);
  const standen = new Set(p.data.secties.map(s => s.stand));
  for (const s of standen) assert.ok(['gevuld', 'leeg', 'nietGevraagd'].includes(s), 'onbekende stand: ' + s);
  assert.ok(p.data.secties.some(s => s.stand === 'nietGevraagd'),
    'geen enkele sectie meldt zich als nietGevraagd -- dan vouwt de structuur haar eigen gaten weg');
  for (const s of p.data.secties)
    if (s.stand !== 'gevuld') assert.ok(s.uitleg && s.uitleg.length > 10, s.id + ': leeg zonder uitleg');
});

test('5. de objectpagina is niet openbaar', async () => {
  const zonder = await post('/api/sociaal/object/pagina', { soort: 'persoon', id: 'Sperwer' });
  assert.equal(zonder.status, 401);
});

test('6. de correctie op een rekeningregel: de regel blijft staan en telt nul', async () => {
  /* De vierde route. Wat hier telt is de invariant uit kern/horeca/correctie.js:
     een gecorrigeerde regel wordt NIET verwijderd -- hij blijft zichtbaar en
     telt nul via regelSom. Weghalen zou de geschiedenis wissen; nul tellen doet
     het bedrag kloppen. */
  const sup = await post('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  const S = sup.data && sup.data.token;
  assert.ok(S, 'geen zaaksessie (status ' + sup.status + ')');

  const kaart = await post('/api/supplier/horeca/kaart', {}, S);
  const item = kaart.data.groepen[0].items[0];
  const rek = await post('/api/supplier/horeca/rekening/open', { tafel: 'TOETS-1' }, S);
  const rekeningId = rek.data.rekening.id;
  await post('/api/supplier/horeca/rekening/regel', { rekeningId, itemId: item.id, aantal: 1 }, S);

  const voor = await post('/api/supplier/horeca/rekening', { rekeningId }, S);
  const regel = voor.data.rekening.regels[0];
  const brutoVoor = voor.data.rekening.totalen.bruto;

  const zonderGrond = await post('/api/supplier/horeca/rekening/regel/corrigeer',
    { rekeningId, regelId: regel.id, reden: 'zomaar' }, S);
  assert.ok(zonderGrond.status >= 400, 'een correctie zonder grond komt erdoor');

  const uit = await post('/api/supplier/horeca/rekening/regel/corrigeer',
    { rekeningId, regelId: regel.id, grond: 'verkeerd-bereid', reden: 'koud geserveerd' }, S);
  assert.equal(uit.status, 200);

  const na = await post('/api/supplier/horeca/rekening', { rekeningId }, S);
  const zelfdeRegel = na.data.rekening.regels.find(r => r.id === regel.id);
  assert.ok(zelfdeRegel, 'de gecorrigeerde regel is verdwenen; dan is de geschiedenis weg');
  assert.ok(zelfdeRegel.gecorrigeerd, 'de regel draagt geen correctie');
  assert.ok(na.data.rekening.totalen.bruto < brutoVoor, 'de correctie telt niet mee in het totaal');

  /* Een tweede correctie op dezelfde regel hoort te weigeren; anders trekt hij
     twee keer af. Dat is de toestandscontrole uit het mutatiecontract. */
  const nogmaals = await post('/api/supplier/horeca/rekening/regel/corrigeer',
    { rekeningId, regelId: regel.id, grond: 'niet-gebracht', reden: 'tweede poging' }, S);
  assert.ok(nogmaals.status >= 400, 'een tweede correctie op dezelfde regel komt erdoor');
  const na2 = await post('/api/supplier/horeca/rekening', { rekeningId }, S);
  assert.equal(na2.data.rekening.totalen.bruto, na.data.rekening.totalen.bruto,
    'de tweede correctie veranderde het totaal; dan trekt hij twee keer af');
});

test('7. het activiteitenspoor van een zaak is over HTTP op te vragen, alleen door de manager', async () => {
  /* DE VIJFDE ROUTE, EN HIJ HERHAALT DE FOUT UIT DE KOP VAN DIT BESTAND.

     `POST /api/supplier/activity` kreeg bij het sluiten van keten 1 een eigen
     toets (test/supplier-activity.test.js), maar die MONTEERT de handler op een
     nagemaakte app. Dat beproeft de logica en niet de bedrading -- de route zoals
     de server hem registreert werd nooit aangeraakt. Over HTTP raakte hem alleen
     scripts/zaakliveproef.js, en dat is een SCRIPT: het draait in de meetronde en
     niet in elke CI-run.

     De poort van test/routedekking.test.js vond dat precies zoals bedoeld: 1 van
     5042 routes nooit aangeraakt, zonder norm om die eis mee te verlagen. Exact
     het geval dat de kop hierboven al beschrijft -- hier dus nog een keer
     gemaakt, en nu op dezelfde plek gerepareerd.

     Wat deze toets meet is de bedrading: komt de aanroep aan, achter welke deur,
     en geeft hij het spoor van DEZE zaak. */
  const zonder = await post('/api/supplier/activity', {});
  assert.equal(zonder.status, 401, 'het activiteitenspoor is zonder zaaksessie bereikbaar');

  const sup = await post('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  const S = sup.data && sup.data.token;
  assert.ok(S, 'geen zaaksessie (status ' + sup.status + ')');

  const uit = await post('/api/supplier/activity', {}, S);
  assert.equal(uit.status, 200, 'de manager komt niet bij het spoor van zijn eigen zaak');
  assert.ok(Array.isArray(uit.data.activity), 'het antwoord draagt geen lijst');
  assert.equal(typeof uit.data.totaal, 'number', 'het antwoord zegt niet hoeveel er in totaal zijn');

  /* De randgevallen die hier echt zijn gevonden (zie test/supplier-activity.test.js):
     een negatief aantal gaf er exact EEN terug -- en dat leest als "er is bijna
     niets gebeurd in deze zaak" in plaats van als een verkeerde vraag. */
  const negatief = await post('/api/supplier/activity', { aantal: -3 }, S);
  assert.equal(negatief.status, 200);
  assert.ok(negatief.data.activity.length !== 1 || uit.data.activity.length <= 1,
    'een negatief aantal valt niet terug op de standaard maar levert precies een rij');
});
