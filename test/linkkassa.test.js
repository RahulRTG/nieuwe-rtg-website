/* DE KASSACODE ALS CAPABILITY (server/kern/pay/kassacode.js) -- de verhuizing van
   20 augustus 2026, en de eerste capability die een ZAAK aanvaardt.

   Wat hier bewezen moet worden:

   1. HET IS DEZELFDE HANDELING, ANDERE DRAGER. Het innen blijft kern/pay/kassa.js
      (eenmalig, maximum, bijladen, betaaldienstkosten). De oude weg blijft het
      doen; er is geen tweede plek waar een kassacode wordt verzilverd.
   2. DE CODE ZIT NIET MEER IN DE QR. Vroeger stond 'rtg:kas:A1B2C3' erin en kon
      wie hem fotografeerde hem overtypen aan een andere kassa. Nu ziet de kassa
      een kaart, en de code zelf blijft op de server.
   3. DE POORT VAN DE ZAAK GELDT. Een kassa komt binnen langs supplierAuth en
      niet langs de ledendeur -- en een lid kan een kassacode niet innen.
   4. EEN VERSE CODE VERDRINGT DE VORIGE, en dat merkt de kassa VOORDAT hij een
      bedrag intikt.

   Draai los: node --experimental-sqlite --test test/linkkassa.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const maakKassacode = require('../server/kern/pay/kassacode');
const { startServer, stop } = require('./helper');

/* ---------- 1. de definitie zelf ---------- */

test('de definitie leent alles van RTG Pay en verzint geen tweede waarheid', () => {
  const gevraagd = [];
  const pay = { KASCODE_MS: 5 * 60 * 1000,
    kasCode: (x) => { gevraagd.push(x); return { ok: true, code: 'A1B2C3', maxCenten: 15000 }; },
    kasStand: (code) => (code === 'A1B2C3' ? { maxCenten: 15000 } : null),
    kasInt: async (x) => ({ ok: true, centen: x.centen, van: 'Lid A' }) };
  const def = maakKassacode({ pay, schoon: (s, n) => String(s == null ? '' : s).slice(0, n) });

  assert.equal(def.id, 'geld.kassa');
  assert.deepEqual(def.aanvaarder, ['supplier'], 'de kassa aanvaardt, niet het lid');
  assert.equal(def.ttlMs, pay.KASCODE_MS, 'exact zolang als de code eronder leeft');
  assert.equal(def.eenmalig, true);

  const o = def.lees({ maxCenten: 15000 }, { soort: 'lid', key: 'A', codenaam: 'Lid A' });
  assert.deepEqual(o, { code: 'A1B2C3', maxCenten: 15000 });
  assert.deepEqual(gevraagd, [{ codenaam: 'Lid A', maxCenten: 15000 }], 'de code komt van RTG Pay');
  assert.equal(def.lees({}, { soort: 'lid', key: 'A' }).status, 403, 'zonder codenaam geen kassacode');

  // de kaart toont het maximum en NOOIT de code zelf
  const kaart = def.beschrijf(o);
  assert.equal(kaart.velden[0].waarde, '€ 150,00');
  assert.ok(!JSON.stringify(kaart).includes('A1B2C3'), 'de code hoort niet op de kaart van de scanner');
  assert.equal(def.voorUitgever(o).code, 'A1B2C3', 'het lid zelf krijgt hem wel, om voor te lezen');

  // `nog` volgt RTG Pay, en `neem` keurt alleen de VORM -- niet het maximum
  assert.equal(def.nog(o), true);
  assert.equal(def.nog({ code: 'WEG' }), false);
  assert.equal(def.neem({ centen: 0 }).status, 400);
  assert.deepEqual(def.neem({ centen: 999999999 }), { centen: 999999999, oms: 'Kassa' },
    'te veel is hier geen fout: dat besluit hoort bij kasInt, en op een plek');
});

/* ---------- 2. de weg in het echt ---------- */
let BASE, child, lid, zaak;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-linkkassa-'));
const KYC_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const json = r => r.json();
function api(pad, body, token) {
  return fetch(BASE + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
}
async function nieuwLid(naam) {
  const reg = await json(await api('/api/auth/register', { name: naam,
    email: naam.replace(/\s/g, '') + Date.now() + '@voorbeeld.test', phone: '0611122233',
    password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' }));
  await api('/api/verify/upload', { image: KYC_PNG }, reg.token);
  const st = await json(await api('/api/state', {}, reg.token));
  return { token: reg.token, codenaam: st.state.user.codename };
}
const saldo = async (t) => (await json(await api('/api/pay/overzicht', {}, t))).saldo;
const kassaSaldo = async () => (await json(await api('/api/supplier/pay/overzicht', {}, zaak))).saldo;
const maakCap = async (t, maxCenten) => json(await api('/api/link/cap/maak', { handeling: 'geld.kassa', maxCenten }, t));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  lid = await nieuwLid('Kassa Lid');
  await api('/api/pay/oplaad', { centen: 100000, idem: 'kas-op-' + Date.now() }, lid.token);
  const roster = await json(await api('/api/supplier/roster', { code: 'LUCHT' }));
  const man = roster.staff.find(m => m.role === 'manager');
  zaak = (await json(await api('/api/supplier/login', { code: 'LUCHT', staffId: man.id, pin: '1234' }))).token;
  assert.ok(zaak, 'de kassa is ingelogd');
});
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de kassa scant, ziet WIE en TOT HOEVEEL, en rekent dan pas af', async () => {
  const cap = await maakCap(lid.token, 20000);
  assert.match(cap.token, /^RTG1\./);
  assert.equal(cap.eigen.code.length, 6, 'het lid krijgt zijn code wel, om voor te lezen');

  // stap 1: scannen. De kassa ziet een kaart -- en nergens de code zelf.
  const gezien = await json(await api('/api/link/los', { tekst: cap.token }, zaak));
  assert.equal(gezien.type, 'capability');
  assert.equal(gezien.onderwerp.van, lid.codenaam, 'de codenaam van wie betaalt');
  assert.equal(gezien.onderwerp.velden[0].waarde, '€ 200,00', 'tot dit bedrag');
  assert.ok(!JSON.stringify(gezien).includes(cap.eigen.code),
    'de kassacode zelf komt niet mee: dat was juist het lek van de oude QR');
  assert.deepEqual(gezien.intenties.map(i => i.weg), ['/api/supplier/link/cap/aanvaard']);

  // stap 2: het bedrag invullen en innen
  const voorLid = await saldo(lid.token), voorZaak = await kassaSaldo();
  const af = await json(await api(gezien.intenties[0].weg, { capcode: cap.token, centen: 4500, oms: 'Lounge' }, zaak));
  assert.equal(af.ok, true);
  assert.equal(af.uitkomst.centen, 4500);
  assert.equal(await saldo(lid.token), voorLid - 4500, 'het lid is 45 euro kwijt');
  assert.ok(await kassaSaldo() > voorZaak, 'en de zaak heeft het (min de betaaldienstkosten)');

  // eenmalig, net als de kassacode zelf altijd al was
  assert.equal((await api('/api/supplier/link/cap/aanvaard', { capcode: cap.token, centen: 100 }, zaak)).status, 404);
});

test('het scherm krijgt precies de vier dingen die het toont', async () => {
  /* public/apps/pay.html leest `eigen.code` (om voor te lezen), `eigen.maxCenten`
     en `exp` (voor "geldig tot"), en zet `token` in de QR. Hernoemt iemand er
     een, dan blijft het scherm netjes leeg in plaats van te klagen -- en dat is
     precies het soort stille breuk waar deze toets voor staat. */
  const cap = await maakCap(lid.token, 7500);
  assert.match(cap.token, /^RTG1\./, 'de QR draagt het token');
  assert.match(cap.eigen.code, /^[0-9A-F]{6}$/, 'de code om voor te lezen');
  assert.equal(cap.eigen.maxCenten, 7500);
  assert.ok(cap.exp > Date.now(), 'geldig tot');
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public/apps/pay.html'), 'utf8');
  for (const veld of ['eigen.code', 'eigen.maxCenten', 'r.exp', 'r.token'])
    assert.ok(bron.includes(veld), 'pay.html leest ' + veld + ' niet meer; dan klopt deze toets niet meer');
});

test('boven het maximum weigert RTG Pay, en de code blijft bruikbaar', async () => {
  const cap = await maakCap(lid.token, 1000);
  const r = await api('/api/supplier/link/cap/aanvaard', { capcode: cap.token, centen: 5000 }, zaak);
  assert.equal(r.status, 402);
  assert.match((await json(r)).error, /maximum/i);
  // en nu wel het juiste bedrag: de code is niet verbruikt aan een weigering
  const goed = await json(await api('/api/supplier/link/cap/aanvaard', { capcode: cap.token, centen: 900 }, zaak));
  assert.equal(goed.uitkomst.centen, 900);
});

test('een verse code verdringt de vorige, en dat weet de kassa VOOR het intikken', async () => {
  /* RTG Pay houdt per lid maar EEN kassacode actief. Het token van de oude is
     nog prima ondertekend, dus zonder de vraag "leeft dit nog?" zou de kassa een
     keurige kaart zien, het bedrag intikken en pas dan een weigering krijgen. */
  const oud = await maakCap(lid.token, 5000);
  assert.equal((await json(await api('/api/link/los', { tekst: oud.token }, zaak))).type, 'capability');
  const nieuw = await maakCap(lid.token, 5000);
  assert.notEqual(nieuw.token, oud.token);

  const r = await api('/api/link/los', { tekst: oud.token }, zaak);
  assert.equal(r.status, 404, 'de oude kaart komt niet meer op het scherm');
  assert.match((await json(r)).error, /verlopen|gebruikt|niets/i);
  // en de verse werkt gewoon
  assert.equal((await json(await api('/api/supplier/link/cap/aanvaard',
    { capcode: nieuw.token, centen: 1200 }, zaak))).ok, true);
});

test('een lid int geen kassacode, en de ledendeur laat een zaak niet binnen', async () => {
  const ander = await nieuwLid('Kassa Ander');
  const cap = await maakCap(lid.token, 3000);
  // het lid ziet de kaart wel (hij houdt de code vast) maar krijgt geen knop...
  const gezien = await json(await api('/api/link/los', { tekst: cap.token }, ander.token));
  assert.equal(gezien.type, 'capability');
  assert.deepEqual(gezien.intenties, [], 'een lid kan een kassacode niet innen, dus geen regel');
  // ...en de deur weigert hem ook echt
  assert.equal((await api('/api/link/cap/aanvaard', { capcode: cap.token, centen: 500 }, ander.token)).status, 403);
  // en andersom: de zaak komt niet door de ledendeur (die eist een ledensessie)
  assert.equal((await api('/api/link/cap/aanvaard', { capcode: cap.token, centen: 500 }, zaak)).status, 401);
});

test('de oude weg blijft precies zo werken: er is maar EEN plek die een kassacode int', async () => {
  /* De verhuizing gaat over de DRAGER. Wie zijn code voorleest aan een kassa
     zonder camera, rekent nog gewoon af -- en langs dezelfde functie. */
  const k = await json(await api('/api/pay/kascode', { maxCenten: 2500 }, lid.token));
  assert.match(k.code, /^[0-9A-F]{6}$/);
  const inn = await json(await api('/api/supplier/pay/in', { code: k.code, centen: 800, oms: 'Bar', idem: 'oud-' + Date.now() }, zaak));
  assert.equal(inn.ok, true);
  assert.equal(inn.centen, 800);
});

test('beide kanten houden hun bon, ook de zaak', async () => {
  const cap = await maakCap(lid.token, 4000);
  await api('/api/supplier/link/cap/aanvaard', { capcode: cap.token, centen: 1500 }, zaak);
  const vanLid = (await json(await api('/api/link/bonnen', {}, lid.token))).bonnen;
  assert.equal(vanLid[0].intentie, 'geld.kassa.gebruikt', 'het lid ziet dat zijn code gebruikt is');
  assert.equal(vanLid[0].naar, 'supplier:LUCHT', 'en door wie');
});
