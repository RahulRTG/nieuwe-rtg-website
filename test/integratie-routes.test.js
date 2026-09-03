/* DE DRIE ROUTES DIE DEZE TAKKEN TOEVOEGDEN, over HTTP.

   `endpointsZonderTest` in NORM.json telt endpoints die in geen enkele toets
   voorkomen. Drie daarvan zijn hier bijgekomen, en ze hadden alle drie wel
   unit-toetsen maar geen enkele die ze als ROUTE aanroept. Dat verschil is
   echt: de eenheid kan kloppen terwijl de route niet gemonteerd is, achter de
   verkeerde poort hangt of een naam vraagt die de domeingrens niet kent -- dat
   laatste is bij deze drie twee keer gebeurd tijdens het bouwen.

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

let srv;
test.before(async () => {
  srv = await wegwerp.start({ naam: 'integratieroutes', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', OFFICE_CODE: KANTOOR } });
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
