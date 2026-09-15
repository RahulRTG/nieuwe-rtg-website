/* RTG Neiging tegen een ECHTE server: de deur en de montage.

   test/neiging.test.js bewijst het gedrag van de laag. Dit bestand bewijst wat
   die toets per definitie niet kan: dat de router werkelijk is opgehangen, dat
   de domeingrens de namen doorlaat, en dat de poort doet wat hij belooft. Een
   nagemaakte app bewijst het handlergedrag en niet de bedrading -- LAT-regel
   17, en de reden dat er geen nieuwe HTTP-route bij komt zonder minstens een
   treffer op een echte server. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

let server, base, token;
const post = async (pad, body, tk) => {
  const r = await fetch(base + pad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) },
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

test.before(async () => {
  server = await startServer({ env: { SMTP_URL: '' } });
  base = server.base;
  const r = await post('/api/auth/register', {
    name: 'Adaptief Lid', email: 'adaptief@rtg.test', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg'
  });
  token = r.body.token;
  assert.ok(token, 'registratie leverde geen token');
});
test.after(() => stop(server && server.child));

test('de intake loopt over echte routes en kapt zichzelf af', async () => {
  let s = await post('/api/neiging/intake', {}, token);
  assert.equal(s.status, 200, JSON.stringify(s.body).slice(0, 200));
  assert.equal(s.body.klaar, false, 'een vers lid hoort een vraag te krijgen');

  const gehad = [];
  let rondes = 0;
  while (!s.body.klaar) {
    assert.ok(rondes++ < 12, 'de intake eindigt niet');
    const v = s.body.vraag;
    assert.ok(v && v.id, 'er hoort een vraag in te zitten');
    assert.ok(!gehad.includes(v.id), 'vraag ' + v.id + ' kwam twee keer');
    assert.ok(v.winst > 0, 'een vraag zonder winst hoort niet gesteld te worden');
    gehad.push(v.id);
    s = await post('/api/neiging/antwoord',
      { vraag: v.id, onderwerpen: [v.opties[0].onderwerp] }, token);
    assert.equal(s.status, 200);
  }
  assert.ok(rondes >= 2, 'er hoort minstens een vervolgvraag te komen');
  assert.ok(s.body.opent.length > 0, 'na de intake hoort er iets open te staan');
});

test('het geheugen toont wat het lid zelf zei, met grond en doel', async () => {
  const g = await post('/api/neiging/geheugen', {}, token);
  assert.equal(g.status, 200);
  assert.ok(g.body.neigingen.length > 0);
  const n = g.body.neigingen[0];
  assert.equal(n.grond, 'gezegd');
  assert.equal(n.graad, 'bewezen');
  assert.ok(n.grondUitleg, 'de uitleg hoort mee te reizen met de rij');
  assert.ok(n.doelen.every(d => d.uitleg));
  assert.ok(g.body.grenzen.length >= 4, 'de kaart hoort zijn eigen rand te noemen');
  assert.ok(g.body.bewaardagen > 0, 'er hoort een bewaartermijn in te staan');
});

test('niet-hiervoor-gebruiken werkt, en vergeten haalt het echt weg', async () => {
  const voor = await post('/api/neiging/geheugen', {}, token);
  const doel = voor.body.neigingen[0];
  assert.ok(doel.doel.includes('tonen'));

  const geweigerd = await post('/api/neiging/niet-voor', { id: doel.id, doel: 'tonen' }, token);
  assert.equal(geweigerd.status, 200);
  assert.ok(!geweigerd.body.neiging.doel.includes('tonen'));

  const weg = await post('/api/neiging/vergeet', { id: doel.id }, token);
  assert.equal(weg.status, 200);
  const na = await post('/api/neiging/geheugen', {}, token);
  /* TELLEN EN NIET ALLEEN ZOEKEN. `some(...)` is onwaar op een lege lijst, dus
     een route die ALLES weggooit zou deze bewering ook halen. Het aantal moet
     met precies een dalen (scripts/tandeloos.js wees dit aan). */
  assert.equal(na.body.neigingen.length, voor.body.neigingen.length - 1,
    'vergeten hoort er precies EEN weg te halen');
  assert.ok(!na.body.neigingen.some(n => n.id === doel.id), 'en wel die ene');
});

test('een onbekend doel wordt geweigerd en geeft geen lege lijst', async () => {
  const g = await post('/api/neiging/geheugen', {}, token);
  const id = g.body.neigingen[0] && g.body.neigingen[0].id;
  if (!id) return; // niets meer over om mee te toetsen
  const r = await post('/api/neiging/niet-voor', { id, doel: 'adverteren' }, token);
  assert.equal(r.status, 400, 'adverteren bestaat niet en hoort te WEIGEREN');
});

test('zonder inlog komt er niets uit deze laag', async () => {
  for (const pad of ['/api/neiging/intake', '/api/neiging/geheugen']) {
    const r = await post(pad, {});
    assert.ok(r.status === 401 || r.status === 403, pad + ' gaf ' + r.status);
  }
});

test('een tweede lid ziet niets van het eerste', async () => {
  const ander = await post('/api/auth/register', {
    name: 'Tweede Lid', email: 'adaptief2@rtg.test', phone: '0612345679',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg'
  });
  const g = await post('/api/neiging/geheugen', {}, ander.body.token);
  assert.equal(g.status, 200);
  const eigen = await post('/api/neiging/geheugen', {}, token);

  /* HET CONTRAST IS DE BEWERING, EN NIET DE NUL. `length === 0` voor het tweede
     lid is ook waar als de route voor IEDEREEN niets teruggeeft -- dan staat
     deze toets groen boven een kapotte laag. Wat werkelijk moet gelden is dat
     de een wel iets heeft en de ander niet, en dat is een uitspraak die je in
     een keer doet. scripts/tandeloos.js wees de oude vorm aan als een bewering
     die op een lege verzameling vanzelf slaagt. */
  assert.deepEqual(
    { eerste: eigen.body.neigingen.length > 0, tweede: g.body.neigingen.length },
    { eerste: true, tweede: 0 },
    'een vers lid hoort leeg te zijn terwijl het eerste lid wel degelijk neigingen heeft');
});

test('overslaan kan, en daarna komt er geen vraag meer', async () => {
  const derde = await post('/api/auth/register', {
    name: 'Derde Lid', email: 'adaptief3@rtg.test', phone: '0612345680',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg'
  });
  const tk = derde.body.token;
  assert.equal((await post('/api/neiging/intake', {}, tk)).body.klaar, false);
  assert.equal((await post('/api/neiging/overslaan', {}, tk)).status, 200);
  assert.equal((await post('/api/neiging/intake', {}, tk)).body.klaar, true);
  /* En opnieuw beginnen brengt de vragen terug -- overslaan is geen eenrichting. */
  assert.equal((await post('/api/neiging/opnieuw', {}, tk)).body.klaar, false);
});
