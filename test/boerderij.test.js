/* End-to-end tests voor het boerderij-genre (kern/boerderij.js): het slimme
   bedrijfssysteem voor boeren. Type kiezen, percelen + gewassen (zaaien ->
   groeien -> oogsten), dieren (voeren, opbrengst), takenbord, de seizoensbriefing
   en de AI-adviseur die ook dingen DOET (zonder Claude-sleutel via de ingebouwde
   opdrachtherkenning). Tegen een echte server; de demo-boerderij is CANFERRER.
   Draai: npm test */
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

let srv, base, boer;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-boer-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'CANFERRER' } });
  base = srv.base;
  const login = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  boer = { token: login.body.token, code: login.body.state.supplier.code };
  assert.equal(boer.code, 'CANFERRER', 'de demo-leverancier is de boerderij CANFERRER');
});
test.after(() => stop(srv && srv.child));

function overzicht() { return api(base, '/api/supplier/boerderij/overzicht', {}, boer.token).then(r => r.body); }

test('1. het geseede gemengde bedrijf heeft percelen, dieren, taken en keuzes', async () => {
  const o = await overzicht();
  assert.equal(o.type, 'gemengd');
  assert.equal(o.kind, 'gemengd');
  assert.ok(o.percelen.length >= 4 && o.dieren.length >= 3, 'percelen en dieren geseeded');
  assert.ok(o.types.length >= 8, 'er zijn meerdere boerderijtypes om uit te kiezen');
  assert.ok(o.gewaskeuze.length && o.dierkeuze.length, 'gewas- en dierkeuze aanwezig');
  // de mais staat over de verwachte oogstdatum -> fase te-oogsten
  const mais = o.percelen.find(p => p.gewas === 'mais');
  assert.equal(mais.fase, 'te-oogsten', 'mais is oogstklaar');
  assert.ok(o.stats.melkPerDag > 0, 'melkvee levert melk per dag');
});

test('2. de Vandaag-briefing signaleert oogst en niet-gevoerde dieren', async () => {
  const o = await overzicht();
  const soorten = o.briefing.punten.map(p => p.soort);
  assert.ok(soorten.includes('oogst'), 'briefing meldt oogstklaar perceel');
  assert.ok(o.briefing.seizoen, 'de briefing kent het seizoen');
});

test('3. perceel toevoegen, zaaien en oogsten werkt', async () => {
  let o = (await api(base, '/api/supplier/boerderij/perceel', { naam: 'Testakker', ha: 3 }, boer.token)).body;
  const p = o.percelen.find(x => x.naam === 'Testakker');
  assert.ok(p, 'nieuw perceel bestaat');
  const z = await api(base, '/api/supplier/boerderij/zaai', { id: p.id, gewas: 'aardappel' }, boer.token);
  assert.equal(z.status, 200);
  assert.ok(z.body.oogstVerwacht, 'oogstdatum berekend');
  const na = z.body.overzicht.percelen.find(x => x.id === p.id);
  assert.equal(na.gewas, 'aardappel');
  assert.ok(['gezaaid', 'groeit'].includes(na.fase), 'net gezaaid');
  const oogst = await api(base, '/api/supplier/boerderij/oogst', { id: p.id }, boer.token);
  assert.equal(oogst.status, 200);
  assert.ok(oogst.body.opbrengst > 0, 'oogst levert kilo\'s op');
});

test('4. dieren voeren en dagopbrengst vastleggen', async () => {
  const o = await overzicht();
  const koe = o.dieren.find(d => d.soort === 'melkkoe');
  const voer = await api(base, '/api/supplier/boerderij/voer', { id: koe.id }, boer.token);
  assert.equal(voer.status, 200);
  assert.ok(voer.body.voerKg > 0, 'voergift berekend uit aantal dieren');
  const opb = await api(base, '/api/supplier/boerderij/opbrengst', { id: koe.id, waarde: 1200 }, boer.token);
  assert.equal(opb.status, 200);
  const na = opb.body.overzicht.dieren.find(d => d.id === koe.id);
  assert.equal(na.dagopbrengst, 1200);
});

test('5. taak plannen en afronden', async () => {
  let o = (await api(base, '/api/supplier/boerderij/taak', { wat: 'Hek repareren', waar: 'Bovenveld' }, boer.token)).body;
  const t = o.taken.find(x => x.wat === 'Hek repareren');
  assert.ok(t && !t.klaar, 'taak staat open');
  const klaar = await api(base, '/api/supplier/boerderij/taak/klaar', { id: t.id }, boer.token);
  assert.equal(klaar.status, 200);
  assert.ok(klaar.body.overzicht.taken.find(x => x.id === t.id).klaar, 'taak is afgerond');
});

test('6. de AI-adviseur beantwoordt vragen en DOET opdrachten (zonder Claude-sleutel)', async () => {
  // een kennisvraag
  const vraag = await api(base, '/api/supplier/boerderij/ai', { vraag: 'Wanneer moet ik aardappels poten?' }, boer.token);
  assert.equal(vraag.status, 200);
  assert.ok(/april|mei|poot/i.test(vraag.body.antwoord), 'geeft een bruikbaar antwoord over aardappels');
  // een opdracht die iets doet: perceel aanmaken
  const opdr = await api(base, '/api/supplier/boerderij/ai', { vraag: 'voeg perceel Zuidhoek van 2 ha toe' }, boer.token);
  assert.equal(opdr.body.gedaan, true, 'de AI voerde de opdracht uit');
  assert.ok(opdr.body.overzicht.percelen.some(p => p.naam.toLowerCase() === 'zuidhoek'), 'perceel is echt aangemaakt');
  // een opdracht: dieren bijzetten
  const dier = await api(base, '/api/supplier/boerderij/ai', { vraag: 'voeg 15 kippen toe' }, boer.token);
  assert.equal(dier.body.gedaan, true);
  const kippen = dier.body.overzicht.dieren.filter(d => d.soort === 'legkip').reduce((n, d) => n + d.aantal, 0);
  assert.ok(kippen >= 195, 'de kippen zijn erbij gezet (180 + 15)');
});

test('8. oogst vult de verkoopvoorraad en een product gaat de Salon in', async () => {
  // nieuw perceel, zaaien, oogsten -> product verschijnt met voorraad
  let o = (await api(base, '/api/supplier/boerderij/perceel', { naam: 'Verkoopakker', ha: 1 }, boer.token)).body;
  const p = o.percelen.find(x => x.naam === 'Verkoopakker');
  await api(base, '/api/supplier/boerderij/zaai', { id: p.id, gewas: 'aardappel' }, boer.token);
  const oogst = await api(base, '/api/supplier/boerderij/oogst', { id: p.id }, boer.token);
  o = oogst.body.overzicht;
  const prod = o.producten.find(x => /aardappel/i.test(x.naam));
  assert.ok(prod && prod.voorraad > 0, 'oogst kwam in de verkoopvoorraad');
  assert.equal(prod.teKoop, false, 'zonder prijs nog niet te koop');
  // prijs zetten
  o = (await api(base, '/api/supplier/boerderij/product', { id: prod.id, prijs: 1.5 }, boer.token)).body;
  assert.equal(o.producten.find(x => x.id === prod.id).teKoop, true, 'met prijs en voorraad te koop');
  // in de Salon zetten -> er komt een partner-post met een deal in db.data.posts
  const salon = await api(base, '/api/supplier/boerderij/naar-salon', { id: prod.id }, boer.token);
  assert.equal(salon.status, 200);
  assert.ok(salon.body.postId, 'er is een Salon-post aangemaakt');
  assert.equal(salon.body.overzicht.producten.find(x => x.id === prod.id).inSalon, true, 'product staat als in-Salon gemarkeerd');
  // zonder prijs weigeren
  const geen = (await api(base, '/api/supplier/boerderij/product', { naam: 'Pompoenen', eenheid: 'stuk', voorraad: 10 }, boer.token)).body;
  const pp = geen.producten.find(x => x.naam === 'Pompoenen');
  const weiger = await api(base, '/api/supplier/boerderij/naar-salon', { id: pp.id }, boer.token);
  assert.equal(weiger.status, 400, 'zonder prijs mag het niet de Salon in');
});

test('7. een ander boerderijtype kiezen stuurt de gewas-/dierkeuze', async () => {
  const o = (await api(base, '/api/supplier/boerderij/type', { type: 'wijngaard' }, boer.token)).body;
  assert.equal(o.type, 'wijngaard');
  assert.equal(o.kind, 'gewas');
  assert.ok(o.gewaskeuze.some(g => g.id === 'druif'), 'wijngaard biedt druiven aan');
  // terugzetten naar gemengd voor de netheid
  await api(base, '/api/supplier/boerderij/type', { type: 'gemengd' }, boer.token);
});
