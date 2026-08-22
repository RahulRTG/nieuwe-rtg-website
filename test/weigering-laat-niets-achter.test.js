/* EEN WEIGERING LAAT NIETS ACHTER. PROOF.md paragraaf 9: degraderen gaat naar
   de veiligste toestand, en de veiligste toestand van een geweigerd verzoek is
   dat het nooit heeft plaatsgevonden. De staatproef ving drie routes waar dat
   niet gold, allemaal met dezelfde oorzaak: een bak-functie die SCHEPT bij het
   kijken (H(), P(), bak()), zodat de weigering daarna een lege doos achterliet.

   Dit bestand meet dat zoals de staatproef het meet: met de vingerafdruk van
   de echte server om de geweigerde aanroep heen. Niet met een blik in de
   database-bestanden -- de vingerafdruk IS het instrument voor deze vraag, en
   een tweede meetmanier zou ervan gaan afwijken (LAT.md regel 4). De altijd
   bewegende collecties (doorgeefjournaal, rtgai) zitten in de ruisvloer; de
   toets kijkt daarom alleen naar de collectie waar de route over gaat.

   Draai los: node --experimental-sqlite --test test/weigering-laat-niets-achter.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, supplierToken, eigenaarToken;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-weiger-'));

async function post(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  let data = null; try { data = await r.json(); } catch (e) {}
  return { status: r.status, data };
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, RTG_DEMO: '1', SMTP_URL: '' } }));
  supplierToken = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token;
  eigenaarToken = (await post('/api/auth/login', {
    login: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com',
    password: process.env.DEMO_PASS || 'Imran' })).data.token;
  assert.ok(supplierToken, 'zonder leverancierstoken valt hier niets te weigeren');
  assert.ok(eigenaarToken, 'zonder eigenaar geen vingerafdruk, en zonder vingerafdruk meet dit bestand niets');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const vinger = async () => {
  const r = await post('/api/techniek/vingerafdruk', {}, eigenaarToken);
  assert.equal(r.status, 200, 'de vingerafdruk hoort te bestaan; zonder hem is deze toets blind');
  return r.data;
};

/* De kern van dit bestand: doe een aanroep die MOET weigeren, en stel vast dat
   de genoemde collectie niet is aangeraakt. De status wordt ook gecontroleerd:
   een toets die "laat niets achter" viert terwijl de aanroep stiekem slaagde,
   bewijst het omgekeerde van wat hij zegt. */
async function geweigerdZonderSpoor(naam, pad, lijf, wilStatus, collectie) {
  const voor = await vinger();
  const r = await post(pad, lijf, supplierToken);
  assert.equal(r.status, wilStatus, naam + ' hoort te weigeren met ' + wilStatus +
    ', kreeg ' + r.status + ': ' + JSON.stringify(r.data).slice(0, 120));
  const na = await vinger();
  const d = await post('/api/techniek/vingerafdruk/verschil', { voor, na }, eigenaarToken);
  assert.equal(d.status, 200);
  const geraakt = (d.data.gewijzigd || []).map(g => g.collectie);
  assert.ok(!geraakt.includes(collectie),
    naam + ': geweigerd (' + r.status + ') en toch bewoog ' + collectie +
    ' -- een weigering hoort niets achter te laten. Bewogen: ' + geraakt.join(', '));
}

test('een geweigerde fooienpot laat geen horeca-doos achter', async () => {
  // leeg lijf: geen deelnemers -> 400, en de zaak heeft nog geen horeca-doos
  await geweigerdZonderSpoor('fooienpot', '/api/supplier/horeca/fooienpot', {}, 400, 'horeca');
});

test('een geweigerde gast-mutatie (punten onder nul) raakt niets aan', async () => {
  await geweigerdZonderSpoor('gast', '/api/supplier/horeca/gast',
    { naam: 'Proefgast', punten: -5 }, 400, 'horeca');
});

test('delen van een onbestaande checklijst laat geen collectie ontstaan', async () => {
  await geweigerdZonderSpoor('checklijst/deel', '/api/werkvloer/checklijst/deel',
    { id: 'CHK-BESTAATNIET' }, 404, 'checklijsten');
});

test('loonkosten zonder diensten laat geen personeelsdoos achter', async () => {
  await geweigerdZonderSpoor('loonkosten', '/api/supplier/horeca/loonkosten', {}, 404, 'horeca');
});
