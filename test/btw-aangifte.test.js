/* De btw-aangifte van een zaak: de periodevakken, de telling over het
   factuurregister, de twee controles die weigeren, de correctie en de poorten
   van de leverancier-endpoints.
   Draai: node --test test/btw-aangifte.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakBtwAangifte } = require('../server/kern/fiscaal/btwaangifte');
const { maakBtwTelling, periodeVak } = require('../server/kern/fiscaal/btwtelling');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* Een factuur zoals kern/facturatie/motor.js hem boekt: regels met hun eigen
   tarief en een prijs INCLUSIEF btw, plus de btw op de factuurkop. De kop wordt
   hier met dezelfde afronding als de motor uitgerekend, want juist het verschil
   tussen die twee wegen is wat de aangifte controleert. */
const rond = n => Math.round(n * 100) / 100;
function factuur({ nummer, datum, verkoper, koperZaak, regels }) {
  const uit = regels.map(([incl, btw]) => ({ omschrijving: 'Post', aantal: 1, stuk: incl, btw, incl }));
  const btwBedrag = rond(uit.reduce((s, r) => s + rond(r.incl - rond(r.incl / (1 + r.btw / 100))), 0));
  return { id: 'f' + nummer, nummer: 'RTG-' + nummer, datum, at: datum + 'T10:00:00.000Z',
    verkoper: { code: verkoper || null, naam: 'V' },
    koper: { key: null, supplierCode: koperZaak || null, naam: 'K', codenaam: null },
    regels: uit, subtotaal: rond(uit.reduce((s, r) => s + r.incl, 0) - btwBedrag),
    btwBedrag, totaal: rond(uit.reduce((s, r) => s + r.incl, 0)) };
}

/* Een nep-opslag met alleen wat deze laag aanraakt. Geen server, dus de
   weigeringen zijn hier exact na te lopen. `nu` is instelbaar: zonder een vaste
   klok zou "de periode is voorbij" van de kalender afhangen en zou deze suite
   op 1 januari iets anders bewijzen dan op 2 juli. */
function opzet(facturen, nuIso) {
  const db = { data: { facturen: facturen || [], btwAangiftes: [] } };
  let bewaard = 0;
  const klok = { nu: nuIso || '2026-08-09T12:00:00.000Z' };
  const laag = maakBtwAangifte({ db, save: () => { bewaard += 1; }, crypto, nu: () => klok.nu });
  return { db, laag: laag.btwAangifte, saves: () => bewaard, klok };
}
const ZAAK = { code: 'SAL', name: 'Sal de Mar', settings: { land: 'NL' } };

// ---------------------------------------------------------------- 1. periodes
test('een periode is een gesloten vak, en onzin is geen periode', () => {
  assert.deepEqual(periodeVak('2026K3'), { soort: 'kwartaal', periode: '2026K3', jaar: 2026, van: '2026-07-01', tot: '2026-09-30' });
  assert.deepEqual(periodeVak('2026K1').tot, '2026-03-31');
  assert.deepEqual(periodeVak('2026K4').tot, '2026-12-31');
  assert.equal(periodeVak('2026-02').tot, '2026-02-28');
  assert.equal(periodeVak('2024-02').tot, '2024-02-29', 'schrikkeljaar');
  for (const rommel of ['', 'K3', '2026K5', '2026K0', '2026-13', '2026-00', 'rommel', '2026']) {
    assert.equal(periodeVak(rommel), null, rommel + ' is geen periode');
  }
});

// ------------------------------------------------------------------ 2. tellen
test('de telling splitst op tarief, scheidt verkoop van inkoop en negeert de buren', () => {
  const db = { data: { facturen: [
    factuur({ nummer: 1, datum: '2026-04-10', verkoper: 'SAL', regels: [[109, 9]] }),
    factuur({ nummer: 2, datum: '2026-05-02', verkoper: 'SAL', regels: [[121, 21], [109, 9]] }),
    factuur({ nummer: 3, datum: '2026-06-30', verkoper: 'ANDERS', koperZaak: 'SAL', regels: [[242, 21]] }),
    factuur({ nummer: 4, datum: '2026-07-01', verkoper: 'SAL', regels: [[1000, 21]] }),   // volgend kwartaal
    factuur({ nummer: 5, datum: '2026-03-31', verkoper: 'SAL', regels: [[1000, 21]] }),   // vorig kwartaal
    factuur({ nummer: 6, datum: '2026-05-05', verkoper: 'ANDERS', regels: [[1000, 21]] }) // niet van ons
  ] } };
  const t = maakBtwTelling({ db }).telFacturen('SAL', periodeVak('2026K2'));

  assert.equal(t.verkoopAantal, 2, 'twee verkoopfacturen in het vak');
  assert.equal(t.inkoopAantal, 1, 'een inkoopfactuur in het vak');
  assert.equal(t.verkoop[9].btwCenten, 900 + 900, '2x 9 euro btw op 109 incl');
  assert.equal(t.verkoop[9].omzetCenten, 10000 + 10000, 'en 100 euro grondslag per stuk');
  assert.equal(t.verkoop[21].btwCenten, 2100, '21 euro btw op 121 incl');
  assert.equal(t.verkoopSom, 900 + 900 + 2100);
  assert.equal(t.voorbelasting, 4200, 'de inkoopfactuur van 242 incl 21%');
  assert.equal(t.zonderRegels.length, 0);
});

test('een factuur zonder regels wordt gemeld en niet als nul meegeteld', () => {
  const kaal = factuur({ nummer: 9, datum: '2026-04-10', verkoper: 'SAL', regels: [[121, 21]] });
  kaal.regels = [];
  const { laag } = opzet([kaal]);
  const r = laag.maak(ZAAK, '2026K2', 'Beheer');
  assert.equal(r.status, 422);
  assert.match(r.error, /RTG-9/, 'noemt de factuur bij nummer');
});

// --------------------------------------------------------- 3. de twee controles
test('de aangifte weigert als regels en factuurkop over de btw uiteenlopen', () => {
  const scheef = factuur({ nummer: 11, datum: '2026-04-10', verkoper: 'SAL', regels: [[121, 21]] });
  assert.equal(scheef.btwBedrag, 21, 'de kop klopt nog');
  scheef.btwBedrag = 30; // wat een tweede btw-motor zou doen
  const { laag } = opzet([scheef]);
  const r = laag.maak(ZAAK, '2026K2', 'Beheer');
  assert.equal(r.status, 422);
  assert.match(r.error, /2100 cent.*3000 cent/, 'noemt beide wegen');
});

test('de aangifte weigert ook als de voorbelasting uiteenloopt', () => {
  const scheef = factuur({ nummer: 12, datum: '2026-04-10', verkoper: 'X', koperZaak: 'SAL', regels: [[121, 21]] });
  scheef.btwBedrag = 5;
  const { laag } = opzet([scheef]);
  const r = laag.maak(ZAAK, '2026K2', 'Beheer');
  assert.equal(r.status, 422);
  assert.match(r.error, /voorbelasting/i);
});

// ------------------------------------------------------------- 4. de levensloop
test('opmaken, bijwerken zolang de periode loopt, en pas indienen als hij voorbij is', () => {
  const facturen = [factuur({ nummer: 21, datum: '2026-07-10', verkoper: 'SAL', regels: [[121, 21]] })];
  const { laag } = opzet(facturen); // klok: 2026-08-09, dus K3 loopt nog

  const a = laag.maak(ZAAK, '2026K3', 'Beheer');
  assert.equal(a.ok, true);
  assert.equal(a.aangifte.stand, 'concept');
  assert.equal(a.aangifte.periodeLoopt, true);
  assert.equal(a.aangifte.saldoCenten, 2100);
  assert.equal(a.aangifte.tarieven[0].rubriek, '1a', 'NL-rubriek bij 21%');
  assert.match(a.aangifte.let, /tussenstand/);

  // indienen mag niet: de periode loopt nog
  const teVroeg = laag.dienIn(a.aangifte.id, 'Beheer', 'BD-123456');
  assert.equal(teVroeg.status, 409);
  assert.match(teVroeg.error, /2026-09-30/);

  // een tweede factuur -> opnieuw opmaken werkt het CONCEPT bij, geen tweede aangifte
  facturen.push(factuur({ nummer: 22, datum: '2026-08-01', verkoper: 'SAL', regels: [[109, 9]] }));
  const b = laag.maak(ZAAK, '2026K3', 'Beheer');
  assert.equal(b.bijgewerkt, true);
  assert.equal(b.aangifte.id, a.aangifte.id, 'dezelfde aangifte');
  assert.equal(b.aangifte.saldoCenten, 3000);
  assert.equal(laag.vanZaak('SAL').length, 1, 'geen tweede concept over dezelfde periode');
});

test('een concept dat de periode overleeft, laat de tussenstand-zin los', () => {
  const facturen = [factuur({ nummer: 25, datum: '2026-08-10', verkoper: 'SAL', regels: [[121, 21]] })];
  const { laag, klok } = opzet(facturen); // klok: 9 augustus, K3 loopt nog
  const a = laag.maak(ZAAK, '2026K3', 'Beheer').aangifte;
  assert.match(a.let, /tussenstand/, 'tijdens de periode staat de zin er');

  klok.nu = '2026-10-02T09:00:00.000Z'; // het kwartaal is voorbij
  const bij = laag.maak(ZAAK, '2026K3', 'Beheer');
  assert.equal(bij.bijgewerkt, true);
  assert.equal(bij.aangifte.periodeLoopt, false);
  assert.equal(bij.aangifte.let, undefined,
    'de zin "indienen kan pas als de periode voorbij is" mag niet blijven staan boven een aangifte die wel ingediend kan worden');
  assert.equal(laag.dienIn(bij.aangifte.id, 'Beheer', 'BD-123456').ok, true, 'en indienen kan nu echt');
});

test('indienen eist een kenmerk, en een ingediende aangifte gaat niet twee keer', () => {
  const { laag } = opzet([factuur({ nummer: 31, datum: '2026-05-10', verkoper: 'SAL', regels: [[121, 21]] })]);
  const a = laag.maak(ZAAK, '2026K2', 'Beheer').aangifte;
  assert.equal(a.periodeLoopt, false, 'K2 is voorbij op 9 augustus');

  assert.equal(laag.dienIn(a.id, 'Beheer', '').status, 400, 'zonder kenmerk niet');
  assert.equal(laag.dienIn(a.id, 'Beheer', 'BD').status, 400, 'een te kort kenmerk ook niet');
  assert.equal(laag.dienIn(a.id, '', 'BD-123456').status, 400, 'en niet anoniem');

  const in1 = laag.dienIn(a.id, 'Beheer', 'BD-123456');
  assert.equal(in1.ok, true);
  assert.equal(in1.aangifte.stand, 'ingediend');
  assert.equal(in1.aangifte.kenmerk, 'BD-123456');
  assert.match(in1.let, /verzenden zelf loopt buiten RTG om/, 'belooft geen verzending');

  assert.equal(laag.dienIn(a.id, 'Beheer', 'BD-999999').status, 409, 'niet twee keer');
});

test('indienen weigert op cijfers die sinds het opmaken zijn veranderd', () => {
  const facturen = [factuur({ nummer: 41, datum: '2026-05-10', verkoper: 'SAL', regels: [[121, 21]] })];
  const { laag } = opzet(facturen);
  const a = laag.maak(ZAAK, '2026K2', 'Beheer').aangifte;
  facturen.push(factuur({ nummer: 42, datum: '2026-06-11', verkoper: 'SAL', regels: [[242, 21]] }));

  const r = laag.dienIn(a.id, 'Beheer', 'BD-123456');
  assert.equal(r.status, 409);
  assert.match(r.error, /veranderd sinds/);
  assert.equal(laag.haal(a.id).stand, 'concept', 'en hij staat nog steeds op concept');

  // opnieuw opmaken haalt hem bij, daarna mag het wel
  laag.maak(ZAAK, '2026K2', 'Beheer');
  assert.equal(laag.dienIn(a.id, 'Beheer', 'BD-123456').ok, true);
});

// -------------------------------------------------------------- 5. de correctie
test('na indienen komt er een correctie bovenop, met verwijzing en verschil', () => {
  const facturen = [factuur({ nummer: 51, datum: '2026-05-10', verkoper: 'SAL', regels: [[121, 21]] })];
  const { laag } = opzet(facturen);
  const a = laag.maak(ZAAK, '2026K2', 'Beheer').aangifte;
  laag.dienIn(a.id, 'Beheer', 'BD-123456');

  const tweede = laag.maak(ZAAK, '2026K2', 'Beheer');
  assert.equal(tweede.status, 409, 'geen tweede gewone aangifte over dezelfde periode');
  assert.match(tweede.error, /correctie/);

  facturen.push(factuur({ nummer: 52, datum: '2026-06-11', verkoper: 'SAL', regels: [[242, 21]] }));
  const c = laag.maak(ZAAK, '2026K2', 'Beheer', { correctie: true });
  assert.equal(c.ok, true);
  assert.equal(c.aangifte.soort, 'correctie');
  assert.equal(c.aangifte.corrigeert, a.id, 'verwijst naar wat hij rechtzet');
  assert.equal(c.aangifte.saldoCenten, 2100 + 4200);
  assert.equal(c.aangifte.verschilCenten, 4200);
  assert.equal(laag.haal(a.id).stand, 'ingediend', 'het origineel blijft onaangeroerd');
  assert.equal(laag.haal(a.id).saldoCenten, 2100, 'en houdt zijn eigen cijfers');
});

test('een correctie zonder ingediende aangifte bestaat niet', () => {
  const { laag } = opzet([factuur({ nummer: 61, datum: '2026-05-10', verkoper: 'SAL', regels: [[121, 21]] })]);
  const r = laag.maak(ZAAK, '2026K2', 'Beheer', { correctie: true });
  assert.equal(r.status, 409);
  assert.match(r.error, /nog niets ingediend/);
});

test('een periode die nog niet begon, en onzin, worden geweigerd', () => {
  const { laag } = opzet([]);
  assert.equal(laag.maak(ZAAK, '2027K1', 'Beheer').status, 400);
  assert.equal(laag.maak(ZAAK, 'volgende week', 'Beheer').status, 400);
  assert.equal(laag.maak(ZAAK, '2026K2', '').status, 400, 'en niet anoniem');
  assert.equal(laag.maak(null, '2026K2', 'Beheer').status, 404);
});

test('een nul-aangifte mag, en telt nul', () => {
  const { laag } = opzet([]);
  const a = laag.maak(ZAAK, '2026K2', 'Beheer');
  assert.equal(a.ok, true);
  assert.deepEqual(a.aangifte.tarieven, []);
  assert.equal(a.aangifte.saldoCenten, 0);
  assert.equal(a.aangifte.verkoopFacturen, 0);
});

test('buiten Nederland geen Nederlands rubrieknummer', () => {
  const { laag } = opzet([factuur({ nummer: 71, datum: '2026-05-10', verkoper: 'SAL', regels: [[121, 21]] })]);
  const a = laag.maak({ code: 'SAL', name: 'Sal', settings: { land: 'ES' } }, '2026K2', 'Beheer').aangifte;
  assert.equal(a.land, 'ES');
  assert.equal(a.tarieven[0].tarief, 21);
  assert.equal(a.tarieven[0].rubriek, null, 'geen 1a op een Spaans formulier');
});

// ------------------------------------------------------------- 6. de endpoints
let srv, base;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-btw-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  base = srv.base;
});
test.after(() => stop(srv && srv.child));

test('de zaak maakt zijn eigen btw-aangifte op, uit echte facturen', async () => {
  const tok = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  assert.ok(tok, 'leverancier-login');

  const f = await api(base, '/api/supplier/facturen/maak',
    { omschrijving: 'Consult', aantal: 1, bedrag: 121, koperNaam: 'Klant' }, tok);
  assert.equal(f.status, 200, 'factuur geboekt');
  const btwOpFactuur = Math.round(f.body.factuur.btwBedrag * 100);
  assert.ok(btwOpFactuur > 0, 'er zit btw op');

  // het lopende kwartaal: de factuur van zojuist zit erin
  const nu = new Date();
  const periode = nu.getUTCFullYear() + 'K' + (Math.floor(nu.getUTCMonth() / 3) + 1);
  const op = await api(base, '/api/supplier/btw/opmaken', { periode }, tok);
  assert.equal(op.status, 200);
  assert.equal(op.body.aangifte.periode, periode);
  assert.ok(op.body.aangifte.verschuldigdCenten >= btwOpFactuur, 'de factuur telt mee');
  assert.equal(op.body.aangifte.stand, 'concept');

  const lijst = await api(base, '/api/supplier/btw/aangiftes', {}, tok);
  assert.equal(lijst.status, 200);
  assert.ok(lijst.body.aangiftes.some(a => a.id === op.body.aangifte.id), 'staat in de lijst');

  const een = await api(base, '/api/supplier/btw/aangifte', { id: op.body.aangifte.id }, tok);
  assert.equal(een.status, 200);
  assert.equal(een.body.aangifte.id, op.body.aangifte.id);

  // indienen kan niet: het lopende kwartaal is niet voorbij
  const dien = await api(base, '/api/supplier/btw/indienen', { id: op.body.aangifte.id, kenmerk: 'BD-123456' }, tok);
  assert.equal(dien.status, 409);
  assert.match(dien.body.error, /periode/);
});

test('de zaak komt uit het token: een code in het lijf verandert niets', async () => {
  const tok = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const nu = new Date();
  const periode = nu.getUTCFullYear() + 'K' + (Math.floor(nu.getUTCMonth() / 3) + 1);
  const eigen = (await api(base, '/api/supplier/btw/opmaken', { periode }, tok)).body.aangifte;

  const gepoogd = await api(base, '/api/supplier/btw/opmaken', { periode, code: 'ANDERS', supplierCode: 'ANDERS' }, tok);
  assert.equal(gepoogd.status, 200);
  assert.equal(gepoogd.body.aangifte.code, eigen.code, 'nog steeds de eigen zaak');

  // een aangifte van een andere zaak bestaat voor deze zaak niet
  const vreemd = await api(base, '/api/supplier/btw/aangifte', { id: 'btw_bestaatniet' }, tok);
  assert.equal(vreemd.status, 404);
});

test('zonder geldig token komt er niets uit de btw-routes', async () => {
  for (const pad of ['/api/supplier/btw/opmaken', '/api/supplier/btw/aangiftes',
    '/api/supplier/btw/aangifte', '/api/supplier/btw/indienen']) {
    const zonder = await api(base, pad, { periode: '2026K1' });
    assert.equal(zonder.status, 401, pad + ' zonder token');
    const nep = await api(base, pad, { periode: '2026K1' }, 'nep-token-dat-niet-bestaat');
    assert.equal(nep.status, 401, pad + ' met een verzonnen token');
  }
});
