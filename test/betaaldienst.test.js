/* De betaaldienstkosten gaan DIRECT naar de ondernemer: per kassabetaling
   meteen verrekend op de partnerrekening (eigen grootboekregel), transparant
   op de bon en in het partneroverzicht -- geen verzamelfactuur achteraf.
   RTG stelt het tarief vanuit de boardroom (geld-regie); tikken tussen leden
   blijven kosteloos. Draai los:
   node --experimental-sqlite --test test/betaaldienst.test.js */
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

let srv, base, lid, zaak, office;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-betaaldienst-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Kosten Lid', email: 'bd' + u + '@x.nl',
    phone: '061' + u.slice(1), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const roster = await api(base, '/api/supplier/roster', { code: 'LUCHT' });
  const man = roster.body.staff.find(m => m.role === 'manager');
  zaak = (await api(base, '/api/supplier/login', { code: 'LUCHT', staffId: man.id, pin: '1234' })).body.token;
  office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
});
test.after(() => stop(srv && srv.child));

const kascode = async () => (await api(base, '/api/pay/kascode', { maxCenten: 10000 }, lid)).body.code;

test('1. het standaardtarief: 10 centen + 1%, per transactie DIRECT verrekend met de zaak', async () => {
  const t = await api(base, '/api/office/geld/betaaldienst', {}, office);
  assert.equal(t.status, 200);
  assert.equal(t.body.vastCenten, 10);
  assert.equal(t.body.pct, 1);
  const inn = await api(base, '/api/supplier/pay/in', { code: await kascode(), centen: 2000, oms: 'Lounge', idem: 'bd-1' }, zaak);
  assert.equal(inn.status, 200);
  assert.equal(inn.body.kosten, 30, '10 vast + 1% van 2000 = 30 centen');
  const pot = await api(base, '/api/supplier/pay/overzicht', {}, zaak);
  assert.equal(pot.body.saldo, 1970, 'netto direct op de rekening van de ondernemer');
  assert.equal(pot.body.kostenVandaag, 30, 'de kosten van vandaag staan er transparant naast');
  // de kostenregel staat als eigen boeking in het grootboek van de zaak
  assert.ok(pot.body.boekingen.some(b => b.soort === 'betaaldienstkosten' && b.centen === 30), 'eigen grootboekregel');
});

test('2. de boardroom stelt het tarief; op nul betekent: geen kosten meer', async () => {
  assert.equal((await api(base, '/api/office/geld/betaaldienst', { vastCenten: 2000, pct: 1 }, office)).status, 400, 'onzin-voet geweigerd');
  assert.equal((await api(base, '/api/office/geld/betaaldienst', { vastCenten: 10, pct: 9 }, office)).status, 400, 'boven de 5% geweigerd');
  const zet = await api(base, '/api/office/geld/betaaldienst', { vastCenten: 0, pct: 0 }, office);
  assert.equal(zet.status, 200);
  const inn = await api(base, '/api/supplier/pay/in', { code: await kascode(), centen: 1500, idem: 'bd-2' }, zaak);
  assert.equal(inn.body.kosten, 0, 'tarief nul: geen kosten');
  const pot = await api(base, '/api/supplier/pay/overzicht', {}, zaak);
  assert.equal(pot.body.saldo, 1970 + 1500, 'het volle bedrag erbij');
  // het tarief staat ook in het geld-overzicht van de boardroom
  const g = await api(base, '/api/office/geld', {}, office);
  assert.equal(g.body.betaaldienst.vastCenten, 0);
  // en terug naar het standaardtarief voor de volgende test
  await api(base, '/api/office/geld/betaaldienst', { vastCenten: 10, pct: 1 }, office);
});

test('3. de kassabon draagt de kosten, en het grootboek blijft op de cent sluiten', async () => {
  const bon = await api(base, '/api/supplier/pos/sale', { total: 12, method: 'rtgpay', payCode: await kascode(),
    idem: 'bd-bon-1', items: [{ name: 'Cava', qty: 1, price: 12 }] }, zaak);
  assert.equal(bon.status, 200);
  assert.equal(bon.body.sale.betaaldienstKosten, 22, '10 vast + 1% van 1200 = 22 centen op de bon');
  const gezond = await fetch(base + '/api/pay/gezond');
  assert.equal((await gezond.json()).klopt, true, 'de som van alle saldi blijft nul');
});

test('4. tikken tussen leden blijven kosteloos: dit raakt alleen de kassa van de zaak', async () => {
  const u = Date.now().toString().slice(-8);
  const lidB = (await api(base, '/api/auth/register', { name: 'Tik Vriend', email: 'bd2' + u + '@x.nl',
    phone: '062' + u.slice(1), password: 'geheim123', geboortedatum: '1991-02-02', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const mij = await api(base, '/api/pay/overzicht', {}, lidB);
  const voor = mij.body.saldo;
  await api(base, '/api/pay/stuur', { aan: mij.body.codenaam || (await api(base, '/api/member/connections', {}, lidB)).body.codename, centen: 500, idem: 'bd-tik-1' }, lid);
  const na = await api(base, '/api/pay/overzicht', {}, lidB);
  assert.equal(na.body.saldo, voor + 500, 'de vriend ontvangt het volle bedrag, zonder kosten');
});
