/* De wachtlijst en de gemiste afspraak (kern/care/wachtlijst.js).

   Twee grenzen die deze laag draagt, en die allebei makkelijk te overschrijden
   zijn zonder dat iemand het merkt:

   1. Er wordt NIEMAND automatisch ingeboekt als er een slot vrijkomt. Een
      afspraak die geld kost hoort niet in uw agenda te verschijnen omdat een
      ander afzegde -- u krijgt bericht en boekt zelf.
   2. Een gemiste afspraak is GEEN cijfer dat met u meereist. Hij staat bij de
      aanbieder waar het gebeurde, en een andere zaak ziet hem niet.
   Draai los: node --test test/wachtlijst.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, lid2, sup, kliniek, spa;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wacht-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function boek(token, aanbieder, datum) {
  const beh = aanbieder.behandelingen[0];
  const r = await api('care/boek', { aanbiederId: aanbieder.id, behandelingId: beh.id,
    datum, tijd: beh.tijden[0] }, token);
  if (r.status === 200) await api('care/betaal', { ref: r.body.boeking.ref }, token);
  return r;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'CLARA' } });
  base = srv.base;
  const login = tier => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier }) }).then(r => r.json()).then(d => d.token);
  lid = await login('rtg');
  lid2 = await login('business');
  sup = (await api('supplier/login', { username: 'rahul', password: 'Imran' }, '')).body.token;
  const ov = (await api('care', {}, lid)).body;
  kliniek = ov.aanbieders.find(a => a.soort === 'kliniek');
  spa = ov.aanbieders.find(a => a.soort === 'spa');
  assert.ok(lid && lid2 && sup && kliniek && spa);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('op de wachtlijst gaan zegt erbij dat er niets voor u wordt ingeboekt', async () => {
  const r = await api('care/wachtlijst/zet', { aanbiederId: kliniek.id }, lid2);
  assert.equal(r.status, 200);
  assert.match(r.body.uitleg, /boekt het dan zelf/i);
  assert.match(r.body.uitleg, /niets voor u ingeboekt/i);

  const nog = await api('care/wachtlijst/zet', { aanbiederId: kliniek.id }, lid2);
  assert.equal(nog.body.alGezet, true, 'twee keer zetten maakt geen twee plekken');

  assert.equal((await api('care/wachtlijst', {}, lid2)).body.lijsten.length, 1);
  assert.equal((await api('care/wachtlijst', {}, lid)).body.lijsten.length, 0, 'en het is uw eigen lijst');
  assert.equal((await api('care/wachtlijst/zet', { aanbiederId: 'bestaat-niet' }, lid2)).status, 404);
});

test('een annulering seint de lijst, maar boekt niemand in', async () => {
  const b = await boek(lid, kliniek, overDagen(4));
  assert.equal(b.status, 200);

  const weg = await api('care/annuleer', { ref: b.body.boeking.ref }, lid);
  assert.equal(weg.status, 200);
  assert.equal(weg.body.wachtlijstGewekt, 1, 'het ene wachtende lid krijgt bericht');

  /* De harde bewering: lid2 stond op de lijst en heeft NIETS in zijn agenda. */
  const mijn2 = (await api('care/mijn', {}, lid2)).body.boekingen;
  assert.deepEqual(mijn2, [], 'er is niemand ingeboekt op het vrijgekomen slot');

  // en het slot is weer gewoon voor iedereen te boeken
  const opnieuw = await boek(lid2, kliniek, overDagen(4));
  assert.equal(opnieuw.status, 200, 'wie het eerst boekt, heeft het');
});

test('een gemiste afspraak wordt genoteerd, maar reist niet mee', async () => {
  const b = await boek(lid, kliniek, overDagen(0));
  assert.equal(b.status, 200);
  const ref = b.body.boeking.ref;

  assert.equal((await api('supplier/care/nietverschenen', { ref: 'RTG-C-NIET' }, sup)).status, 404);

  const r = await api('supplier/care/nietverschenen', { ref }, sup);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.uitleg, /andere zaken zien dit niet/i);
  assert.equal((await api('supplier/care/nietverschenen', { ref }, sup)).status, 409, 'niet twee keer');

  const gemist = (await api('supplier/care/gemist', {}, sup)).body;
  assert.equal(gemist.aantal, 1);
  assert.equal(gemist.gemist[0].ref, ref);
  assert.match(gemist.grens, /geen no-show-cijfer/i,
    'de aanbieder leest zelf dat dit zijn eigen agenda is en geen rapportcijfer');

  /* De grens die telt: er komt NERGENS een telling op naam van het lid uit.
     Deze bewering moest scherper. Eerst keek hij alleen in het overzicht van
     het lid -- en daar zou een cijfer ook nooit staan; een mutatie die er een
     noShowTotaal in het ANTWOORD AAN DE AANBIEDER bij zette, bleef gewoon
     groen. De aanbieder is nu juist de kant waar zo'n cijfer waarde zou hebben,
     dus daar wordt hij nagekeken. */
  for (const [wat, body] of [['de notering', r.body], ['het gemist-overzicht', gemist],
    ['het overzicht van het lid', (await api('care/mijn', {}, lid)).body]]) {
    assert.ok(!/noShow|noshow|gemistTotaal|totaalGemist|score|betrouwbaar/i.test(JSON.stringify(body)),
      'geen cijfer over het lid in ' + wat + ', onder welke naam dan ook');
  }
});

test('een afspraak die nog moet komen is niet gemist, en niet die van een ander', async () => {
  const later = await boek(lid, kliniek, overDagen(5));
  assert.equal((await api('supplier/care/nietverschenen', { ref: later.body.boeking.ref }, sup)).status, 400,
    'een afspraak van volgende week kun je nog niet gemist hebben');

  /* En een aanbieder komt niet bij de agenda van een ander: de spa-afspraak van
     lid2 is voor de kliniek onzichtbaar, ook al bestaat de referentie. */
  const bijSpa = await boek(lid2, spa, overDagen(0));
  assert.equal(bijSpa.status, 200);
  assert.equal((await api('supplier/care/nietverschenen', { ref: bijSpa.body.boeking.ref }, sup)).status, 404,
    'de kliniek noteert geen no-show op een afspraak bij de spa');

  assert.equal((await api('supplier/care/gemist', {}, lid)).status, 401,
    'een ledentoken opent de aanbiederdeur niet');
});

test('van de wachtlijst af kan, en die van een ander niet', async () => {
  const mijn = (await api('care/wachtlijst', {}, lid2)).body.lijsten[0];
  assert.equal((await api('care/wachtlijst/af', { id: mijn.id }, lid)).status, 404,
    'u haalt niemand anders van een lijst');
  assert.equal((await api('care/wachtlijst/af', { id: mijn.id }, lid2)).status, 200);
  assert.equal((await api('care/wachtlijst', {}, lid2)).body.lijsten.length, 0);

  // en dan seint een annulering ook niemand meer
  const b = await boek(lid, kliniek, overDagen(6));
  const weg = await api('care/annuleer', { ref: b.body.boeking.ref }, lid);
  assert.equal(weg.body.wachtlijstGewekt, 0, 'een lege lijst wekt niemand');
});
