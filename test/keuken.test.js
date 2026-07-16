/* Het keukenbrein (toren horeca): recepten per gerecht, automatische
   voorraad-afboeking bij de kassabon EN de betaalde gastbestelling, telling,
   verspilling, levering (met nieuwe kostprijs), het inkoopadvies en de marge
   per gerecht. Draai los:
   node --experimental-sqlite --test test/keuken.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-keuken-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (t || token) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let menuItem, supCode;        // een gerecht van het menu en de zaakcode
let wijn, lam;                // twee voorraadartikelen

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const login = await fetch(base + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'rahul', password: 'Imran' })
  });
  const d = await login.json();
  token = d.token;
  menuItem = (d.state.menu || [])[0];
  supCode = d.state.supplier.code;
  assert.ok(token && menuItem, 'de zaak logt in en heeft een menu');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('artikelen met kostprijs op de lijst; het overzicht telt de voorraadwaarde', async () => {
  wijn = (await api('supplier/voorraad/zet', { naam: 'Huiswijn wit', aantal: 24, min: 6, eenheid: 'fles', kostprijs: 7.5 })).body.item;
  lam = (await api('supplier/voorraad/zet', { naam: 'Lamsrack', aantal: 10, min: 4, eenheid: 'kg', kostprijs: 32 })).body.item;
  assert.ok(wijn && lam, 'twee artikelen staan op de lijst');
  assert.equal(wijn.kostprijs, 7.5);
  const o = (await api('supplier/keuken')).body;
  assert.equal(o.totaalWaarde, 24 * 7.5 + 10 * 32, 'de voorraadwaarde telt kostprijs maal stand');
  assert.equal(o.onderMinimum, 0);
});

test('een recept op het gerecht geeft kostprijs en marge', async () => {
  const r = await api('supplier/keuken/recept', { menuItemId: menuItem.id, regels: [
    { artikelId: lam.id, hoeveelheid: 0.4 }, { artikelId: wijn.id, hoeveelheid: 0.2 }
  ] });
  assert.equal(r.status, 200);
  const rec = (await api('supplier/keuken')).body.recepten.find(x => x.id === menuItem.id);
  assert.equal(rec.kostprijs, 0.4 * 32 + 0.2 * 7.5, 'kostprijs uit het recept');
  assert.equal(rec.marge, Math.round((menuItem.price - rec.kostprijs) * 100) / 100, 'marge = verkoopprijs min kostprijs');
  assert.equal((await api('supplier/keuken/recept', { menuItemId: 'bestaat-niet', regels: [] })).status, 404);
});

test('de kassabon boekt de ingredienten automatisch af via het recept', async () => {
  const bon = await api('supplier/pos/sale', { total: 2 * menuItem.price, method: 'pin', items: [{ name: menuItem.name, qty: 2, price: menuItem.price }] });
  assert.equal(bon.status, 200);
  const o = (await api('supplier/keuken')).body;
  const l = o.artikelen.find(a => a.id === lam.id);
  const w = o.artikelen.find(a => a.id === wijn.id);
  assert.equal(l.aantal, 10 - 0.8, 'twee gerechten kosten 0,8 kg lam');
  assert.equal(w.aantal, 24 - 0.4, 'en 0,4 fles wijn');
  assert.ok(o.logboek.some(x => x.soort === 'verkoop' && x.artikelId === lam.id), 'de afboeking staat in het logboek');
});

test('telling zet de stand recht en verspilling gaat eraf met reden', async () => {
  const t = await api('supplier/keuken/telling', { artikelId: wijn.id, geteld: 20 });
  assert.equal(t.status, 200);
  assert.equal(t.body.artikel.aantal, 20);
  assert.equal(t.body.verschil, Math.round((20 - 23.6) * 1000) / 1000, 'het kasverschil van de telling is zichtbaar');
  const v = await api('supplier/keuken/verspilling', { artikelId: wijn.id, hoeveelheid: 2, reden: 'Gebroken kist' });
  assert.equal(v.body.artikel.aantal, 18);
  const log = (await api('supplier/keuken')).body.logboek;
  assert.ok(log.some(x => x.soort === 'verspilling' && /Gebroken kist/.test(x.oms)), 'de reden staat in het logboek');
});

test('levering vult aan en de nieuwe inkoopprijs wordt de kostprijs', async () => {
  const r = await api('supplier/keuken/levering', { artikelId: lam.id, hoeveelheid: 5, kostprijs: 34.5 });
  assert.equal(r.status, 200);
  assert.equal(r.body.artikel.aantal, 9.2 + 5);
  assert.equal(r.body.artikel.kostprijs, 34.5, 'de laatste inkoopprijs is de kostprijs');
});

test('onder het minimum verschijnt het inkoopadvies: aanvullen tot twee keer min', async () => {
  await api('supplier/keuken/telling', { artikelId: wijn.id, geteld: 3 }); // min is 6
  const o = (await api('supplier/keuken')).body;
  assert.equal(o.onderMinimum, 1);
  const adv = o.advies.find(a => a.artikelId === wijn.id);
  assert.ok(adv, 'de wijn staat op het advies');
  assert.equal(adv.advies, 9, 'aanvullen tot twee keer het minimum (12 - 3)');
  assert.equal(adv.kosten, 9 * 7.5);
});

test('de betaalde gastbestelling boekt ook af (de tweede verkoopnaad)', async () => {
  // een lid bestelt het gerecht en betaalt; check de leden-bestelflow end-to-end
  const lid = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json();
  const sup = (await api('supplier/keuken')).body;
  const lamVoor = sup.artikelen.find(a => a.id === lam.id).aantal;
  const order = await api('order', { supplierCode: supCode, items: [{ id: menuItem.id, qty: 1 }] }, lid.token);
  assert.equal(order.status, 200, 'het lid kan bestellen');
  const pay = await api('order/pay', { ref: order.body.order.ref }, lid.token);
  assert.equal(pay.status, 200);
  const lamNa = (await api('supplier/keuken')).body.artikelen.find(a => a.id === lam.id).aantal;
  assert.equal(lamNa, Math.round((lamVoor - 0.4) * 1000) / 1000, 'de gastbestelling boekte 0,4 kg lam af');
});
