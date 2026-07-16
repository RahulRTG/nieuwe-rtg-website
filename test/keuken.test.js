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
  const bon = await api('supplier/pos/sale', { total: 2 * menuItem.price, method: 'contant', items: [{ name: menuItem.name, qty: 2, price: menuItem.price }] });
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

test('de werkvloer-balk: laag en op zichtbaar, en een 86-advies als een ingredient op is', async () => {
  // de wijn staat op 3 (laag); zet het lam op nul: het gerecht verdient een 86
  await api('supplier/keuken/telling', { artikelId: lam.id, geteld: 0 });
  const w = (await api('supplier/keuken/werkvloer')).body;
  assert.ok(w.laag.some(a => a.id === wijn.id), 'de wijn staat als laag op de balk');
  assert.ok(w.op.some(a => a.id === lam.id), 'het lam staat als OP op de balk');
  const adv = w.adviezen.find(a => a.menuItemId === menuItem.id);
  assert.ok(adv, 'het gerecht krijgt een 86-advies');
  assert.equal(adv.ingredient, 'Lamsrack');
  // de knop op het scherm: 86 zetten laat het advies verdwijnen
  assert.equal((await api('supplier/menu/86', { itemId: menuItem.id, op: true })).status, 200);
  const na = (await api('supplier/keuken/werkvloer')).body;
  assert.ok(!na.adviezen.some(a => a.menuItemId === menuItem.id), 'na de 86 is het advies weg');
  // netjes terug voor de vervolgtest: weer beschikbaar en voorraad terug
  await api('supplier/menu/86', { itemId: menuItem.id, op: false });
  await api('supplier/keuken/telling', { artikelId: lam.id, geteld: 14.2 });
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

test('een knop: het inkoopadvies wordt een groothandelsbestelling en geleverd vult de voorraad', async () => {
  // een artikel dat exact zo in het Mercabiza-assortiment staat, onder het minimum
  const cava = (await api('supplier/voorraad/zet', { naam: 'Cava brut', aantal: 2, min: 6, eenheid: 'fles', kostprijs: 5 })).body.item;
  const r = await api('supplier/keuken/bestel-advies', { groothandelCode: 'MERCABIZA' });
  assert.equal(r.status, 200);
  const regel = r.body.order.regels.find(x => x.naam === 'Cava brut');
  assert.ok(regel, 'de cava staat op de bestelling');
  assert.equal(regel.aantal, 10, 'aanvullen tot twee keer het minimum (12 - 2)');
  assert.ok(r.body.nietGevonden.includes('Huiswijn wit'), 'wat niet in het assortiment staat komt terug als nietGevonden');
  // de groothandel levert: manager Rosa logt in met haar pincode en loopt de keten
  const roster = await api('supplier/roster', { code: 'MERCABIZA' });
  const rosa = (roster.body.staff || []).find(x => x.role === 'manager');
  assert.ok(rosa, 'de groothandel heeft een manager op het rooster');
  const gh = await (await fetch(base + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'MERCABIZA', staffId: rosa.id, pin: '1234' })
  })).json();
  assert.ok(gh.token, 'de groothandel logt in');
  for (let i = 0; i < 3; i++) {
    assert.equal((await api('supplier/groothandel/order/status', { ref: r.body.order.ref, actie: 'verder' }, gh.token)).status, 200);
  }
  // geleverd: de voorraad vulde zichzelf aan en de inkoopprijs werd de kostprijs
  const na = (await api('supplier/keuken')).body;
  const c = na.artikelen.find(a => a.id === cava.id);
  assert.equal(c.aantal, 12, '2 op de plank plus 10 geleverd');
  assert.equal(c.kostprijs, 6, 'de regelprijs (inkoop) is de nieuwe kostprijs');
  assert.ok(na.logboek.some(x => x.soort === 'levering' && /mercabiza/i.test(x.wie || '')), 'de levering staat herleidbaar in het logboek');
});

test('de dagafsluiting: Z-rapport met btw-splitsing en de boekhoudexport als CSV', async () => {
  const r = await api('supplier/dagrapport', {});
  assert.equal(r.status, 200);
  assert.ok(r.body.bonnen >= 2, 'de kassabon en de gastbestelling tellen mee');
  assert.ok(r.body.omzet >= 3 * menuItem.price, 'de omzet telt beide verkopen');
  assert.ok(r.body.btw.length >= 1 && r.body.btw[0].btw > 0, 'de btw is gesplitst uit de omzet');
  assert.ok(r.body.betaalwijzen.contant >= 2 * menuItem.price, 'de contante bon staat onder de betaalwijzen');
  assert.ok(r.body.betaalwijzen.app >= menuItem.price, 'de app-bestelling ook');
  const csv = await fetch(base + '/api/supplier/dagrapport.csv?token=' + token);
  assert.equal(csv.status, 200);
  const tekst = await csv.text();
  assert.match(tekst, /Omzet /);
  assert.match(tekst, /btw-tarief/);
  assert.equal((await fetch(base + '/api/supplier/dagrapport.csv?token=fout')).status, 401, 'zonder geldige sessie geen export');
});

test('menu-engineering: volume maal marge, met een kwadrant en advies per gerecht', async () => {
  const r = await api('supplier/keuken/menu-analyse', {});
  assert.equal(r.status, 200);
  const rij = r.body.rijen.find(x => x.id === menuItem.id);
  assert.ok(rij.verkocht >= 3, 'twee over de kassa plus een gastbestelling');
  assert.ok(['ster', 'werkpaard', 'puzzel', 'hond'].includes(rij.klasse), 'het gerecht met recept krijgt een kwadrant');
  assert.ok(rij.advies.length > 10, 'met een advies erbij');
  assert.ok(r.body.rijen.some(x => x.klasse === 'onbekend'), 'zonder recept geen marge-oordeel');
});

test('het actieplan van de chef-adviseur: concrete acties met bedragen, plus de derving', async () => {
  const r = await api('supplier/keuken/menu-advies', {});
  assert.equal(r.status, 200);
  assert.ok(/omzet/.test(r.body.samenvatting) && /brutowinst/.test(r.body.samenvatting), 'de samenvatting noemt omzet en brutowinst');
  assert.ok(r.body.acties.length >= 1, 'er staan acties in het plan');
  assert.ok(r.body.acties.every(a => a.tekst && a.tekst.length > 15), 'elke actie is uitgeschreven');
  // de gebroken kist wijn (2 flessen) uit de eerdere test staat als derving in het plan
  assert.ok(r.body.derving >= 2 * 7.5, 'de derving telt de kostprijs van de breuk');
  assert.ok(r.body.acties.some(a => a.soort === 'derving'), 'en het plan benoemt de derving');
});

test('de tafelplanning: reservering, tafel toewijzen, komst en de walk-in', async () => {
  // een lid vraagt een tafel voor vanavond aan
  const lid = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json();
  const vandaag = new Date().toISOString().slice(0, 10);
  const aanvraag = await api('reserveer', { supplierCode: supCode, datum: vandaag, tijd: '20:00', personen: 4, notitie: 'Bij het raam' }, lid.token);
  assert.equal(aanvraag.status, 200);
  const rid = aanvraag.body.reservering.id;
  // de zaak ziet hem op de planning van vandaag als open aanvraag
  let plan = (await api('supplier/tafelplan', {})).body;
  assert.ok(plan.openAanvragen >= 1, 'de aanvraag staat open op de planning');
  assert.ok(plan.tafels.length >= 4, 'de tafels staan op de kaart');
  // bevestigen, tafel toewijzen: de tafel gaat op gereserveerd
  assert.equal((await api('supplier/reservering/beslis', { id: rid, action: 'bevestig' })).status, 200);
  const tafelNaam = plan.tafels[0].name;
  assert.equal((await api('supplier/reservering/tafel', { id: rid, tafel: tafelNaam })).status, 200);
  plan = (await api('supplier/tafelplan', {})).body;
  assert.equal(plan.tafels.find(t => t.name === tafelNaam).status, 'gereserveerd');
  assert.equal(plan.verwachtePersonen, 4, 'vier gasten verwacht vanavond');
  // de gast komt binnen: de tafel staat op bezet; en na afloop weer vrij
  assert.equal((await api('supplier/reservering/komst', { id: rid, actie: 'aangekomen' })).status, 200);
  plan = (await api('supplier/tafelplan', {})).body;
  assert.equal(plan.tafels.find(t => t.name === tafelNaam).status, 'bezet');
  assert.equal((await api('supplier/reservering/komst', { id: rid, actie: 'vertrokken' })).status, 200);
  plan = (await api('supplier/tafelplan', {})).body;
  assert.equal(plan.tafels.find(t => t.name === tafelNaam).status, 'vrij');
  // de walk-in: een tik op een vrije tafel; dezelfde tafel nog eens ketst af
  const w = await api('supplier/walkin', { tafel: tafelNaam, personen: 2 });
  assert.equal(w.status, 200);
  assert.equal(w.body.reservering.status, 'aangekomen');
  assert.equal((await api('supplier/walkin', { tafel: tafelNaam, personen: 2 })).status, 409, 'een bezette tafel neemt geen walk-in');
  // en de no-show maakt de gereserveerde tafel weer vrij
  const aan2 = await api('reserveer', { supplierCode: supCode, datum: vandaag, tijd: '21:30', personen: 2 }, lid.token);
  const rid2 = aan2.body.reservering.id;
  await api('supplier/reservering/beslis', { id: rid2, action: 'bevestig' });
  const vrije = (await api('supplier/tafelplan', {})).body.tafels.find(t => t.status === 'vrij').name;
  await api('supplier/reservering/tafel', { id: rid2, tafel: vrije });
  assert.equal((await api('supplier/reservering/komst', { id: rid2, actie: 'no-show' })).status, 200);
  plan = (await api('supplier/tafelplan', {})).body;
  assert.equal(plan.tafels.find(t => t.name === vrije).status, 'vrij', 'na de no-show is de tafel weer vrij');
});

test('de rekening per tafel: bonnen op de tafel zetten, afrekenen, en de tafel is weer vrij', async () => {
  // een walk-in aan een vrije tafel, en twee bonnen op die tafel
  const plan0 = (await api('supplier/tafelplan', {})).body;
  const tafel = plan0.tafels.find(t => t.status === 'vrij').name;
  await api('supplier/walkin', { tafel, personen: 2 });
  const b1 = await api('supplier/pos/sale', { total: menuItem.price, method: 'tafel', room: tafel, items: [{ name: menuItem.name, qty: 1, price: menuItem.price }] });
  assert.equal(b1.status, 200);
  await api('supplier/pos/sale', { total: 6, method: 'tafel', room: tafel, desc: 'Espresso en water' });
  const plan = (await api('supplier/tafelplan', {})).body;
  const t = plan.tafels.find(x => x.name === tafel);
  assert.equal(t.rekening.posten, 2, 'de tafel draagt twee posten');
  assert.equal(t.rekening.totaal, menuItem.price + 6);
  // zonder echte tafel geen tafelbon
  assert.equal((await api('supplier/pos/sale', { total: 5, method: 'tafel' })).status, 400);
  // afrekenen: de rekening sluit en de tafel staat weer vrij
  const uit = await api('supplier/pos/checkout', { room: tafel, method: 'contant' });
  assert.equal(uit.status, 200);
  assert.equal(uit.body.sale.total, menuItem.price + 6, 'een bedrag voor de hele tafel');
  const na = (await api('supplier/tafelplan', {})).body.tafels.find(x => x.name === tafel);
  assert.equal(na.rekening, null, 'de rekening is dicht');
  assert.equal(na.status, 'vrij', 'en de tafel is weer vrij');
});

test('de shift-samenvatting: cijfers, gasten, toppers en derving in een kaart', async () => {
  const r = await api('supplier/shift', {});
  assert.equal(r.status, 200);
  assert.ok(r.body.omzet > 0 && r.body.bonnen >= 3, 'de dagcijfers staan erin');
  assert.ok(r.body.toppers.some(t => t.naam === menuItem.name), 'het gerecht staat bij de toppers');
  assert.ok(r.body.gasten.noShows >= 1, 'de no-show uit de tafelplanning telt mee');
  assert.ok(r.body.gasten.walkIns >= 2, 'de walk-ins ook');
  assert.ok(r.body.derving >= 2 * 7.5, 'de gebroken kist wijn staat als derving in de briefing');
  assert.ok(r.body.team.length >= 1, 'en wie er op de kassa stond');
});
