/* De derde herkomst: een behandelaar die iets vastlegt (kern/care/vastleggen.js).
   Dit is de eerste laag waarin iemand ANDERS dan het lid in het dossier van dat
   lid schrijft, en daarom staan hier vooral de grenzen:

   - zonder uitdrukkelijke toestemming van het lid gebeurt er niets, en de
     intake-deling is die toestemming NIET (die gaat de andere kant op);
   - een behandelaar komt alleen bij een lid waarmee hij een afspraak heeft, en
     schrijft op een referentie en niet op een naam;
   - wat vastligt draagt de naam van wie het vastlegde;
   - intrekken stopt nieuwe vastleggingen en wist niet wat er gemeten is.
   Draai los: node --experimental-sqlite --test test/vastleggen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, lid2, kliniek, sup, ref;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vastleg-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'CLARA' } });
  base = srv.base;
  const login = tier => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier }) }).then(r => r.json()).then(d => d.token);
  lid = await login('rtg');
  lid2 = await login('business');
  sup = (await api('supplier/login', { username: 'rahul', password: 'Imran' }, '')).body.token;
  assert.ok(lid && lid2 && sup, 'twee leden en de kliniek');

  // een afspraak bij de kliniek, betaald, zodat de behandelaar hem in zijn agenda heeft
  const ov = (await api('care', {}, lid)).body;
  kliniek = ov.aanbieders.find(a => a.soort === 'kliniek');
  const beh = kliniek.behandelingen[0];
  const boek = await api('care/boek', { aanbiederId: kliniek.id, behandelingId: beh.id,
    datum: morgen(), tijd: beh.tijden[0] }, lid);
  assert.equal(boek.status, 200, JSON.stringify(boek.body));
  ref = boek.body.boeking.ref;
  await api('care/betaal', { ref }, lid);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('zonder toestemming legt de behandelaar niets vast, ook niet met een afspraak', async () => {
  const r = await api('supplier/care/vastleggen', { ref, onderwerp: 'gewicht', waarde: 82 }, sup);
  assert.equal(r.status, 403);
  assert.match(r.body.error, /toestemming/i);
  assert.match(r.body.error, /zet het zelf aan/i, 'en er staat bij hoe het wel kan');
  assert.equal((await api('metingen', {}, lid)).body.beeld.gewicht.gemeten, false,
    'er staat niets in het dossier');
});

test('de intake-deling is die toestemming NIET: het zijn twee richtingen', async () => {
  /* Het lid deelt medische context MET de kliniek. Dat is de andere kant op dan
     de kliniek die iets IN het dossier zet, en de ene mag de andere niet
     aanzetten -- anders zegt het scherm het ene en doet het systeem het andere. */
  const deel = await api('care/intake/deel', { aanbiederId: kliniek.id, medisch: 'bloedverdunner' }, lid);
  assert.equal(deel.status, 200);

  const r = await api('supplier/care/vastleggen', { ref, onderwerp: 'gewicht', waarde: 82 }, sup);
  assert.equal(r.status, 403, 'een gedeelde intake geeft geen schrijfrecht');
});

test('met toestemming legt de behandelaar vast, met zijn naam erbij', async () => {
  const aan = await api('care/vastleggen/deel', { aanbiederId: kliniek.id }, lid);
  assert.equal(aan.status, 200);

  const r = await api('supplier/care/vastleggen', { ref, onderwerp: 'gewicht', waarde: 82.4 }, sup);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.bron, 'behandelaar');
  assert.equal(r.body.door, kliniek.naam);

  const beeld = (await api('metingen', {}, lid)).body.beeld.gewicht;
  assert.equal(beeld.vandaag, 82.4);
  assert.deepEqual(beeld.herkomsten, ['behandelaar']);
  assert.equal(beeld.vandaagDoor, kliniek.naam, 'niet "een behandelaar" maar WELKE');
});

test('een behandelaar gaat voor een apparaat, en een apparaat voor uw eigen woord', async () => {
  /* Drie beweringen over dezelfde dag. Ze staan er alle drie; het getal komt van
     de hoogste rang, en wat niet is meegeteld blijft zichtbaar. */
  const sleutel = (await api('toestellen/koppel', { naam: 'Weegschaal' }, lid)).body.sleutel;
  await fetch(base + '/api/toestel/meting', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rtg-toestel': sleutel },
    body: JSON.stringify({ onderwerp: 'gewicht', waarde: 83 })
  });
  await api('metingen/zet', { onderwerp: 'gewicht', waarde: 80 }, lid);

  const beeld = (await api('metingen', {}, lid)).body.beeld.gewicht;
  assert.equal(beeld.dagen, 1, 'het blijft een dag');
  assert.equal(beeld.vandaag, 82.4, 'de behandelaar staat bovenaan de rangorde');
  assert.deepEqual(beeld.herkomsten, ['behandelaar'], 'en het getal komt daarvandaan');
  assert.deepEqual(beeld.naast, ['apparaat', 'zelf'], 'de andere twee staan er nog, apart');
});

test('een behandelaar komt niet bij een lid waar hij geen afspraak mee heeft', async () => {
  assert.equal((await api('supplier/care/vastleggen', { ref: 'RTG-C-VERZONNEN', onderwerp: 'gewicht', waarde: 70 }, sup)).status, 404);

  /* De scherpste vorm, en die ontbrak eerst: een afspraak die WEL bestaat maar
     bij een ANDERE aanbieder, van een lid dat die andere aanbieder netjes
     toestemming gaf. Een verzonnen referentie bewijst hier niets -- die bestaat
     nergens. Dit is het geval waarin de kliniek in het dossier van een spa-gast
     zou kunnen schrijven, en dat is de fout die de aanbiedercontrole tegenhoudt. */
  const spa = (await api('care', {}, lid2)).body.aanbieders.find(a => a.soort === 'spa');
  const spaBeh = spa.behandelingen[0];
  const spaBoek = await api('care/boek', { aanbiederId: spa.id, behandelingId: spaBeh.id,
    datum: morgen(), tijd: spaBeh.tijden[0] }, lid2);
  assert.equal(spaBoek.status, 200, JSON.stringify(spaBoek.body));
  await api('care/betaal', { ref: spaBoek.body.boeking.ref }, lid2);
  await api('care/vastleggen/deel', { aanbiederId: spa.id }, lid2);

  const vreemde = await api('supplier/care/vastleggen',
    { ref: spaBoek.body.boeking.ref, onderwerp: 'gewicht', waarde: 70 }, sup);
  assert.equal(vreemde.status, 404,
    'de kliniek kan niet schrijven op een afspraak bij de spa, ook niet als dat lid de spa toestemming gaf');

  assert.equal((await api('supplier/care/vastleggen', { ref, onderwerp: 'dromen', waarde: 3 }, sup)).status, 404);
  assert.equal((await api('supplier/care/vastleggen', { ref, onderwerp: 'gewicht', waarde: 900 }, sup)).status, 400);
  assert.equal((await api('metingen', {}, lid2)).body.beeld.gewicht.gemeten, false,
    'lid 2 heeft geen afspraak bij deze kliniek en dus ook niets in zijn dossier');

  // en zonder zaak-sessie is de deur dicht
  assert.equal((await api('supplier/care/vastleggen', { ref, onderwerp: 'gewicht', waarde: 70 }, lid)).status, 401,
    'een ledentoken opent de behandelaarsdeur niet');
});

test('de toestemming staat in het Consent Center, en intrekken stopt het schrijven', async () => {
  const lijst = (await api('toestemming', {}, lid)).body.toestemmingen;
  const rij = lijst.find(t => t.laag === 'care-vastlegging');
  assert.ok(rij, 'de zevende laag staat op het toestemmingsscherm');
  assert.equal(rij.wie, kliniek.naam);
  assert.equal(rij.richting, 'schrijft', 'dit is schrijven en geen zien; dat verschil staat er');

  assert.equal((await api('toestemming/intrek', { laag: 'care-vastlegging', id: rij.id }, lid)).status, 200);

  const na = await api('supplier/care/vastleggen', { ref, onderwerp: 'gewicht', waarde: 79 }, sup);
  assert.equal(na.status, 403, 'na intrekken legt de kliniek niets meer vast');

  const beeld = (await api('metingen', {}, lid)).body.beeld.gewicht;
  assert.equal(beeld.vandaag, 82.4, 'en wat er lag, ligt er nog: dat is echt gemeten');
  assert.equal(beeld.vandaagDoor, kliniek.naam, 'met de naam er nog steeds bij');
});
