/* DE ISOLATIECOCKPIT VAN HET KANTOOR, over de echte HTTP-weg.

   WAAROM DEZE TOETS ER IS. De routedekking vond zes routes van deze cockpit die
   door geen enkele toets werden aangeraakt: het overzicht, het verstrengen, de
   proef, en drie van de vijf ceremoniestappen. De twee die er wel in stonden
   (ontsluiting en stap) komen langs test/incidentcontrole-route.test.js, en dat
   is de HUIS-kant. De DRAGER-kant -- een identiteit of een sessie dichtzetten en
   weer los krijgen -- liep tot nu toe alleen door de kern en nooit door de deur.

   Dat verschil is niet academisch. De deur doet drie dingen die de kern niet
   doet: hij bepaalt wie de actor is, hij stelt vast of er een tweede mens
   BESTAAT (geteld, niet meegestuurd), en hij vertaalt een fout uit de kern naar
   een statuscode. Alle drie zijn ze hier al eens verkeerd gegaan.

   WAT ER BEWEZEN WORDT, en telkens met een bewering die kan zakken:
     1. het overzicht noemt de dragers en de huisstand
     2. verstrengen lukt en staat daarna in het overzicht
     3. VERLAGEN LUKT NIET langs deze route -- de weigering komt uit de kern
     4. de proef verandert niets (dat is het hele punt van een wat-als)
     5. commit zonder de stappen weigert
     6. afbreken maakt het verzoek definitief onbruikbaar

   Punt 3 en 6 zijn de twee die er echt toe doen: dat is SEC-LOCK-001 (geen
   stille verlaging) op de weg waar een mens hem zou proberen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const OWNER = 'isotech-owner@x.nl';
const SLEUTEL = 'lid-isotech-1';
let srv, token;

function roep(pad, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const opties = body === undefined
    ? { headers }
    : { method: 'POST', headers, body: JSON.stringify(body) };
  return fetch(srv.base + pad, opties)
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_OWNER_EMAIL: OWNER } });
  const inlog = await roep('/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' });
  token = inlog.body.token;
  assert.ok(token, 'de opstelling moet als eigenaar binnenkomen, anders meet deze toets niets');
});
test.after(() => stop(srv && srv.child));

test('1. het overzicht noemt de dragers en de stand van het huis', async () => {
  const r = await roep('/api/techniek/isolatie');
  assert.equal(r.status, 200);
  assert.ok(r.body.perDrager, 'het overzicht draagt de telling per drager');
  for (const d of ['organisatie', 'identiteit', 'sessie', 'apparaat'])
    assert.ok(r.body.perDrager[d], d + ' hoort in het overzicht te staan, ook met nul standen');
  assert.equal(typeof r.body.huis, 'string', 'de huisstand komt uit de incidentcontrole en is altijd een stand');
});

test('2. verstrengen lukt, en de stand staat daarna in het overzicht', async () => {
  const zet = await roep('/api/techniek/isolatie/zet',
    { drager: 'identiteit', sleutel: SLEUTEL, naar: 'beperkt', reden: 'toets: verdachte inlog' });
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  assert.equal(zet.body.uit.stand, 'beperkt');

  const na = await roep('/api/techniek/isolatie');
  assert.equal(na.body.perDrager.identiteit.perStand.beperkt, 1,
    'wat gezet is, hoort meteen in het overzicht te staan -- anders leest het kantoor een oude stand');
});

test('3. VERLAGEN kan niet langs deze route (SEC-LOCK-001)', async () => {
  const omlaag = await roep('/api/techniek/isolatie/zet',
    { drager: 'identiteit', sleutel: SLEUTEL, naar: 'normaal', reden: 'toets: mag niet' });
  assert.notEqual(omlaag.status, 200,
    'een stand verlagen zonder ceremonie is precies wat deze laag onmogelijk hoort te maken');
  assert.equal(omlaag.status, 409, 'en de weigering komt uit de kern, niet uit een if in de route');

  const na = await roep('/api/techniek/isolatie');
  assert.equal(na.body.perDrager.identiteit.perStand.beperkt, 1, 'de stand staat er nog');
});

test('4. de proef voert niets uit en verandert niets', async () => {
  const voor = await roep('/api/techniek/isolatie');
  const p = await roep('/api/techniek/isolatie/proef',
    { identiteit: SLEUTEL, paden: ['/api/salon/plaats', '/api/pay/stuur'], wereld: 'member' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.besluiten.length, 2, 'elk gevraagd pad krijgt een besluit');
  for (const b of p.body.besluiten)
    assert.ok(b.uitleg, 'een besluit zonder uitleg is een orakel: ' + b.pad);

  const na = await roep('/api/techniek/isolatie');
  assert.deepEqual(na.body.perDrager, voor.body.perDrager,
    'een wat-als die de werkelijkheid verandert, is geen wat-als');
});

test('5. zonder passkey gaat de ceremonie door -- maar GEMERKT', async () => {
  /* DIT ZAKTE EERST, EN DE TOETS HAD ONGELIJK. Ik verwachtte een weigering: een
     ceremonie die je meteen kunt committen, leest als een ceremonie die niets
     doet. De code heeft hier gelijk en de reden staat uitgeschreven in
     kern/isolatie/ceremonie-eisen.js: aan dit account hangt geen passkey, en een
     eis die niemand kan halen maakt het platform onherstelbaar en wordt in de
     praktijk omzeild (iemand maakt een tweede account om zichzelf goed te
     keuren, en dan is de eis een formaliteit MET een losse sleutel erbij).

     De waarde zit dus niet in het tegenhouden maar in het niet kunnen
     verbergen. Precies dat wordt hier nagekeken, en met NAAM: `noodontsluiting`
     alleen zegt niet waarom, en zonder passkey is iets heel anders dan zonder
     tweede mens. Valt de grond weg, dan zakt deze toets -- en dat hoort. */
  const v = await roep('/api/techniek/isolatie/ontsluiting',
    { drager: 'identiteit', sleutel: SLEUTEL, naar: 'normaal', reden: 'toets: vals alarm gebleken' });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  const verzoek = v.body.verzoek;

  assert.equal(verzoek.noodontsluiting, true, 'de nooduitgang staat open en zegt dat ook');
  assert.deepEqual(verzoek.noodGronden.map(g => g.grond), ['geenPasskey'],
    'en noemt de grond bij naam, niet als kale boolean');
  assert.ok(/onherstelbaar/.test(verzoek.noodWaarom || ''), 'met de afweging erbij');
  assert.ok(/de stand blijft beperkt/.test(verzoek.effectNu || ''),
    'het verzoek zelf verlaagt nog niets: ' + verzoek.effectNu);

  const commit = await roep('/api/techniek/isolatie/ontsluiting/commit', { id: verzoek.id });
  assert.equal(commit.status, 200, JSON.stringify(commit.body));

  const na = await roep('/api/techniek/isolatie');
  assert.ok(!na.body.perDrager.identiteit.perStand.beperkt,
    'na een geslaagde ceremonie is de stand weg');
});

test('6. een afgebroken verzoek is definitief onbruikbaar', async () => {
  await roep('/api/techniek/isolatie/zet',
    { drager: 'identiteit', sleutel: SLEUTEL, naar: 'beperkt', reden: 'toets: opnieuw dicht' });
  const v = await roep('/api/techniek/isolatie/ontsluiting',
    { drager: 'identiteit', sleutel: SLEUTEL, naar: 'normaal', reden: 'toets: afbreken halverwege' });
  const id = v.body.verzoek.id;

  const af = await roep('/api/techniek/isolatie/ontsluiting/afbreken', { id, reden: 'toets: niet nodig' });
  assert.equal(af.status, 200, JSON.stringify(af.body));

  /* HET GEVAARLIJKE GEVAL. Een afgebroken verzoek dat nog te committen is, is
     een tweede weg naar beneden -- en die zou niemand zien, want het verzoek
     staat als afgebroken in het spoor. */
  const commit = await roep('/api/techniek/isolatie/ontsluiting/commit', { id });
  assert.equal(commit.status, 409, 'een afgebroken verzoek is niet alsnog te committen');

  const na = await roep('/api/techniek/isolatie');
  assert.equal(na.body.perDrager.identiteit.perStand.beperkt, 1, 'de stand staat er nog');
});

test('7. de bevestigingsopties zeggen WAAROM ze er niet zijn', async () => {
  const v = await roep('/api/techniek/isolatie/ontsluiting',
    { drager: 'identiteit', sleutel: SLEUTEL, naar: 'normaal', reden: 'toets: opties opvragen' });
  const id = v.body.verzoek.id;

  /* Een lege optielijst leest als "er valt niets te bevestigen". Zonder passkey
     hoort dat een UITGESPROKEN vaststelling te zijn en geen stille leegte. */
  const o = await roep('/api/techniek/isolatie/ontsluiting/stap/opties', { id, soort: 'passkey' });
  assert.notEqual(o.status, 200, 'zonder passkey zijn er geen opties');
  assert.ok(o.body.error, 'en de weigering draagt een reden: ' + JSON.stringify(o.body));

  await roep('/api/techniek/isolatie/ontsluiting/afbreken', { id, reden: 'toets opgeruimd' });
});
