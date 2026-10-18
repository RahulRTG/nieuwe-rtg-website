/* ============================================================================
   RTG CONCERN OVER DE ROUTES -- de twintig deuren die geen toets aanriep.

   test/concern.test.js en zijn buren toetsen de kern in het proces;
   concern-routes.e2e.js loopt een deel van de deuren af in de browser. Deze
   deuren riep niemand aan: groep en boom, onderneming en discovery, het feit
   beeindigen, verloopt, functiescheiding, kwalificaties, mens/zet, uit dienst,
   impact, momentopnames, overname, fusie en document/lees.

   DE BEWERING VAN DIT BESTAND is die van de kop van server/routes/concern.js:
   ALLES LOOPT LANGS mijn(). Een id uit het lichaam is nooit een bewijs -- niet
   van een entiteit, niet van een groep, niet van een dienstverband, niet van
   een feit en niet van een persoon. Elke toets hieronder doet dus twee dingen:
   de eigenaar kan het, en een ANDERE eigenaar met een eigen, geldige entiteit
   kan het met andermans id niet.

   TWEE GATEN GEVONDEN EN GEDICHT (18 oktober 2026):
     - /api/concern/feit/beeindig controleerde dat de entiteit van de aanvrager
       was, maar niet dat het FEIT bij die entiteit hoorde. Met een eigen
       entiteit en andermans feit-id beeindigde je diens bestuurder.
     - /api/concern/kwalificatie/zet controleerde niet dat de PERSOON bij die
       entiteit werkte (de leesroute /kwalificaties deed dat wel). Een
       kwalificatie is de werkelijke toegang van een mens; met een eigen
       entiteit zette je er een op iemand die nergens bij jou werkt.
   Beide toetsen zakten op de oude code en staan groen op de reparatie.

   Draai los: node --test test/concern-routes.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-concernroutes-'));
const AKTE = `
  UITTREKSEL HANDELSREGISTER
  Kamer van Koophandel nummer 87654321
  Rechtsvorm: Besloten vennootschap
  Statutair gevestigd te Amsterdam
  BTW-nummer NL001234567B01
`;
const dag = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const BRON = { bronSoort: 'register', bronDetail: 'KvK' };

let srv, base, A, B, a1, a2, b1;
const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
let n = 0;
async function lid() {
  const r = await api('/api/auth/register', { name: 'Concern ' + n, email: 'concern' + Date.now() + (n++) + '@x.nl',
    password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body.token, JSON.stringify(r.body).slice(0, 160));
  return r.body.token;
}
async function entiteit(tok, naam) {
  const r = await api('/api/concern/entiteit/nieuw', { naam, land: 'NL', rechtsvorm: 'bv', van: '2026-01-01' }, tok);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  return r.body.entiteit.id;
}
async function inDienst(tok, ent, persoon, rol) {
  const r = await api('/api/concern/mens/nieuw', { entiteit: ent, persoon, rol, van: '2026-01-01' }, tok);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  return r.body.employment.id;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  A = await lid(); B = await lid();
  a1 = await entiteit(A, 'Noordzee Hotels BV');
  a2 = await entiteit(A, 'Noordzee Holding BV');
  b1 = await entiteit(B, 'Buurman BV');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('groep en boom: alleen in een eigen groep, en de boom van een ander bestaat niet', async () => {
  const c = await api('/api/concern/nieuw', { naam: 'Noordzee Groep' }, A);
  assert.equal(c.status, 200);
  const con = c.body.concern.id;
  assert.equal((await api('/api/concern/entiteit/groep', { entiteit: a1, concern: con }, A)).status, 200);
  assert.equal((await api('/api/concern/entiteit/groep', { entiteit: b1, concern: con }, B)).status, 404,
    'een ander hangt zijn entiteit niet in andermans groep');
  assert.equal((await api('/api/concern/entiteit/groep', { entiteit: a2, concern: con }, B)).status, 404,
    'en verhangt geen entiteit van een ander');

  const boom = await api('/api/concern/boom', { concern: con }, A);
  assert.equal(boom.status, 200);
  assert.deepEqual(boom.body.knopen.map(k => k.id), [a1], 'precies de entiteit die erin hangt');
  assert.equal(boom.body.aantal.entiteiten, 1);
  assert.equal((await api('/api/concern/boom', { concern: con }, B)).status, 404, 'de boom van een ander bestaat niet');
});

test('onderneming en discovery: wie de onderneming niet bezit, koppelt of leest hem niet', async () => {
  assert.equal((await api('/api/concern/entiteit/onderneming', { entiteit: a1 }, A)).status, 400, 'zonder onderneming geen koppeling');
  const vreemd = await api('/api/concern/entiteit/onderneming', { entiteit: a1, onderneming: 'ond_bestaatniet' }, A);
  assert.ok(vreemd.status === 403 || vreemd.status === 404, 'een onderneming die niet van u is koppelt u niet, kreeg ' + vreemd.status);
  assert.equal((await api('/api/concern/entiteit/onderneming', { entiteit: a1, onderneming: 'ond_x' }, B)).status, 404,
    'en andermans entiteit bestaat niet voor u');
  assert.equal((await api('/api/concern/discovery', { onderneming: 'ond_bestaatniet' }, A)).status, 404);
});

test('een feit beeindigen: met bron, op de eigen entiteit, en nooit andermans feit', async () => {
  const f = await api('/api/concern/feit/zet', Object.assign({ entiteit: a1, soort: 'bestuurder', waarde: 'directeur',
    sleutel: 'marco', extern: true, van: '2026-01-01' }, BRON), A);
  assert.equal(f.status, 200, JSON.stringify(f.body).slice(0, 160));
  const feit = f.body.feit.id;

  const kaper = await api('/api/concern/feit/beeindig', Object.assign({ entiteit: b1, feit, tot: dag(1) }, BRON), B);
  assert.equal(kaper.status, 404, 'met een eigen entiteit beeindig je andermans feit niet');
  assert.equal((await api('/api/concern/geschiedenis', { entiteit: a1, soort: 'bestuurder' }, A)).body.geschiedenis[0].loopt, true,
    'en de bestuurder loopt gewoon door');

  assert.equal((await api('/api/concern/feit/beeindig', { entiteit: a1, feit, tot: dag(1) }, A)).status, 400, 'zonder bron niet');
  assert.equal((await api('/api/concern/feit/beeindig', Object.assign({ entiteit: a1, feit, tot: '2025-01-01' }, BRON), A)).status, 400,
    'niet voor de begindatum');
  const ok = await api('/api/concern/feit/beeindig', Object.assign({ entiteit: a1, feit, tot: dag(1) }, BRON), A);
  assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 160));
  assert.equal(ok.body.feit.tot, dag(1));
  assert.equal(ok.body.feit.loopt, false);
});

test('verloopt: een vergunning die binnenkort afloopt, met wat ze raakt', async () => {
  const v = await api('/api/concern/feit/zet', Object.assign({ entiteit: a1, soort: 'vergunning', waarde: 'drank- en horeca',
    sleutel: 'dhw', van: '2026-01-01', tot: dag(20) }, BRON), A);
  assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 160));
  const r = await api('/api/concern/verloopt', { entiteit: a1, dagen: 60 }, A);
  assert.equal(r.status, 200);
  assert.ok(r.body.verloopt.length > 0, 'de vergunning staat erin');
  assert.equal(r.body.verloopt[0].feit.soort, 'vergunning');
  assert.equal((await api('/api/concern/verloopt', { entiteit: a1, dagen: 10 }, A)).body.verloopt.length, 0,
    'binnen tien dagen loopt er niets af');
  assert.equal((await api('/api/concern/verloopt', { entiteit: a1 }, B)).status, 404);
});

test('functiescheiding, mens/zet en kwalificaties: op de eigen mensen, en op niemand anders', async () => {
  const emp = await inDienst(A, a1, 'lid_jan', 'directie');
  const fs1 = await api('/api/concern/functiescheiding', { entiteit: a1 }, A);
  assert.equal(fs1.status, 200);
  assert.ok(fs1.body.conflicten.length > 0, 'directie combineert rechten die elkaar bijten');
  assert.ok(fs1.body.conflicten.every(c => c.persoon === 'lid_jan'));
  assert.equal((await api('/api/concern/functiescheiding', { entiteit: a1 }, B)).status, 404);

  assert.equal((await api('/api/concern/mens/zet', { employment: emp, rol: 'medewerker' }, B)).status, 404,
    'een ander wijzigt dit dienstverband niet');
  const zet = await api('/api/concern/mens/zet', { employment: emp, rol: 'medewerker', afdeling: 'Receptie' }, A);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.employment.rol, 'medewerker');
  assert.equal((await api('/api/concern/functiescheiding', { entiteit: a1 }, A)).body.conflicten.length, 0,
    'met de nieuwe rol is er geen conflict meer');

  // kwalificaties: de werkgever zet ze op zijn eigen mensen
  const k = await api('/api/concern/kwalificatie/zet', { entiteit: a1, persoon: 'lid_jan', wat: 'bhv', tot: dag(300) }, A);
  assert.equal(k.status, 200, JSON.stringify(k.body).slice(0, 160));
  const lijst = await api('/api/concern/kwalificaties', { entiteit: a1, persoon: 'lid_jan' }, A);
  assert.ok(lijst.body.kwalificaties.some(x => x.wat === 'bhv'), 'de kwalificatie staat erbij');
  assert.equal((await api('/api/concern/kwalificaties', { entiteit: a1, persoon: 'lid_niemand' }, A)).status, 404,
    'van iemand die hier niet werkt, leest u niets');

  const kaper = await api('/api/concern/kwalificatie/zet', { entiteit: b1, persoon: 'lid_jan', wat: 'kluissleutel', tot: dag(300) }, B);
  assert.equal(kaper.status, 404, 'een andere werkgever zet geen kwalificatie op iemand die niet bij hem werkt');
  assert.ok(!(await api('/api/concern/kwalificaties', { entiteit: a1, persoon: 'lid_jan' }, A)).body.kwalificaties
    .some(x => x.wat === 'kluissleutel'), 'en er staat er dan ook geen');
});

test('uit dienst: eerst het beeld, dan beeindigen, en alleen bij de eigen entiteit', async () => {
  await inDienst(A, a1, 'lid_eva', 'verkoop');
  const beeld = await api('/api/concern/uitdienst/beeld', { entiteit: a1, persoon: 'lid_eva' }, A);
  assert.equal(beeld.status, 200, JSON.stringify(beeld.body).slice(0, 160));
  assert.ok(beeld.body.werkrelaties.length > 0, 'het beeld noemt de werkrelatie');
  assert.ok(((await api('/api/concern/mensen', { entiteit: a1 }, A)).body.mensen).some(m => m.persoon === 'lid_eva'),
    'het beeld veranderde niets');
  assert.equal((await api('/api/concern/uitdienst/doe', { entiteit: a1, persoon: 'lid_eva' }, B)).status, 404);
  assert.equal((await api('/api/concern/uitdienst/beeld', { entiteit: b1, persoon: 'lid_eva' }, B)).status, 404,
    'bij een andere werkgever heeft zij geen werkrelatie');

  const doe = await api('/api/concern/uitdienst/doe', { entiteit: a1, persoon: 'lid_eva', per: dag(0) }, A);
  assert.equal(doe.status, 200, JSON.stringify(doe.body).slice(0, 160));
  assert.equal(doe.body.beeindigd, 1);
  const na = await api('/api/concern/mensen', { entiteit: a1, op: dag(2) }, A);
  assert.ok(!na.body.mensen.some(m => m.persoon === 'lid_eva'), 'na de einddatum werkt zij hier niet meer');
});

test('impact telt alleen eigen entiteiten; een momentopname zet de eigen structuur terug', async () => {
  const imp = await api('/api/concern/impact', { wat: 'Finance centraal', entiteiten: [a1, b1] }, A);
  assert.equal(imp.status, 200);
  assert.equal(imp.body.raakt.entiteiten, 1, 'de entiteit van een ander telt niet mee');
  assert.deepEqual(imp.body.perEntiteit.map(x => x.entiteit), [a1]);

  const opn = await api('/api/concern/opname/maak', { waarom: 'voor de verbouwing' }, A);
  assert.equal(opn.status, 200);
  const opnames = await api('/api/concern/opnames', {}, A);
  assert.ok(opnames.body.opnames.some(o => o.id === opn.body.opname.id), 'de opname staat in de lijst');
  assert.ok(!(await api('/api/concern/opnames', {}, B)).body.opnames.some(o => o.id === opn.body.opname.id), 'niet bij een ander');

  const v = await api('/api/concern/vestiging/nieuw', { entiteit: a1, naam: 'Tijdelijk' }, A);
  assert.equal(v.status, 200);
  assert.equal((await api('/api/concern/opname/herstel', { opname: opn.body.opname.id }, B)).status, 404, 'een ander herstelt niets');
  const h = await api('/api/concern/opname/herstel', { opname: opn.body.opname.id }, A);
  assert.equal(h.status, 200, JSON.stringify(h.body).slice(0, 160));
  const vest = await api('/api/concern/vestigingen', { entiteit: a1 }, A);
  assert.ok(!vest.body.vestigingen.some(x => x.naam === 'Tijdelijk'), 'de vestiging van na de opname is terug weg');
  assert.ok((await api('/api/concern/entiteit', { entiteit: b1 }, B)).status === 200, 'de entiteit van een ander bleef staan');
});

test('overname en fusie: alleen tussen eigen entiteiten, en eerst tonen dan doen', async () => {
  assert.equal((await api('/api/concern/overname', { entiteit: a1, kopers: [] }, A)).status, 400);
  assert.equal((await api('/api/concern/overname', { entiteit: a1, kopers: [{ wie: a2, percentage: 120 }] }, A)).status, 400,
    'meer dan 100% kan niet');
  assert.equal((await api('/api/concern/overname', { entiteit: a1, kopers: [{ wie: b1, percentage: 100 }] }, B)).status, 404);
  const o = await api('/api/concern/overname', { entiteit: a1, kopers: [{ wie: a2, percentage: 100 }], per: dag(0) }, A);
  assert.equal(o.status, 200, JSON.stringify(o.body).slice(0, 160));
  assert.ok(o.body.feiten.length > 0, 'de eigendom is als feit vastgelegd');
  assert.match(o.body.grens, /NIET automatisch/);

  await inDienst(A, a1, 'lid_piet', 'service');
  assert.equal((await api('/api/concern/fusie/beeld', { entiteit: a1, naar: b1 }, A)).status, 404,
    'een fusie in de entiteit van een ander bestaat niet');
  const fb = await api('/api/concern/fusie/beeld', { entiteit: a1, naar: a2 }, A);
  assert.equal(fb.status, 200);
  assert.ok(fb.body.verhuist.mensen >= 1);
  assert.ok(!(await api('/api/concern/mensen', { entiteit: a2 }, A)).body.mensen.some(m => m.persoon === 'lid_piet'),
    'het beeld verhuist nog niemand');
  assert.equal((await api('/api/concern/fusie/doe', { entiteit: a1, naar: a2 }, B)).status, 404);
  const fd = await api('/api/concern/fusie/doe', { entiteit: a1, naar: a2, per: dag(0) }, A);
  assert.equal(fd.status, 200, JSON.stringify(fd.body).slice(0, 160));
  assert.ok((await api('/api/concern/mensen', { entiteit: a2 }, A)).body.mensen.some(m => m.persoon === 'lid_piet'),
    'na de fusie werkt hij bij de blijvende entiteit');
});

test('document/lees: kandidaten met vindplaats, en er wordt niets vastgelegd', async () => {
  const voor = (await api('/api/concern/geschiedenis', { entiteit: a2 }, A)).body.geschiedenis.length;
  const r = await api('/api/concern/document/lees', { entiteit: a2, tekst: AKTE, bestand: 'uittreksel.pdf' }, A);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  const reg = r.body.voorstel.kandidaten.find(k => k.soort === 'registratie');
  assert.ok(reg, 'het KvK-nummer is herkend');
  assert.equal(reg.waarde, '87654321');
  assert.ok(reg.vindplaats, 'met de plek waar het staat');
  assert.equal((await api('/api/concern/geschiedenis', { entiteit: a2 }, A)).body.geschiedenis.length, voor,
    'lezen legt niets vast');
  assert.equal((await api('/api/concern/document/lees', { entiteit: a2, tekst: 'te kort' }, A)).status, 400);
  assert.equal((await api('/api/concern/document/lees', { entiteit: a2, tekst: AKTE }, B)).status, 404);
});
