/* DE NAZORG VAN EEN REISAANVRAAG: wijzigen en afzeggen nadat een mens de reis
   heeft bevestigd -- kern/reisbureau-nazorg.js.

   WAAROM DIT BESTAND ER IS. De keten van test/reisbureau.test.js eindigt bij de
   bevestiging, en daar eindigde de code ook: het lid kreeg "Deze aanvraag is al
   bevestigd" en het kantoor kreeg exact dezelfde weigering. Er was dus geen weg
   terug uit een toezegging, in geen enkele richting. Wat hier moet blijken is
   dat die weg er nu is EN dat hij de grenzen houdt die eromheen staan.

   ZEVEN BEWERINGEN, en ze kunnen alle zeven zakken:

   1. een lid VRAAGT een wijziging en voert hem niet uit;
   2. het kantoor past hem toe, en het bedrag telt mee met het aantal personen;
   3. een wijziging afwijzen kan alleen met een reden, en laat de reis staan;
   4. afzeggen kan alleen met een reden, en haalt de reis van de tijdlijn;
   5. een afzegging verplaatst geen geld en zegt dat met zoveel woorden;
   6. het lid ziet WAT er gebeurde, nooit WIE er in het kantoor op de knop drukte;
   7. het lid krijgt bericht -- dat ging tot nu toe nergens heen.

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const overNdagen = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

let srv, base, lidToken, office;

/* Een verse bevestigde reis per toets: deze toetsen veranderen allemaal de
   stand, dus ze mogen elkaars aanvraag niet erven. */
async function bevestigdeReis(personen = 2) {
  const cat = await api(base, '/api/reisbureau', {}, lidToken);
  const reis = cat.body.reizen[0];
  const aanvraag = await api(base, '/api/reisbureau/boek',
    { tripId: reis.id, personen, vertrek: overNdagen(60) }, lidToken);
  assert.equal(aanvraag.status, 200, 'de aanvraag komt binnen');
  const ref = aanvraag.body.aanvraag.ref;
  const ok = await api(base, '/api/office/reisbureau/besluit',
    { ref, besluit: 'bevestigd', bericht: 'Datum staat.' }, office);
  assert.equal(ok.body.aanvraag.status, 'bevestigd', 'een mens bevestigt hem');
  return { ref, prijsPp: ok.body.aanvraag.prijs.pp };
}
const mijne = async (ref) => (await api(base, '/api/reisbureau/mijn', {}, lidToken))
  .body.aanvragen.find(a => a.ref === ref);

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-nazorg-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Reiziger', email: 'n' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  lidToken = reg.body.token;
  const kantoor = await api(base, '/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  office = kantoor.body.token;
  assert.ok(lidToken && office, 'lid en kantoor zijn er');
});
test.after(() => stop(srv && srv.child));

test('1. een lid VRAAGT een wijziging; hij voert hem niet zelf uit', async () => {
  const { ref } = await bevestigdeReis();
  const nieuweDatum = overNdagen(75);
  const r = await api(base, '/api/reisbureau/wijzig', { ref, vertrek: nieuweDatum }, lidToken);
  assert.equal(r.status, 200);
  const a = await mijne(ref);
  assert.equal(a.status, 'wijziging-gevraagd', 'de reis wacht op het kantoor');
  assert.notEqual(a.vertrek, nieuweDatum, 'de datum is NIET stilletjes veranderd');
  assert.equal(a.wijziging.gevraagd.vertrek, nieuweDatum, 'de wens staat ernaast');
});

test('2. het kantoor past de wijziging toe, en het bedrag telt mee', async () => {
  const { ref, prijsPp } = await bevestigdeReis(2);
  await api(base, '/api/reisbureau/wijzig', { ref, personen: 4 }, lidToken);
  const r = await api(base, '/api/office/reisbureau/wijziging',
    { ref, besluit: 'toegepast', bericht: 'Twee plaatsen erbij, geregeld.' }, office);
  assert.equal(r.status, 200);
  const a = await mijne(ref);
  assert.equal(a.status, 'bevestigd', 'de reis staat weer rond');
  assert.equal(a.personen, 4);
  assert.equal(a.prijs.totaal, Math.round(prijsPp * 4 * 100) / 100,
    'het totaal is opnieuw gerekend en niet blijven staan op twee personen');
});

test('3. een wijziging afwijzen kan alleen met een reden, en laat de reis staan', async () => {
  const { ref } = await bevestigdeReis(2);
  await api(base, '/api/reisbureau/wijzig', { ref, personen: 5 }, lidToken);
  const zonder = await api(base, '/api/office/reisbureau/wijziging', { ref, besluit: 'afgewezen' }, office);
  assert.equal(zonder.status, 400, 'zonder reden gebeurt er niets');
  assert.equal((await mijne(ref)).status, 'wijziging-gevraagd', 'en de stand blijft staan');
  const met = await api(base, '/api/office/reisbureau/wijziging',
    { ref, besluit: 'afgewezen', bericht: 'De reis is vol.' }, office);
  assert.equal(met.status, 200);
  const a = await mijne(ref);
  assert.equal(a.status, 'bevestigd', 'de oorspronkelijke reis staat gewoon nog');
  assert.equal(a.personen, 2, 'en is niet aangepast');
});

test('4. afzeggen kan alleen met een reden, en haalt de reis van de tijdlijn', async () => {
  const { ref } = await bevestigdeReis();
  const voor = await api(base, '/api/reis/reizen', {}, lidToken);
  assert.ok(JSON.stringify(voor.body).includes(ref), 'de reis staat op de tijdlijn');

  assert.equal((await api(base, '/api/reisbureau/afzeggen', { ref }, lidToken)).status, 400,
    'afzeggen zonder reden wordt geweigerd');
  const r = await api(base, '/api/reisbureau/afzeggen', { ref, reden: 'Ziek geworden.' }, lidToken);
  assert.equal(r.status, 200);
  assert.equal((await mijne(ref)).status, 'afgezegd');

  const na = await api(base, '/api/reis/reizen', {}, lidToken);
  assert.ok(!JSON.stringify(na.body).includes(ref), 'en verdwijnt van de tijdlijn');
  const best = await api(base, '/api/mall/bestellingen', {}, lidToken);
  const regel = (best.body.bestellingen || []).find(b => b.id === ref);
  assert.equal(regel.stand, 'afgezegd', 'in het bestellingenoverzicht staat hij als afgezegd');
});

test('5. een afzegging verplaatst geen geld, en zegt dat', async () => {
  const { ref } = await bevestigdeReis();
  await api(base, '/api/office/reisbureau/afzeggen', { ref, reden: 'De partner kan niet leveren.' }, office);
  const a = await mijne(ref);
  assert.equal(a.geld.stand, 'nietGeregeld');
  assert.match(a.geld.uitleg, /mens/, 'er staat bij dat een mens dit afhandelt');
  assert.equal(a.afzegging.door, 'reisbureau');
});

test('6. het lid ziet WAT er gebeurde, niet WIE er in het kantoor op de knop drukte', async () => {
  const { ref } = await bevestigdeReis();
  await api(base, '/api/office/reisbureau/afzeggen', { ref, reden: 'Hotel gesloten.' }, office);
  const a = await mijne(ref);
  assert.ok(a.geschiedenis.length >= 2, 'bevestiging en afzegging staan er allebei in');
  for (const regel of a.geschiedenis) {
    assert.ok(regel.door === 'u' || regel.door === 'het reisbureau',
      'geen interne naam in het spoor van het lid, maar: ' + regel.door);
    assert.ok(!/user-\d+/.test(JSON.stringify(regel)), 'en geen sleutel ergens anders in de regel');
  }
});

test('7. het lid krijgt bericht van een besluit', async () => {
  const { ref } = await bevestigdeReis();
  const na = await api(base, '/api/notifications', {}, lidToken);
  const bericht = (na.body.notifications || []).find(n => (n.body || '').includes('Datum staat'));
  assert.ok(bericht, 'de bevestiging staat in de meldingen van het lid');
  assert.equal(bericht.scope, 'orders');

  await api(base, '/api/office/reisbureau/afzeggen', { ref, reden: 'Vlucht geschrapt.' }, office);
  const na2 = await api(base, '/api/notifications', {}, lidToken);
  assert.ok((na2.body.notifications || []).some(n => (n.body || '').includes('Vlucht geschrapt')),
    'en de afzegging ook');
});

test('8. een lege wijziging is geen verzoek, en afzeggen is geen intrekken', async () => {
  const { ref } = await bevestigdeReis();
  assert.equal((await api(base, '/api/reisbureau/wijzig', { ref }, lidToken)).status, 400,
    'niets gevraagd is geen wijziging');

  // een OPEN aanvraag zeg je niet af, die trek je in -- twee verschillende dingen
  const cat = await api(base, '/api/reisbureau', {}, lidToken);
  const open = await api(base, '/api/reisbureau/boek',
    { tripId: cat.body.reizen[0].id, personen: 1, vertrek: overNdagen(90) }, lidToken);
  const r = await api(base, '/api/reisbureau/afzeggen',
    { ref: open.body.aanvraag.ref, reden: 'toch niet' }, lidToken);
  assert.equal(r.status, 409, 'afzeggen kan alleen bij een reis die rond is');
});
