/* Ronde: het Ondernemers-OS -- de drie assen van één bedrijfsobject.

   1. De RECHTSVORM-as: wat een zaak juridisch IS bepaalt ander gereedschap dan
      wat zij DOET, en een verbod van de rechtsvorm wint van elke andere as.
   2. De FASE-as: afgeleid uit feiten, nooit gezet, en zonder feiten geen
      oordeel (lat-regel 3: 'idee' is een geldige uitkomst en mag dus nooit
      het antwoord zijn op ontbrekende invoer).
   3. De naad tussen "aanmelding" en "supplier": één onderneming die de zaak
      AANWIJST, met de naam op precies één plek (lat-regel 4).
   4. De eigendomspoort op de routes.

   Draai los: node --experimental-sqlite --test test/onderneming.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, elevateTier } = require('./helper');

const RV = require('../server/kern/onderneming/rechtsvorm');
const FASE = require('../server/kern/onderneming/fase');
const maakOnderneming = require('../server/kern/onderneming');

/* ---------------- 1. de rechtsvorm-as, puur ---------------- */

test('de rechtsvorm bepaalt ander gereedschap dan de werkvorm', () => {
  const zzp = RV.capsVanRechtsvorm('eenmanszaak');
  const bv = RV.capsVanRechtsvorm('bv');
  assert.ok(zzp.includes('urencriterium') && zzp.includes('startersaftrek'),
    'de eenmanszaak heeft de ondernemersaftrekken uit de inkomstenbelasting');
  assert.ok(bv.includes('vpb') && bv.includes('dga-loon') && bv.includes('aandeelhouders'),
    'de B.V. heeft vennootschapsbelasting, DGA-loon en aandeelhouders');
  assert.ok(!bv.includes('urencriterium'), 'een B.V. kent geen urencriterium');
  assert.ok(!zzp.includes('vpb'), 'een eenmanszaak betaalt geen vennootschapsbelasting');
});

test('de holding erft de caps van de B.V., zodat een nieuwe bv-plicht er niet buiten valt', () => {
  const bv = RV.capsVanRechtsvorm('bv');
  const holding = RV.capsVanRechtsvorm('holding');
  for (const c of bv) assert.ok(holding.includes(c), 'de holding mist bv-cap ' + c);
  assert.ok(holding.includes('consolidatie') && holding.includes('intercompany'),
    'en heeft daarbovenop haar eigen groepsgereedschap');
});

/* DE GRENDEL. Dit is de reden dat `verboden` apart bestaat en niet gewoon
   "ontbreekt in caps": een andere as brengt de knop wél mee. */
test('een verbod van de rechtsvorm wint van een as die de knop wél meebrengt', () => {
  const anderAs = ['winstuitkering', 'aandelen', 'kassa'];
  const uit = RV.capsSamen(
    [anderAs, RV.capsVanRechtsvorm('stichting')],
    RV.verbodenVanRechtsvorm('stichting')
  );
  assert.ok(!uit.caps.includes('winstuitkering'),
    'een stichting mag geen winst uitkeren, ook niet als een andere as die knop aandraagt');
  assert.ok(!uit.caps.includes('aandelen'), 'en heeft geen aandelen');
  assert.ok(uit.caps.includes('kassa'), 'wat niet verboden is blijft gewoon staan');
  assert.deepEqual(uit.geweerd, ['aandelen', 'winstuitkering'],
    'en het antwoord zegt WAT er is weggehouden, zodat een scherm het kan uitleggen');
});

test('een B.V. krijgt de ondernemersaftrek niet, ook niet als die van elders komt', () => {
  const uit = RV.capsSamen([['startersaftrek', 'urencriterium']], RV.verbodenVanRechtsvorm('bv'));
  assert.deepEqual(uit.caps, [], 'allebei geweerd');
  assert.deepEqual(uit.geweerd, ['startersaftrek', 'urencriterium']);
});

test('een onbekende rechtsvorm is null en wordt geen eenmanszaak', () => {
  assert.equal(RV.rechtsvormVan('nv-tje'), null);
  assert.equal(RV.rechtsvormVan(null), null, '"weet ik nog niet" krijgt geen standaardwaarde aangemeten');
  assert.deepEqual(RV.capsVanRechtsvorm(null), [], 'en dus ook geen caps van een vorm die niemand koos');
});

/* ---------------- 2. de fase-as, puur ---------------- */

const feiten = (o) => Object.assign(
  { plan: false, ingeschreven: false, klanten: 0, personeel: 0, vestigingen: 0, entiteiten: 1 }, o);

test('zonder feiten geen fase -- en zeker niet stilzwijgend "idee"', () => {
  assert.equal(FASE.faseVan(null), null, 'lat-regel 3: een meter zonder invoer zakt');
  assert.equal(FASE.faseBeeld(null), null);
  assert.equal(FASE.ontgrendeld(undefined), null);
  // en de tegenproef: mét feiten geeft hij wél 'idee', dus null is echt de storing
  assert.equal(FASE.faseVan(feiten()), 'idee');
});

test('de fase is de hoogste bereikte, niet de eerste die zakt', () => {
  // ingeschreven bij de KvK, maar het plan is nooit vastgelegd
  const f = feiten({ ingeschreven: true });
  assert.equal(FASE.faseVan(f), 'oprichting',
    'wie eerst inschrijft en pas daarna zijn plan opschrijft, blijft niet op idee hangen');
  const ladder = FASE.faseBeeld(f).ladder;
  assert.equal(ladder.find(x => x.id === 'validatie').bereikt, false,
    'en de overgeslagen stap staat gewoon als niet-bereikt op de ladder');
});

test('de fase volgt de feiten en wordt nergens gezet', () => {
  const f = feiten({ ingeschreven: true });
  assert.equal(FASE.faseVan(f), 'oprichting');
  f.klanten = 1;
  assert.equal(FASE.faseVan(f), 'eersteklant', 'één klant verschuift de fase');
  f.klanten = 10;
  assert.equal(FASE.faseVan(f), 'tractie');
  f.personeel = 2;
  assert.equal(FASE.faseVan(f), 'werkgever');
  f.entiteiten = 2;
  assert.equal(FASE.faseVan(f), 'groep');
});

test('elke bereikte fase blijft tonen wat zij ontgrendelde', () => {
  // personeel maar nog geen tien klanten: payroll hoort er te staan, crm niet
  const f = feiten({ ingeschreven: true, klanten: 2, personeel: 3 });
  const uit = FASE.ontgrendeld(f);
  assert.ok(uit.includes('payroll'), 'wie personeel heeft krijgt de loonrun');
  assert.ok(uit.includes('facturen'), 'en houdt wat de eerste klant ontgrendelde');
  assert.ok(!uit.includes('crm'), 'maar tractie is nog niet bereikt');
  assert.ok(!uit.includes('consolidatie'), 'en een groep is hij zeker niet');
});

test('de volgende mijlpaal is de laagste die nog ontbreekt', () => {
  const v = FASE.volgende(feiten({ ingeschreven: true }));
  assert.equal(v.id, 'validatie', 'het plan is overgeslagen en staat dus als eerstvolgende');
  assert.equal(FASE.volgende(feiten({
    plan: true, ingeschreven: true, klanten: 10, personeel: 1, vestigingen: 2, entiteiten: 2 })), null,
    'wie alles heeft gehaald heeft geen volgende meer');
});

test('elke fase leunt alleen op feiten die ook echt gevuld worden', () => {
  /* Een fase die op een onbekend veld leunt wordt nooit bereikt en niets zegt
     er iets van. Deze toets is de handhaver van die belofte in de kop van
     fase.js. */
  const alles = feiten({ plan: true, ingeschreven: true, klanten: 99, personeel: 9, vestigingen: 9, entiteiten: 9 });
  for (const f of FASE.FASEN) {
    assert.equal(f.bereikt(alles), true, 'fase ' + f.id + ' wordt op volle feiten niet bereikt -- leunt hij op een veld buiten FEITEN?');
  }
  const leeg = feiten();
  const bereiktLeeg = FASE.FASEN.filter(f => f.bereikt(leeg)).map(f => f.id);
  assert.deepEqual(bereiktLeeg, ['idee'], 'op lege feiten is alleen het idee bereikt');
});

/* ---------------- 3. het ondernemingsobject: de naad ---------------- */

function stubKern(zaken) {
  const data = { ondernemingen: [], suppliers: zaken, supplierTypes: {
    zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] } }, thuisHuizen: {} };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  return maakOnderneming({
    db, save: () => {},
    crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    findSupplier: (code) => zaken.find(z => z.code === code) || null,
    ordersVanZaak: () => [],
    boekingenVanZaak: (code) => (zaken.find(z => z.code === code) || {}).boekingen || []
  });
}

test('een onderneming bestaat vanaf "ik denk erover na", zonder zaak en zonder rechtsvorm', () => {
  const K = stubKern([]);
  const r = K.ondernemingNieuw('LID1', { naam: 'Iets met glazen wassen' });
  assert.ok(r.ok, 'aanmaken lukt zonder rechtsvorm en zonder zaak');
  assert.equal(r.onderneming.fase, 'idee');
  assert.equal(r.onderneming.rechtsvorm, null, 'hij krijgt geen vorm aangemeten die niemand koos');
  assert.equal(r.onderneming.zaak, null);
  assert.deepEqual(r.onderneming.werkvormen, [], 'zonder zaak DOET zij nog niets');
});

test('koppelen dicht de naad: de naam woont daarna op precies één plek', () => {
  const zaak = { code: 'GLAS', name: 'Jansen Glasheldere Ramen', type: 'zzp', staff: [{ id: 1 }] };
  const K = stubKern([zaak]);
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Werktitel' }).onderneming.id);
  assert.equal(K.ondernemingNaam(o), 'Werktitel', 'zolang er geen zaak is, is de onderneming de enige naam');

  const k = K.ondernemingKoppel(o, 'GLAS');
  assert.ok(k.ok);
  assert.equal(k.onderneming.naam, 'Jansen Glasheldere Ramen', 'na koppelen wint de zaak');
  assert.equal(o.naam, undefined, 'en de lokale naam is echt weg, niet stil blijven staan');

  // de mutatie die bewijst dat het doorlezen is en geen kopie
  zaak.name = 'Jansen Glas B.V.';
  assert.equal(K.ondernemingNaam(o), 'Jansen Glas B.V.',
    'de zaak hernoemen verandert de onderneming mee -- er is maar één naam');
});

test('een zaak hoort bij precies één onderneming', () => {
  const zaak = { code: 'GLAS', name: 'Glas', type: 'zzp', staff: [{ id: 1 }] };
  const K = stubKern([zaak]);
  const a = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'A' }).onderneming.id);
  const b = K.ondernemingVind(K.ondernemingNieuw('LID2', { naam: 'B' }).onderneming.id);
  assert.ok(K.ondernemingKoppel(a, 'GLAS').ok);
  assert.equal(K.ondernemingKoppel(a, 'GLAS').ok, true, 'nogmaals koppelen aan dezelfde zaak is een no-op');
  assert.equal(K.ondernemingKoppel(b, 'GLAS').status, 409, 'maar een tweede onderneming op dezelfde zaak niet');
  assert.equal(K.ondernemingKoppel(a, 'BESTAATNIET').status, 404);
});

test('de drie assen komen samen in één capslijst, met het verbod erover', () => {
  const zaak = { code: 'GLAS', name: 'Glas', type: 'zzp', staff: [{ id: 1 }],
    fleet: [{ id: 'A' }] }; // een busje: de vervoers-werkvorm komt erbij
  const K = stubKern([zaak]);
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'A' }).onderneming.id);
  K.ondernemingKoppel(o, 'GLAS');
  K.ondernemingRechtsvorm(o, 'bv');
  const beeld = K.ondernemingBeeld(o);
  assert.ok(beeld.caps.includes('rides'), 'de werkvorm-as levert de rittools (er staat een busje)');
  assert.ok(beeld.caps.includes('vpb'), 'de rechtsvorm-as levert de vennootschapsbelasting');
  assert.ok(beeld.caps.includes('intake'), 'de fase-as levert wat bij deze fase hoort');
  assert.ok(!beeld.caps.includes('startersaftrek'), 'en de B.V. weert de ondernemersaftrek');

  // mutatie: dezelfde zaak als eenmanszaak draait dat om
  K.ondernemingRechtsvorm(o, 'eenmanszaak');
  const zzp = K.ondernemingBeeld(o);
  assert.ok(zzp.caps.includes('startersaftrek'), 'als eenmanszaak staat de startersaftrek er wél');
  assert.ok(!zzp.caps.includes('vpb'), 'en de vennootschapsbelasting niet meer');
  assert.ok(zzp.caps.includes('rides'), 'terwijl het busje er nog steeds staat -- de assen staan los');
});

test('de fase van een echte onderneming telt klanten op codenaam', () => {
  const zaak = { code: 'GLAS', name: 'Glas', type: 'zzp', staff: [{ id: 1 }], boekingen: [] };
  const K = stubKern([zaak]);
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'A' }).onderneming.id);
  K.ondernemingKoppel(o, 'GLAS');
  K.ondernemingIngeschreven(o, '12345678');
  assert.equal(K.ondernemingBeeld(o).fase, 'oprichting');

  // twee boekingen van DEZELFDE klant is één klant
  zaak.boekingen = [{ customerCodename: 'Reiger', status: 'bevestigd' },
    { customerCodename: 'Reiger', status: 'bevestigd' }];
  assert.equal(K.ondernemingFeiten(o).klanten, 1, 'dezelfde codenaam telt één keer');
  assert.equal(K.ondernemingBeeld(o).fase, 'eersteklant');

  // een boeking die nog op betaling wacht is nog geen klant
  zaak.boekingen.push({ customerCodename: 'Wilg', status: 'wacht-op-betaling' });
  assert.equal(K.ondernemingFeiten(o).klanten, 1, 'wachten op betaling is nog geen klant');
  zaak.boekingen.push({ customerCodename: 'Wilg', status: 'bevestigd' });
  assert.equal(K.ondernemingFeiten(o).klanten, 2);
});

test('de eigenaar telt niet als personeel', () => {
  const zaak = { code: 'GLAS', name: 'Glas', type: 'zzp', staff: [{ id: 1 }] };
  const K = stubKern([zaak]);
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'A' }).onderneming.id);
  K.ondernemingKoppel(o, 'GLAS');
  assert.equal(K.ondernemingFeiten(o).personeel, 0, 'in zijn eentje is hij geen werkgever');
  zaak.staff.push({ id: 2 });
  assert.equal(K.ondernemingFeiten(o).personeel, 1, 'de eerste medewerker naast de eigenaar telt');
});

test('feiten van een onderneming die niet bestaat zijn null, niet leeg', () => {
  const K = stubKern([]);
  assert.equal(K.ondernemingFeiten(null), null);
  assert.equal(K.ondernemingBeeld(null), null);
});

/* ---------------- 4. de routes: de eigendomspoort ---------------- */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-onderneming-'));
let BASE, child;
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
});
const json = r => r.json();

async function lid(naam, email) {
  const d = await json(await post('/api/auth/register', {
    name: naam, email, phone: '0612345678', password: 'geheim123',
    geboortedatum: '1990-01-01', tier: 'rtg'
  }));
  assert.ok(d.token, 'registratie geeft een sessietoken');
  return d.token;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een gewoon RTG-lid mag een onderneming beginnen -- geen paslaag voor nadenken', async () => {
  const tok = await lid('Aisha', 'aisha.ond@example.com');
  const r = await json(await post('/api/onderneming/nieuw', { naam: 'Misschien een fietsenmaker' }, tok));
  assert.ok(r.ok, 'een RTG-pas is genoeg: ' + JSON.stringify(r));
  assert.equal(r.onderneming.fase, 'idee');
  const mijn = await json(await post('/api/onderneming/mijn', {}, tok));
  assert.equal(mijn.ondernemingen.length, 1);
});

test('zonder inlog kom je er niet in, met de rechtsvormen als tegenproef', async () => {
  const dicht = await post('/api/onderneming/mijn', {});
  assert.equal(dicht.status, 401, 'de eigen ondernemingen zitten achter de inlog');
  // en de tegenproef: de voorlichting staat wél open, dus 401 is een besluit
  const open = await fetch(BASE + '/api/onderneming/rechtsvormen');
  assert.equal(open.status, 200);
  const lijst = (await open.json()).rechtsvormen.map(r => r.id);
  for (const v of ['eenmanszaak', 'bv', 'stichting']) assert.ok(lijst.includes(v), v + ' hoort in de keuzelijst');
});

test('de onderneming van een ander is niet te lezen en niet te wijzigen', async () => {
  const a = await lid('Bram', 'bram.ond@example.com');
  const b = await lid('Chloe', 'chloe.ond@example.com');
  const mijne = (await json(await post('/api/onderneming/nieuw', { naam: 'Bram Bouwt' }, a))).onderneming;

  const eigen = await post('/api/onderneming/beeld', { id: mijne.id }, a);
  assert.equal(eigen.status, 200, 'de eigenaar komt er wél bij -- anders bewijst de 404 hieronder niets');

  for (const pad of ['/api/onderneming/beeld', '/api/onderneming/rechtsvorm',
    '/api/onderneming/koppel', '/api/onderneming/ingeschreven']) {
    const r = await post(pad, { id: mijne.id, rechtsvorm: 'bv', code: 'X', kvk: '999' }, b);
    assert.equal(r.status, 404, pad + ' laat een vreemde erbij');
  }
  const na = await json(await post('/api/onderneming/beeld', { id: mijne.id }, a));
  assert.equal(na.onderneming.rechtsvorm, null, 'en er is niets van gewijzigd');
});

test('de rechtsvorm zetten mag, verzinnen niet', async () => {
  const tok = await lid('Daan', 'daan.ond@example.com');
  const o = (await json(await post('/api/onderneming/nieuw', { naam: 'Daan Doet' }, tok))).onderneming;
  const fout = await post('/api/onderneming/rechtsvorm', { id: o.id, rechtsvorm: 'nv-tje' }, tok);
  assert.equal(fout.status, 400);
  const goed = await json(await post('/api/onderneming/rechtsvorm', { id: o.id, rechtsvorm: 'stichting' }, tok));
  assert.equal(goed.onderneming.rechtsvorm.id, 'stichting');
  assert.ok(goed.onderneming.rechtsvorm.notarieel, 'een stichting gaat langs de notaris');
  assert.ok(goed.onderneming.caps.includes('anbi'));
  assert.ok(!goed.onderneming.caps.includes('winstuitkering'), 'en keert geen winst uit');
});
