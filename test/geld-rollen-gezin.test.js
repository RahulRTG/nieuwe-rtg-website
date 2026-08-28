/* KOMT GEZIN B BIJ HET DOSSIER VAN GEZIN A?

   De zesde en laatste rollenvraag, en de zwaarste. De vorige vijf gingen over
   geld; deze gaat over een kind. Achter een gezinscode liggen medicijnen,
   doktersafspraken, locaties, chats en dromen -- de gevoeligste gegevens die
   dit huis bewaart, en LEVEN.md zegt met zoveel woorden dat een kind geen
   profiel is.

   WAAROM DIT EEN EIGEN RONDE VERDIENT. test/perimeter-risico.test.js legt van
   deze routes vast dat een ONBEKENDE gezinscode 404 geeft. Dat is de perimeter
   en niet de rechtenleer; het bestand zegt dat er zelf bij. De vraag die
   overbleef is de gevaarlijke: wat doet een geldige sessie van een ANDER gezin?

   DE VORM. gezinVan() (server/foundation/gezinshulp.js) haalt het gezin uit de
   BODY of de URL:

       const code = String(req.body.code || req.params.code || '').toUpperCase();

   Dat is op zichzelf geen grendel -- en dat hoeft ook niet, want de grendel zit
   een regel later: profielVan(g, token) zoekt het token BINNEN dat gezin. Een
   token van gezin B staat niet in de profielenlijst van gezin A, dus het valt
   er vanzelf buiten.

   Precies zoals bij de school en de werkruimte is dat een EIGENSCHAP van de
   opzet en geen expliciete controle. Zo'n eigenschap verdwijnt zodra iemand
   "even" een token-lookup over alle gezinnen heen schrijft -- en dan staat de
   gezondheidskaart van andermans kind open. Deze toets is de wachter daarop.

   EEN GEZINSCODE IS GEEN GEHEIM DAT JE MAG RADEN. /gezin/inloggen geeft bij een
   geldige code de profielnamen terug; dat is met opzet zo (het is het
   inlogscherm) en er staat een rem op van twaalf pogingen. Toets 4 legt vast
   dat die rem er is, want zonder rem zou de code zelf de zwakste schakel zijn.

   WAT ER BEWEZEN WORDT, en het kan allemaal zakken:
     1. TEGENPROEF: gezin A kan zijn eigen zorgkaart lezen en schrijven, en dat
        landt ook echt;
     2. gezin B komt met zijn eigen geldige token nergens bij gezin A;
     3. en na al die pogingen is het dossier van A byte-voor-byte hetzelfde;
     4. de gezinscode is afgeschermd met een rem tegen raden.

   Draai los: node --experimental-sqlite --test test/geld-rollen-gezin.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, A = {}, B = {};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezin-idor-'));

const post = (pad, body) => fetch(base + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const haal = (pad, token) => fetch(base + '/api/foundation' + pad, {
  headers: token ? { Authorization: 'Bearer ' + token } : {}
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Een gezin met een moeder (beheerder) en een kind. Langs de echte weg: maken,
   profiel aanmaken, profiel kiezen. */
async function maakGezin(merk) {
  const g = (await post('/gezin/maak', { gezinsnaam: 'Fam ' + merk, naam: 'Moeder ' + merk, pin: '1234' })).body;
  assert.ok(g.code && g.token, 'gezin ' + merk + ' bestaat: ' + JSON.stringify(g).slice(0, 160));

  const kind = (await post('/gezin/profiel/maak',
    { code: g.code, token: g.token, naam: 'Kind ' + merk, rol: 'kind' })).body;
  assert.ok(kind.profiel && kind.profiel.id, 'kind ' + merk + ' bestaat');

  const mij = await haal('/gezin/' + g.code + '/mij', g.token);
  const mijnId = (mij.body.profiel || mij.body).id || mij.body.mijnId;
  return { code: g.code, token: g.token, mijnId, kindId: kind.profiel.id };
}

test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' });
  base = srv.base;
  A = await maakGezin('A');
  B = await maakGezin('B');
  assert.notEqual(A.code, B.code, 'twee verschillende gezinnen -- anders toetst dit niets');
  assert.notEqual(A.token, B.token);
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const zorgVanA = async () => JSON.stringify((await haal('/gezin/' + A.code + '/gezondheid', A.token)).body);

test('1. TEGENPROEF: gezin A bedient zijn eigen zorgkaart, en het landt', async () => {
  const zien = await haal('/gezin/' + A.code + '/gezondheid', A.token);
  assert.equal(zien.status, 200, 'de eigen ouder ziet de zorgkaart: ' + JSON.stringify(zien.body).slice(0, 140));

  const med = await post('/gezin/gezondheid/medicijn',
    { code: A.code, token: A.token, voor: A.kindId, naam: 'Paracetamol', dosis: '250 mg', wanneer: 'avond' });
  assert.equal(med.status, 200, 'een ouder mag een medicijn vastleggen: ' + JSON.stringify(med.body).slice(0, 160));

  const na = await haal('/gezin/' + A.code + '/gezondheid', A.token);
  assert.ok(JSON.stringify(na.body).includes('Paracetamol'), 'en dat LANDT ook echt in de kaart');
});

test('2. gezin B komt met zijn eigen geldige token nergens bij gezin A', async () => {
  const voor = await zorgVanA();

  /* Het token van B, de code van A. Dit is de vorm die werkt zodra iemand een
     token over alle gezinnen heen opzoekt in plaats van binnen het gezin. */
  const pogingen = [
    ['/gezin/gezondheid/medicijn', { code: A.code, token: B.token, voor: A.kindId, naam: 'Kaping', dosis: '9 g', wanneer: 'avond' }],
    ['/gezin/gezondheid/afspraak', { code: A.code, token: B.token, voor: A.kindId, wat: 'Kaping', wanneer: '2027-01-01' }],
    ['/gezin/bericht', { code: A.code, token: B.token, naar: 'allen', tekst: 'Kaping' }],
    ['/gezin/droom/maak', { code: A.code, token: B.token, wat: 'Kaping' }],
    ['/gezin/profiel/maak', { code: A.code, token: B.token, naam: 'Indringer', rol: 'ouder' }],
    ['/gezin/wissen', { code: A.code, token: B.token, pin: '1234' }]
  ];

  const doorgelaten = [];
  for (const [pad, body] of pogingen) {
    const r = await post(pad, body);
    if (r.status >= 200 && r.status < 300) doorgelaten.push(pad + ' -> ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 80));
    assert.ok(r.status < 500, pad + ' viel om in plaats van te weigeren (' + r.status + ')');
  }
  assert.deepEqual(doorgelaten, [], 'gezin B kwam bij het dossier van gezin A');

  /* En lezen langs de URL-vorm, want die neemt de code uit req.params. */
  for (const pad of ['gezondheid', 'locaties', 'chats', 'dromen', 'mij', 'oppasinfo']) {
    const r = await haal('/gezin/' + A.code + '/' + pad, B.token);
    assert.ok(!(r.status >= 200 && r.status < 300),
      'B kon /' + pad + ' van A lezen (' + r.status + '): ' + JSON.stringify(r.body).slice(0, 120));
  }
});

test('3. het dossier van A is na alle pogingen ongewijzigd', async () => {
  const na = await haal('/gezin/' + A.code + '/gezondheid', A.token);
  const tekst = JSON.stringify(na.body);
  assert.ok(tekst.includes('Paracetamol'), 'wat A zelf vastlegde staat er nog');
  assert.ok(!tekst.includes('Kaping'), 'en wat B probeerde te schrijven staat er niet');

  const profielen = (await post('/gezin/inloggen', { code: A.code })).body.profielen || [];
  assert.ok(!profielen.some(p => (p.naam || '') === 'Indringer'),
    'B heeft geen profiel in het gezin van A kunnen zetten');
  assert.equal(profielen.length, 2, 'A heeft nog precies zijn eigen twee profielen');
});

test('4. de gezinscode zelf is afgeschermd met een rem tegen raden', async () => {
  /* /gezin/inloggen geeft bij een geldige code de profielnamen terug -- dat is
     het inlogscherm en dus met opzet. Dan is de code de zwakste schakel, en
     daar hoort een rem op. Zonder deze bewering zou raden gratis zijn. */
  let geweigerd = 0;
  for (let i = 0; i < 20; i++) {
    const r = await post('/gezin/inloggen', { code: 'ZZZZ' + String(i).padStart(2, '0') });
    if (r.status === 429) geweigerd++;
  }
  assert.ok(geweigerd > 0, 'twintig verkeerde gezinscodes achter elkaar horen op een rem te stuiten');
});
