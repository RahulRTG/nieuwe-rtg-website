/* Ronde: de toegang -- wie kan wat, over de twee werelden die er al zijn.

   Vijf beweringen:

   1. ER KOMT GEEN DERDE RECHTENMODEL BIJ. De zaak kent manager/staff, de
      werkruimte kent achttien rechten en veertien rollen. Deze laag leest ze
      allebei; een derde model zou een derde waarheid zijn over dezelfde vraag.
   2. ER WORDT NIETS GEZET. Geen enkele functie verleent of ontneemt toegang.
      Een tweede deur naar hetzelfde slot is een deur die niemand bewaakt.
   3. HET VENSTER IS PRECIES DAT VAN DE POORT. Een verlopen rol telt niet mee,
      een rol die nog moet ingaan ook niet -- anders zegt dit scherm iets anders
      dan de poort die de toegang echt bewaakt.
   4. HET GAT WORDT BENOEMD EN NIET GEDICHT. Op de zaak kan een beheerder alles;
      dat staat er, want een scherm dat nuance suggereert geeft schijnzekerheid.
   5. HIER STAAN GEEN NAMEN.

   Draai los: node --experimental-sqlite --test test/onderneming-toegang.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakOnderneming = require('../server/kern/onderneming');
const TGN = require('../server/kern/onderneming/toegang');
const ROL = require('../server/bedrijf/rollen');

const NU = Date.parse('2026-06-15T10:00:00Z');
const dag = (n) => new Date(NU + n * 86400000).toISOString().slice(0, 10);

function stubKern(opties) {
  const o = opties || {};
  const zaak = { code: 'ZAAK', name: 'Zaak', type: 'zzp', city: 'Haarlem', staff: [{ id: 1 }],
    online: true, salon: { bio: 'Wij doen werk.', foto: 'f.jpg' },
    rondleiding: { kassa: 'j', werk: 'j' }, services: [{ id: 's', name: 'K', price: 100 }],
    boekingen: [], orders: [] };
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], vakOffertes: [], facturen: [],
    werkruimtes: o.werkruimte ? { ZAAK: o.werkruimte } : {}, vacatures: {}, applications: {},
    thuisHuizen: {}, supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services'] } } };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  const K = maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (c) => (c === 'ZAAK' ? zaak : null),
    ordersVanZaak: () => [], boekingenVanZaak: () => [],
    aanmeldingen: { aanvraag: () => ({ ok: true }), een: () => ({ status: 404 }) },
    staffLijst: () => o.staff || []
  });
  K._data = data;
  return K;
}

function ond(K, koppel) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  if (koppel !== false) K.ondernemingKoppel(o, 'ZAAK');
  return o;
}
const zaakDeel = (t) => t.delen.find(d => d.soort === 'zaak');
const ruimteDeel = (t) => t.delen.find(d => d.soort === 'werkruimte');

const lid = (rollen, over) => Object.assign({ id: 'L' + Math.random().toString(16).slice(2, 6),
  naam: 'Iemand', rollen, actief: true }, over || {});

/* ---------------- geen derde model, en niets zetten ---------------- */

test('de twee bestaande modellen worden gelezen, niet nagebouwd', () => {
  const K = stubKern({
    staff: [{ role: 'manager', active: 1 }, { role: 'staff', active: 1 }],
    werkruimte: { code: 'ZAAK', leden: { a: lid([{ id: 'hr' }]) } }
  });
  const t = K.ondernemingToegang(ond(K), NU);
  assert.equal(t.stand, 'bestaat');
  assert.equal(t.delen.length, 2);
  assert.equal(zaakDeel(t).rollen.length, 2, 'de zaak kent er precies twee');
  assert.equal(ruimteDeel(t).rollen[0].id, 'hr');
  assert.equal(ruimteDeel(t).rollen[0].rechten, ROL.ROLLEN.find(r => r.id === 'hr').rechten.length,
    'het aantal rechten komt uit de werkruimte-laag en is hier niet overgetypt');
  assert.deepEqual(t.delen.find(d => d.soort === 'werkruimte').redenNodig, ROL.REDEN_NODIG);
});

test('er wordt niets geschreven en er is geen route die toegang verleent', () => {
  const K = stubKern({ staff: [{ role: 'manager', active: 1 }] });
  const o = ond(K);
  const voor = JSON.stringify(K._data);
  K.ondernemingToegang(o, NU);
  assert.equal(JSON.stringify(K._data), voor);

  const bron = require('fs').readFileSync('server/kern/onderneming/toegang.js', 'utf8');
  assert.ok(!/\bsave\s*\(/.test(bron), 'geen schrijfactie in de laag');
  const route = require('fs').readFileSync('server/routes/member/onderneming-bestuur.js', 'utf8');
  assert.ok(!/toegang\/(zet|geef|weg)/.test(route),
    'een tweede deur naar hetzelfde slot is een deur die niemand bewaakt');
  assert.ok(!Object.keys(K).some(k => /^ondernemingToegang(Zet|Geef|Weg)/.test(k)));
});

test('zonder zaak kan er niemand bij, en dat is iets anders dan niemand', () => {
  const K = stubKern({});
  const t = K.ondernemingToegang(ond(K, false), NU);
  assert.equal(t.stand, 'geen-zaak');
  assert.equal(t.delen, undefined, 'geen lege lijsten die op een leeg team lijken');
});

/* ---------------- de zaak-kant ---------------- */

test('de zaak telt beheerders en medewerkers, en zegt wat een beheerder kan', () => {
  const K = stubKern({ staff: [
    { role: 'manager', active: 1, member_id: 7 }, { role: 'manager', active: 1 },
    { role: 'staff', active: 1 }, { role: 'staff', active: 0 }
  ] });
  const z = zaakDeel(K.ondernemingToegang(ond(K), NU));
  assert.equal(z.totaal, 3, 'wie niet actief is telt niet mee');
  assert.equal(z.managers, 2);
  assert.equal(z.medewerkers, 1);
  assert.equal(z.gekoppeld, 1, 'aan een RTG-account');
  assert.ok(z.let.includes('een beheerder kan dus alles'),
    'het gat wordt benoemd en niet gedicht');
});

test('zonder werkruimte staat er waarom dat uitmaakt', () => {
  const K = stubKern({ staff: [{ role: 'manager', active: 1 }] });
  const t = K.ondernemingToegang(ond(K), NU);
  assert.equal(t.werkruimte, false);
  assert.ok(t.werkruimteUitleg.includes('fijnmazige rechten'));
  assert.ok(t.geenTweedeDeur.includes('eigen journaal'));
});

/* ---------------- het venster ---------------- */

test('een verlopen rol telt niet mee en wordt apart genoemd', () => {
  const K = stubKern({ werkruimte: { code: 'ZAAK', leden: {
    a: lid([{ id: 'auditor', tot: dag(-1) }]),
    b: lid([{ id: 'financieel' }])
  } } });
  const w = ruimteDeel(K.ondernemingToegang(ond(K), NU));
  assert.equal(w.verlopen, 1);
  assert.deepEqual(w.rollen.map(r => r.id), ['financieel'],
    'een tijdelijk recht dat je zelf moet intrekken, is een permanent recht');
});

test('een rol die nog moet ingaan telt ook niet mee', () => {
  const K = stubKern({ werkruimte: { code: 'ZAAK', leden: {
    a: lid([{ id: 'jurist', van: dag(5) }])
  } } });
  const w = ruimteDeel(K.ondernemingToegang(ond(K), NU));
  assert.equal(w.nogNiet, 1);
  assert.deepEqual(w.rollen, [], 'anders zegt dit scherm iets anders dan de poort');
});

test('een rol die vandaag afloopt geldt vandaag nog', () => {
  const K = stubKern({ werkruimte: { code: 'ZAAK', leden: {
    a: lid([{ id: 'auditor', tot: dag(0) }])
  } } });
  const w = ruimteDeel(K.ondernemingToegang(ond(K), NU));
  assert.equal(w.verlopen, 0);
  assert.equal(w.tijdelijk, 1);
  assert.equal(w.rollen[0].alleenLezen, true, 'en de auditor leest alleen');
});

/* ---------------- de opvolging ---------------- */

test('veel beheerders is een seintje, weinig niet', () => {
  const weinig = stubKern({ staff: [{ role: 'manager', active: 1 }, { role: 'manager', active: 1 }] });
  assert.deepEqual(TGN.toegangOpvolging(weinig.ondernemingToegang(ond(weinig), NU)), [],
    'bij twee mensen zegt een percentage niets');

  const veel = stubKern({ staff: [{ role: 'manager', active: 1 }, { role: 'manager', active: 1 },
    { role: 'manager', active: 1 }] });
  const v = TGN.toegangOpvolging(veel.ondernemingToegang(ond(veel), NU));
  assert.equal(v[0].id, 'veel-beheerders');
  assert.ok(v[0].waarom.includes('geen tussenrol'));
});

test('verlopen rollen worden gemeld als seintje en niet als openstaand werk', () => {
  const K = stubKern({ staff: [], werkruimte: { code: 'ZAAK', leden: {
    a: lid([{ id: 'auditor', tot: dag(-3) }])
  } } });
  const v = TGN.toegangOpvolging(K.ondernemingToegang(ond(K), NU));
  const r = v.find(x => x.id === 'verlopen-rollen');
  assert.ok(r.waarom.includes('gaat vanzelf'));
  assert.ok(r.waarom.includes('niet dat er iets openstaat'));
});

/* ---------------- geen namen ---------------- */

test('er komt geen enkele naam in het antwoord', () => {
  const K = stubKern({
    staff: [{ role: 'manager', active: 1, name: 'Jan Jansen', pin_hash: 'geheim' }],
    werkruimte: { code: 'ZAAK', leden: { a: lid([{ id: 'hr' }], { naam: 'Petra de Vries' }) } }
  });
  const tekst = JSON.stringify(K.ondernemingToegang(ond(K), NU));
  assert.ok(!tekst.includes('Jan Jansen'));
  assert.ok(!tekst.includes('Petra'));
  assert.ok(!tekst.includes('geheim'));
});

/* ---------------- het dagbeeld ---------------- */

test('het dagbeeld draagt de toegang', () => {
  const K = stubKern({ staff: [{ role: 'manager', active: 1 }] });
  const d = K.ondernemingDagbeeld(ond(K), NU);
  assert.ok(d.toegang, 'de toegang hangt in het dagbeeld');
  assert.equal(d.toegang.stand, 'bestaat');
});
