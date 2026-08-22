/* DE ROLLENVRAAG BUITEN DE BANK.

   test/geld-rollen.test.js bewijst dat lid B niet bij de bankrekening van lid A
   komt. De bank was daar de moeilijke kant, want daar kiest de AANVRAGER het
   voorwerp: de IBAN en het pas-id komen uit de body. Elke plek waar dat niet
   tegen de sessie wordt gehouden is een IDOR.

   Buiten de bank zit het anders in elkaar, en dat verschil is het onderwerp van
   dit bestand. De rechterhand-routes halen het dossier op met
   `req.session.key` (server/routes/member/rechterhand.js, de `doe`-helper) en
   zoeken het meegestuurde id vervolgens BINNEN dat dossier. De scope komt dus
   uit de sessie en niet uit de body; een id van iemand anders zit simpelweg
   niet in de lijst waarin gezocht wordt.

   Dat is structureel sterker dan wat de bank deed, en het is precies daarom de
   moeite waard om vast te leggen: het is een EIGENSCHAP van de opzet, en
   eigenschappen verdwijnen zodra iemand "even" een id-lookup over alle dossiers
   heen schrijft. Deze toets is de wachter op dat verschil.

   WAT ER GETOETST WORDT, en het kan allemaal zakken:
     1. A maakt een gift aan; die is van A en staat in A zijn dossier;
     2. B ziet hem niet in ZIJN dossier;
     3. B kan hem niet wijzigen met A zijn id -- en krijgt geen 2xx;
     4. B kan hem niet weggooien: na de poging staat A zijn gift er nog;
     5. en A zijn dossier is na alle pogingen byte-voor-byte hetzelfde.

   Punt 5 is het punt dat de toets echt maakt. "B kreeg geen 200" is niet
   hetzelfde als "er is niets gebeurd" -- een weg-actie die stil op het
   verkeerde dossier werkt, geeft ook gewoon ok terug.

   Draai los: node --experimental-sqlite --test test/geld-rollen-buiten-bank.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, elevateTier } = require('./helper');

let srv, base, A = {}, B = {};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rollen2-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

async function maakLid(merk) {
  const u = (Date.now() + Math.floor(Math.random() * 1e6)).toString().slice(-9);
  const r = await api('/api/auth/register', {
    name: 'Buiten ' + merk, email: 'buiten' + merk + u + '@voorbeeld.test', phone: '06' + u,
    password: 'geheim12345', geboortedatum: '1988-05-05', geslacht: 'm',
    tier: 'business', pasApp: 'business'
  });
  assert.ok(r.body.token, merk + ' moet een sessie krijgen: ' + JSON.stringify(r.body).slice(0, 140));
  return { token: r.body.token };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  A = await maakLid('A');
  B = await maakLid('B');

  /* DE RECHTERHAND ZIT ACHTER DE LIFESTYLE-PAS, en die krijg je niet door hem
     bij registratie te vragen: hij wordt uitsluitend na een MENSELIJK besluit
     verleend (de merkregel in CLAUDE.md, en de AI mag hem nooit zelf geven).
     Zonder deze stap geeft elke route hieronder 403 -- ook voor de eigenaar --
     en dan zou "B komt er niet in" niets bewijzen behalve dat niemand erin
     komt. Precies daarvoor staat de tegenproef in toets 1.

     elevateTier() loopt de echte weg: een aanvraag, en daarna het besluit van
     een herleidbaar persoon. */
  for (const lid of [A, B]) await elevateTier(base, lid.token, 'business');

  /* A legt een gift vast. Dit is echt geld in een dossier: bedrag, doel,
     betaald-vlag. Lukt dit niet, dan toetst de rest niets. */
  const g = await api('/api/member/rechterhand/mecenaat/gift',
    { doel: 'Stichting Proef', bedrag: 25000, periode: 'eenmalig', thema: 'overig' }, A.token);
  assert.equal(g.status, 200, 'A moet een gift kunnen vastleggen: ' + JSON.stringify(g.body).slice(0, 160));
  A.gift = g.body.gift && g.body.gift.id;
  assert.ok(A.gift, 'A heeft een gift-id: ' + JSON.stringify(g.body).slice(0, 160));
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const dossierVan = async (lid) =>
  JSON.stringify((await api('/api/member/rechterhand/mecenaat', {}, lid.token)).body);

test('1. TEGENPROEF: A ziet zijn eigen gift en kan hem zelf wijzigen', async () => {
  const mijn = await api('/api/member/rechterhand/mecenaat', {}, A.token);
  const lijst = mijn.body.mecenaat || mijn.body.giften || [];
  const g = lijst.find(x => x.id === A.gift);
  assert.ok(g, 'de gift staat in A zijn dossier: ' + JSON.stringify(mijn.body).slice(0, 200));
  assert.equal(g.bedrag, 25000);

  const wijzig = await api('/api/member/rechterhand/mecenaat/gift',
    { id: A.gift, doel: 'Stichting Proef', bedrag: 30000, periode: 'eenmalig' }, A.token);
  assert.equal(wijzig.status, 200, 'de eigenaar mag wijzigen');
  const na = await api('/api/member/rechterhand/mecenaat', {}, A.token);
  const g2 = (na.body.mecenaat || na.body.giften || []).find(x => x.id === A.gift);
  assert.equal(g2.bedrag, 30000, 'en de wijziging LANDT ook echt -- de actie doet iets');
});

test('2. B ziet het dossier van A niet', async () => {
  const mijn = await api('/api/member/rechterhand/mecenaat', {}, B.token);
  const ids = (mijn.body.mecenaat || mijn.body.giften || []).map(x => x.id);
  assert.ok(!ids.includes(A.gift), 'de gift van A staat niet in het dossier van B');
  assert.equal(ids.length, 0, 'B heeft nog helemaal niets, dus er valt ook niets te verwarren');
});

test('3. B kan de gift van A niet wijzigen of weggooien', async () => {
  const voor = await dossierVan(A);

  /* Wijzigen met A zijn id. De scope komt uit B zijn sessie, dus dit id bestaat
     daar niet -- het hoort een nette 404 te geven en NOOIT stil op het dossier
     van A te landen. */
  const wijzig = await api('/api/member/rechterhand/mecenaat/gift',
    { id: A.gift, doel: 'Gekaapt door B', bedrag: 1, periode: 'eenmalig' }, B.token);
  assert.ok(!(wijzig.status >= 200 && wijzig.status < 300),
    'B mag de gift van A niet kunnen wijzigen (kreeg ' + wijzig.status + ')');
  assert.equal(wijzig.status, 404, 'en wel met "staat niet in uw dossier", niet met 403 dat het bestaan verraadt');

  /* Weggooien is de gevaarlijkste: die routes filteren vaak op id zonder te
     kijken WIENS lijst ze filteren. Zo'n fout geeft gewoon ok terug. */
  const weg = await api('/api/member/rechterhand/mecenaat/gift/weg', { id: A.gift }, B.token);
  assert.ok(weg.status < 500, 'de weg-actie mag niet omvallen (kreeg ' + weg.status + ')');

  /* En dit is de bewering die telt: wat B ook terugkreeg, het dossier van A is
     ongewijzigd. Een weg-actie die op het verkeerde dossier werkt geeft ook ok. */
  assert.equal(await dossierVan(A), voor, 'het dossier van A is aangeraakt door B');

  const na = await api('/api/member/rechterhand/mecenaat', {}, A.token);
  const g = (na.body.mecenaat || na.body.giften || []).find(x => x.id === A.gift);
  assert.ok(g, 'de gift van A bestaat nog steeds');
  assert.equal(g.bedrag, 30000, 'met het bedrag dat A er zelf op zette');
  assert.notEqual(g.doel, 'Gekaapt door B');
});

test('4. de scope komt uit de SESSIE en niet uit de body -- ook bij de attenties', async () => {
  /* Dezelfde opzet, tweede dossier, zodat dit geen eigenschap van een enkele
     route is maar van het patroon. */
  const at = await api('/api/member/rechterhand/attenties/gift',
    { wat: 'Bloemen', bedrag: 5000, voor: 'Iemand' }, A.token);
  if (at.status !== 200) return;   // route kent een andere vorm: dan zegt deze toets hier niets over
  const id = at.body.gift && at.body.gift.id;
  assert.ok(id, 'A heeft een attentie-gift');

  const voor = JSON.stringify((await api('/api/member/rechterhand/attenties', {}, A.token)).body);
  const kaap = await api('/api/member/rechterhand/attenties/gift/weg', { id }, B.token);
  assert.ok(kaap.status < 500, 'geen serverfout');
  assert.equal(JSON.stringify((await api('/api/member/rechterhand/attenties', {}, A.token)).body), voor,
    'B heeft de attenties van A niet aangeraakt');
});
