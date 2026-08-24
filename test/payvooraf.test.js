/* DE PRE-AUTORISATIE -- vastzetten, vastleggen, vrijgeven.

   WAAROM DEZE TOETS ER IS

   kern/waarde/reserve.js bestond een commit lang zonder dat iets hem aanriep.
   Dat is exact de fout waar het besluit WALLET_SALDO aan onderdoor ging: een
   regel die in een module staat maar niet in de betaalweg, is geen regel. Deze
   toets gaat daarom niet over de reserveermotor -- die heeft zijn eigen toets in
   test/waarde.test.js -- maar over de vraag of een ZAAK er langs de voordeur bij
   kan, en of het lid het merkt.

   WAT HIER WORDT NAGETROKKEN

   1. DE HELE CYCLUS KLOPT OP DE CENT. Vastzetten boekt niets, vastleggen boekt
      het werkelijke bedrag, en wat niet gebruikt is valt terug naar het lid.
   2. VASTGEZET GELD IS NIET UITGEEFBAAR. Dat is de hele belofte van een borg;
      zonder die eigenschap is het een voornemen.
   3. HET LID ZIET HET. Saldo, gereserveerd en beschikbaar staan alle drie in
      zijn overzicht, met wie het vastzette. Geld dat vastzit zonder uitleg is
      erger dan geld dat weg is.
   4. EEN ANDERE ZAAK KOMT ER NIET BIJ. Wie het id van een reservering kent, kan
      hem niet innen als hij niet van hem is.
   5. VRIJGEVEN GEEFT ALLES TERUG.
   6. HET GROOTBOEK BLIJFT SLUITEN. Een reservering is geen boeking.

   Draai los: node --experimental-sqlite --test test/payvooraf.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, sup;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vooraf-'));
const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const overzicht = () => api('pay/overzicht', {}, lid.token).then(r => r.body);
const nieuweCode = (max) => api('pay/kascode', { maxCenten: max }, lid.token).then(r => r.body.code);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const d = await (await fetch(base + '/api/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json();
  lid = { token: d.token, codenaam: (await api('pay/overzicht', {}, d.token)).body.codenaam };
  const s = await (await fetch(base + '/api/supplier/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'rahul', password: 'Imran' }) })).json();
  sup = { token: s.token, code: s.state.supplier.code };
  assert.ok(lid.codenaam && sup.code, 'een lid met een wallet en een zaak achter de kassa');
  const op = await api('pay/oplaad', { centen: 30000, idem: 'vooraf-start' }, lid.token);
  assert.equal(op.status, 200, 'driehonderd euro op de wallet');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de hele cyclus: vastzetten boekt niets, vastleggen boekt het werkelijke bedrag', async () => {
  const voor = await overzicht();
  assert.equal(voor.gereserveerd, 0);
  assert.equal(voor.beschikbaar, voor.saldo, 'zonder reservering zijn saldo en beschikbaar hetzelfde');

  // de zaak zet 200 euro vast als borg
  const code = await nieuweCode(25000);
  const vast = await api('supplier/pay/vooraf', { code, maxCenten: 20000, oms: 'Borg kamer 12', idem: 'v1' }, sup.token);
  assert.equal(vast.status, 200, 'de zaak zet een maximum vast');
  assert.ok(vast.body.reservering, 'en krijgt een reserveringsnummer terug');

  const tijdens = await overzicht();
  assert.equal(tijdens.saldo, voor.saldo, 'het SALDO is niet bewogen: vastzetten is geen boeking');
  assert.equal(tijdens.gereserveerd, 20000, 'maar er staat wel 200 euro vast');
  assert.equal(tijdens.beschikbaar, voor.saldo - 20000, 'en beschikbaar is navenant lager');

  // bij het uitchecken blijkt het 128,40 te zijn
  const leg = await api('supplier/pay/vastleg', { reservering: vast.body.reservering, centen: 12840, oms: 'Kamer 12', idem: 'l1' }, sup.token);
  assert.equal(leg.status, 200);
  assert.equal(leg.body.centen, 12840, 'het werkelijke bedrag is geboekt');
  assert.equal(leg.body.vrijgevallen, 20000 - 12840, 'de rest valt terug naar het lid');

  const na = await overzicht();
  assert.equal(na.saldo, voor.saldo - 12840, 'er is precies het werkelijke bedrag afgeschreven');
  assert.equal(na.gereserveerd, 0, 'en er staat niets meer vast');
  assert.equal(na.beschikbaar, na.saldo);
});

test('vastgezet geld is niet uitgeefbaar -- dat is de hele belofte van een borg', async () => {
  const start = await overzicht();
  const code = await nieuweCode(30000);
  const vast = await api('supplier/pay/vooraf', { code, maxCenten: start.saldo, oms: 'Alles vast', idem: 'v2' }, sup.token);
  assert.equal(vast.status, 200, 'het hele saldo staat vast');

  // en nu wil het lid ergens anders afrekenen
  const code2 = await nieuweCode(5000);
  const poging = await api('supplier/pay/in', { code: code2, centen: 2000, idem: 'i2' }, sup.token);
  assert.equal(poging.status, 402, 'dat kan niet: het geld staat vast');
  assert.match(poging.body.error, /gereserveerd/, 'en het antwoord zegt waarom, niet alleen "onvoldoende"');

  await api('supplier/pay/vrijgeef', { reservering: vast.body.reservering }, sup.token);
});

test('het lid ziet wat er vastzit en door wie', async () => {
  const code = await nieuweCode(10000);
  const vast = await api('supplier/pay/vooraf', { code, maxCenten: 7500, oms: 'Openstaande rekening', idem: 'v3' }, sup.token);
  assert.equal(vast.status, 200);

  const o = await overzicht();
  assert.equal(o.reserveringen.length, 1);
  assert.equal(o.reserveringen[0].centen, 7500);
  assert.equal(o.reserveringen[0].doel, 'Openstaande rekening', 'het lid leest waarvoor');
  assert.equal(o.reserveringen[0].door, sup.code, 'en door wie');
  assert.ok(o.reserveringen[0].tot > Date.now(), 'en tot wanneer -- vastgezet geld loopt altijd af');

  // vrijgeven geeft alles terug
  const vrij = await api('supplier/pay/vrijgeef', { reservering: vast.body.reservering }, sup.token);
  assert.equal(vrij.body.vrijgevallen, 7500);
  const na = await overzicht();
  assert.equal(na.gereserveerd, 0);
  assert.equal(na.beschikbaar, na.saldo);
});

test('een reservering van een andere zaak is niet te innen', async () => {
  const code = await nieuweCode(10000);
  const vast = await api('supplier/pay/vooraf', { code, maxCenten: 5000, oms: 'Van ons', idem: 'v4' }, sup.token);
  assert.equal(vast.status, 200);

  // een tweede zaak logt in en probeert dezelfde reservering vast te leggen
  const lijst = await api('supplier/pay/vooraf/lijst', {}, sup.token);
  assert.equal(lijst.body.vastgezetCenten, 5000, 'de zaak ziet zelf wat zij heeft vastgezet');

  const anders = await (await fetch(base + '/api/supplier/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'demo', password: 'demo' }) })).json();
  if (anders && anders.token && anders.state && anders.state.supplier.code !== sup.code) {
    const dief = await api('supplier/pay/vastleg', { reservering: vast.body.reservering, centen: 5000, idem: 'x' }, anders.token);
    assert.equal(dief.status, 404, 'een andere zaak kent deze reservering niet');
    const nog = await api('supplier/pay/vooraf/lijst', {}, sup.token);
    assert.equal(nog.body.vastgezetCenten, 5000, 'en hij staat er nog gewoon');
  }
  await api('supplier/pay/vrijgeef', { reservering: vast.body.reservering }, sup.token);
});

test('meer vastleggen dan vastgezet kan niet, en het grootboek blijft sluiten', async () => {
  const code = await nieuweCode(10000);
  const vast = await api('supplier/pay/vooraf', { code, maxCenten: 4000, oms: 'Taxi, maximale ritprijs', idem: 'v5' }, sup.token);
  const teveel = await api('supplier/pay/vastleg', { reservering: vast.body.reservering, centen: 9000, idem: 'l5a' }, sup.token);
  assert.equal(teveel.status, 409, 'boven het vastgezette maximum kan niet');

  const goed = await api('supplier/pay/vastleg', { reservering: vast.body.reservering, centen: 2600, idem: 'l5b' }, sup.token);
  assert.equal(goed.body.centen, 2600, 'de rit was goedkoper dan het maximum');

  const g = await fetch(base + '/api/pay/gezond');
  assert.equal(g.status, 200);
  assert.equal((await g.json()).klopt, true, 'de som van alle saldi is nog exact nul');
});
