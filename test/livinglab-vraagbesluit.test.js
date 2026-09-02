/* HET BESLUIT OVER EEN BUURTVRAAG -- ook "nee" is een antwoord.

   Wat deze toets vastlegt:

     1. Een reden komt uit een GESLOTEN lijst. Vrije tekst levert "hier doen we
        niets mee" op, en dat is geen antwoord.
     2. Een toelichting is verplicht en vrij: de reden maakt het vergelijkbaar,
        de toelichting maakt het begrijpelijk voor deze ene bewoner.
     3. Het besluit draagt de naam van een mens.
     4. Een afgewezen vraag wordt NOOIT verwijderd: hij staat op de openbare lijst
        met zijn reden. Een afgewezen vraag die verdwijnt, is niet te
        onderscheiden van een vraag die nooit is gesteld.
     5. Een vraag die een onderzoek is geworden, kan niet alsnog worden afgewezen.
     6. Een besluit kan worden herzien, en het oude blijft in de geschiedenis.
     7. De stemmers gaan er nooit uit -- alleen hun aantal.

   Draai los: node --test test/livinglab-vraagbesluit.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { REDENEN, STANDEN } = require('../server/kern/livinglab/vraagbesluit');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vraag-'));
let srv, base, office, labId, vraagId, tweedeId;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  labId = (await api('/api/lab2/lab/maak', { naam: 'Lab IJmuiden', stad: 'IJmuiden' }, office)).body.lab.id;
  const v = await api('/api/lab2/bewoner/thema', { labId,
    vraag: 'Waarom zijn sommige straten s avonds veel warmer dan andere?', alias: 'BW-1' });
  vraagId = v.body.thema.id;
  const t = await api('/api/lab2/bewoner/thema', { labId,
    vraag: 'Kunnen we meten hoeveel geluid de haven s nachts maakt?', alias: 'BW-2' });
  tweedeId = t.body.thema.id;
  await api('/api/lab2/bewoner/stem', { id: vraagId, alias: 'BW-2' });
});
test.after(() => stop(srv));

test('1. de reden komt uit een gesloten lijst', async () => {
  const r = await api('/api/lab2/vraag/niet-starten', { id: vraagId, reden: 'geen tijd',
    toelichting: 'We hebben het nu te druk met andere dingen.', door: 'Sam van RTG' }, office);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Kies een reden uit de lijst/);
  for (const x of REDENEN) assert.match(r.body.error, new RegExp(x.reden));
});

test('2. de toelichting is verplicht, en de naam ook', async () => {
  const zonderTekst = await api('/api/lab2/vraag/niet-starten', { id: vraagId, reden: 'bestaat-al',
    toelichting: 'nee', door: 'Sam van RTG' }, office);
  assert.equal(zonderTekst.status, 400);
  assert.match(zonderTekst.body.error, /gewone taal/);

  const zonderNaam = await api('/api/lab2/vraag/niet-starten', { id: vraagId, reden: 'bestaat-al',
    toelichting: 'Er loopt al een landelijk onderzoek naar dit onderwerp; wij zouden het overdoen.' }, office);
  assert.equal(zonderNaam.status, 400);
  assert.match(zonderNaam.body.error, /naam/);
});

test('3. een afgewezen vraag blijft openbaar staan, met reden en uitleg', async () => {
  await api('/api/lab2/vraag/verken', { id: vraagId, notitie: 'Nagevraagd bij de gemeente.' }, office);
  const r = await api('/api/lab2/vraag/niet-starten', { id: vraagId, reden: 'niet-te-scheiden',
    toelichting: 'We kunnen temperatuurverschillen niet betrouwbaar scheiden van woningtype en verkeersdruk.',
    door: 'Sam van RTG' }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body));

  /* Openbaar: geen inlog. */
  const lijst = await api('/api/lab2/publiek/vragen', { labId });
  assert.equal(lijst.status, 200);
  const v = lijst.body.vragen.find(x => x.id === vraagId);
  assert.ok(v, 'de afgewezen vraag staat er nog');
  assert.equal(v.stand, 'niet-gestart');
  assert.equal(v.besluit.reden, 'niet-te-scheiden');
  assert.ok(v.besluit.redenNaam && v.besluit.redenUitleg, 'de reden krijgt een naam en een uitleg, want een code zegt een bewoner niets');
  assert.match(v.besluit.toelichting, /verkeersdruk/);
  assert.equal(v.besluit.door, 'Sam van RTG');
  assert.equal(v.verkend.notitie, 'Nagevraagd bij de gemeente.');
});

test('4. de stemmers gaan er nooit uit -- alleen hun aantal', async () => {
  const lijst = await api('/api/lab2/publiek/vragen', { labId });
  const v = lijst.body.vragen.find(x => x.id === vraagId);
  assert.equal(v.stemmen, 1, 'het aantal telt');
  const tekst = JSON.stringify(lijst.body);
  assert.ok(!tekst.includes('BW-2') || !/"stemmers"/.test(tekst), 'de stemmers zelf staan in de openbare lijst');
  assert.ok(!/"stemmers"/.test(tekst), 'er staat een stemmerslijst in het antwoord');
});

test('5. de standen worden geteld, en ook de lege', async () => {
  const lijst = await api('/api/lab2/publiek/vragen', { labId });
  for (const st of STANDEN) assert.ok(st in lijst.body.perStand, 'stand ' + st + ' wordt niet geteld');
  assert.equal(lijst.body.perStand['niet-gestart'], 1);
  assert.equal(lijst.body.perStand.ingediend, 1, 'de tweede vraag staat nog op ingediend');
  assert.match(lijst.body.let, /alleen zijn successen/);
});

test('6. een besluit kan worden herzien, en het oude blijft in de geschiedenis', async () => {
  const h = await api('/api/lab2/vraag/heroverweeg', { id: vraagId,
    reden: 'De gemeente levert nu verkeersdata aan, waardoor de vraag wel te scheiden is.' }, office);
  assert.equal(h.status, 200, JSON.stringify(h.body));
  assert.equal(h.body.vraag.stand, 'verkend');
  assert.equal(h.body.vraag.besluit, null);
  assert.equal(h.body.vraag.eerderHerzien, 1, 'het oude besluit blijft in de geschiedenis staan');
});

test('7. een vraag die een onderzoek is geworden, wordt niet alsnog afgewezen', async () => {
  const st = (await api('/api/lab2/studie/maak', { labId, titel: 'Geluid rond de haven',
    soort: 'leefomgeving', vraagstuk: 'Hoeveel geluid ervaren bewoners rond de haven?', doel: 'inzicht' }, office)).body.studie;
  const k = await api('/api/lab2/thema/koppel', { themaId: tweedeId, studieId: st.id }, office);
  assert.equal(k.status, 200, JSON.stringify(k.body));

  const r = await api('/api/lab2/vraag/niet-starten', { id: tweedeId, reden: 'bestaat-al',
    toelichting: 'Toch maar niet, we hebben het al onderzocht.', door: 'Sam van RTG' }, office);
  assert.equal(r.status, 409);

  const lijst = await api('/api/lab2/publiek/vragen', { labId });
  const v = lijst.body.vragen.find(x => x.id === tweedeId);
  assert.equal(v.stand, 'gestart', 'de stand volgt uit de koppeling en wordt niet met de hand gezet');
});
