'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakOnboarding } = require('../server/kern/onboarding');
const sess = { key: 'rtf:gezin:ouder', tier: 'rtf', account: null };
function motor(data = {}) {
  const db = { data, writable: true };
  let saves = 0;
  const opties = { db, save: () => saves++, crypto, accounts: {}, schoon: (s, n) => String(s).trim().slice(0, n) };
  const onb = maakOnboarding(opties);
  return { db, onb, opties, saves: () => saves };
}
function ontvangst(p, versie) { return p.db.data.onboarding.profielen[sess.key].ondertekeningen.rtg[versie]; }

test('status, configuratie en ondertekenaars lezen lege opslag zonder initialisatie of save', () => {
  for (const lees of [p => p.onb.status('rtg', sess), p => p.onb.config('rtg'), p => p.onb.ondertekenaars('rtg')]) {
    const p = motor(), voor = JSON.stringify(p.db.data);
    const r = lees(p);
    assert.ok(r);
    assert.equal(JSON.stringify(p.db.data), voor, 'een leesverzoek maakt geen onbevestigde onboardingcollectie');
    assert.equal(p.saves(), 0, 'lezen verstopt ook geen schrijfactie');
  }
});

test('legacy-velden worden voor lezen geprojecteerd, niet zonder save gemigreerd', () => {
  const p = motor();
  const sc = p.onb.standaardScope();
  sc.velden.find(v => v.id === 'paspoort').label = 'Paspoort of ID-kaart';
  for (const v of sc.velden) delete v.moment;
  p.db.data.onboarding = { scopes: { rtg: sc }, profielen: {} };
  const voor = JSON.stringify(p.db.data);
  const st = p.onb.status('rtg', { ...sess, tier: 'lifestyle' });
  assert.equal(st.velden.find(v => v.id === 'paspoort').label, 'Voorkant van je paspoort');
  assert.ok(st.laterVelden.some(v => v.id === 'adres'));
  assert.equal(p.onb.config('rtg').velden.find(v => v.id === 'adres').moment, 'later');
  assert.deepEqual(p.onb.ondertekenaars('rtg'), []);
  assert.equal(JSON.stringify(p.db.data), voor, 'geen migratie, scope of profiel schrijven in het leesverzoek');
  assert.equal(p.saves(), 0);
  p.onb.slaOp('rtg', sess, { naam: 'Sam Ouder' });
  assert.ok(p.saves() > 0, 'de echte schrijfactie legt initialisatie en migratie wel vast');
  assert.equal(p.db.data.onboarding.scopes.rtg.velden.find(v => v.id === 'adres').moment, 'later');
});

test('de eerste ontvangst blijft bij exact dezelfde versie en naam, ook na herladen', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1790000000000 });
  const p = motor(), versie = p.onb.status('rtg', sess).contract.versie;
  const eerste = p.onb.teken('rtg', sess, 'Sam Ouder', true, versie);
  assert.equal(eerste.status, 200);
  const at = eerste.contract.ondertekendAt, saves = p.saves();
  t.mock.timers.tick(12000);
  const herhaald = p.onb.teken('rtg', sess, 'Sam Ouder', true, versie);
  assert.equal(herhaald.contract.ondertekendAt, at, 'retry mag de eerste ontvangsttijd niet vervangen');
  assert.equal(p.saves(), saves, 'identieke retry schrijft niets');
  const koud = motor(JSON.parse(JSON.stringify(p.db.data)));
  assert.equal(koud.onb.teken('rtg', sess, 'Sam Ouder', true, versie).contract.ondertekendAt, at);
  assert.equal(ontvangst(koud, versie).at, at);
});

test('een gewijzigde naam is een expliciet conflict en overschrijft geen akkoord', () => {
  const p = motor();
  p.onb.teken('rtg', sess, 'Sam Ouder', true, 1);
  const voor = JSON.stringify(p.db.data);
  const r = p.onb.teken('rtg', sess, 'Andere Naam', true, 1);
  assert.equal(r.status, 409);
  assert.equal(r.code, 'name_conflict');
  assert.equal(JSON.stringify(p.db.data), voor);
});

test('tekst en titel krijgen een nieuwe versie; iedere ontvangst behoudt de getoonde tekst', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1790000000000 });
  const p = motor(), origineel = p.onb.config('rtg').contract;
  p.onb.teken('rtg', sess, 'Sam Ouder', true, 1);
  const eerste = structuredClone(ontvangst(p, 1));
  p.onb.zetConfig('rtg', { contract: { tekst: 'Deze gewijzigde overeenkomst bevat nieuwe afspraken.' } });
  assert.equal(p.onb.status('rtg', sess).contract.ondertekend, false);
  assert.equal(p.onb.teken('rtg', sess, 'Sam Ouder', true, 1).status, 409);
  t.mock.timers.tick(1000);
  assert.equal(p.onb.teken('rtg', sess, 'Sam Ouder', true, 2).status, 200);
  assert.deepEqual(ontvangst(p, 1), eerste);
  assert.equal(ontvangst(p, 1).contract.tekst, origineel.tekst);
  assert.notEqual(ontvangst(p, 2).at, eerste.at);
  assert.equal(p.onb.zetConfig('rtg', { contract: { titel: 'Gewijzigde titel' } }).contract.versie, 3);
  assert.equal(p.onb.status('rtg', sess).contract.ondertekend, false);
  assert.equal(p.db.data.onboarding.scopes.rtg.contractVersies[1].tekst, origineel.tekst);
});

test('tekst wijzigen zonder nieuwe versie verleent geen geldig akkoord of nieuwe ontvangst', () => {
  const p = motor();
  p.onb.teken('rtg', sess, 'Sam Ouder', true, 1);
  const eerste = structuredClone(ontvangst(p, 1));
  p.db.data.onboarding.scopes.rtg.contract.tekst = 'Onrechtmatig onder hetzelfde versienummer vervangen.';
  assert.equal(p.onb.status('rtg', sess).contract.ondertekend, false);
  const r = p.onb.teken('rtg', sess, 'Sam Ouder', true, 1);
  assert.equal(r.status, 409); assert.equal(r.code, 'version_conflict');
  assert.deepEqual(ontvangst(p, 1), eerste);
});

test('legacy ontvangst behoudt eerste tijd en hash; ontbrekende oude tekst wordt niet verzonnen', () => {
  const p = motor(), contract = p.onb.config('rtg').contract;
  p.onb.store();
  const oud = { versie: 1, naam: 'Sam Ouder', at: '2026-01-01T00:00:00.000Z',
    hash: crypto.createHash('sha256').update('1|' + contract.tekst + '|Sam Ouder|' + sess.key).digest('hex') };
  p.db.data.onboarding.profielen[sess.key] = { velden: {}, ondertekend: { rtg: structuredClone(oud) } };
  assert.equal(p.onb.teken('rtg', sess, 'Sam Ouder', true).contract.ondertekendAt, oud.at, 'oude interne aanroep blijft synchroon werken');
  p.onb.zetConfig('rtg', { contract: { tekst: 'Een nieuwe overeenkomst met andere voorwaarden.' } });
  p.onb.teken('rtg', sess, 'Sam Ouder', true, 2);
  assert.equal(ontvangst(p, 1).at, oud.at); assert.equal(ontvangst(p, 1).hash, oud.hash);
  const verloren = motor(); verloren.onb.store();
  verloren.db.data.onboarding.profielen[sess.key] = { velden: {}, ondertekend: { rtg: { ...oud, versie: 0 } } };
  verloren.onb.teken('rtg', sess, 'Sam Ouder', true, 1);
  assert.equal(ontvangst(verloren, 0).contract, undefined, 'geen nieuwe tekst aan historisch ontbrekend bewijs hangen');
});

test('een legacy teksthash bewijst geen historische titel; bekende versiegeschiedenis blijft wel bindend', () => {
  const p = motor(), contract = p.onb.config('rtg').contract;
  p.onb.store();
  const oud = { versie: 1, naam: 'Sam Ouder', at: '2026-01-01T00:00:00.000Z',
    hash: crypto.createHash('sha256').update('1|' + contract.tekst + '|Sam Ouder|' + sess.key).digest('hex') };
  p.db.data.onboarding.profielen[sess.key] = { velden: {}, ondertekend: { rtg: structuredClone(oud) } };
  p.db.data.onboarding.scopes.rtg.contract.titel = 'Een titel die vroeger niet werd gehasht';
  assert.equal(p.onb.teken('rtg', sess, 'Sam Ouder', true, 1).status, 200);
  assert.deepEqual(ontvangst(p, 1), oud, 'de historische rij krijgt geen nieuw verzonnen titelbewijs');
  p.db.data.onboarding.scopes.rtg.contract.titel = 'Weer stil gewijzigd';
  assert.equal(p.onb.status('rtg', sess).contract.ondertekend, false, 'bekende contractgeschiedenis mag niet worden genegeerd');
});

test('nieuwe ontvangst bindt ook titel en scope cryptografisch, zonder legacy-hash te herinterpreteren', () => {
  const p = motor(); p.onb.teken('rtg', sess, 'Sam Ouder', true, 1);
  const o = ontvangst(p, 1), c = o.contract;
  assert.equal(o.hashVersie, 2);
  const hash = crypto.createHash('sha256').update(JSON.stringify([
    'rtg-onboarding-ontvangst', 2, 'rtg', sess.key, c.versie, c.titel, c.tekst, 'Sam Ouder'
  ])).digest('hex');
  assert.equal(o.hash, hash);
  p.db.data.onboarding.scopes.rtg.contract.titel = 'Aangepaste titel';
  o.contract.titel = 'Aangepaste titel';
  p.db.data.onboarding.scopes.rtg.contractVersies[1].titel = 'Aangepaste titel';
  assert.equal(p.onb.status('rtg', sess).contract.ondertekend, false, 'hash zelf beschermt de titel');
});

test('autoritatief tekenen vereist versie en collectiepoort, en meldt geen succes bij rollback', async () => {
  const p = motor();
  assert.equal((await p.onb.tekenVast('rtg', sess, 'Sam Ouder', true, 1)).status, 503);
  const before = JSON.stringify(p.db.data);
  let calls = 0;
  const onb = maakOnboarding({ ...p.opties, bewerkCollectie: async (naam, werk) => {
    assert.equal(naam, 'onboarding'); calls++;
    werk(structuredClone(p.db.data.onboarding || {}));
    throw new Error('commit geweigerd');
  } });
  for (const versie of [undefined, null, '1', 0, -1, 1.5]) {
    const r = await onb.tekenVast('rtg', sess, 'Sam Ouder', true, versie);
    assert.equal(r.status, 409); assert.equal(r.code, 'version_conflict');
  }
  assert.equal(calls, 0);
  const r = await onb.tekenVast('rtg', sess, 'Sam Ouder', true, 1);
  assert.equal(r.status, 503);
  assert.equal(JSON.stringify(p.db.data), before, 'een mislukte collectiecommit lekt niet naar live toestand');
});

test('collectieslot leest de actuele versie, niet de verouderde worker-cache', async () => {
  const p = motor(); p.onb.store();
  const actueel = structuredClone(p.db.data.onboarding);
  actueel.scopes.rtg.contract.versie = 2;
  actueel.scopes.rtg.contract.tekst = 'Deze versie staat al op de andere worker vast.';
  const onb = maakOnboarding({ ...p.opties, bewerkCollectie: async (_naam, werk) => werk(actueel) });
  assert.equal((await onb.tekenVast('rtg', sess, 'Sam Ouder', true, 1)).status, 409);
  assert.equal(actueel.profielen[sess.key]?.ondertekend?.rtg, undefined);
  const r = await onb.tekenVast('rtg', sess, 'Sam Ouder', true, 2);
  assert.equal(r.status, 200); assert.equal(r.contract.versie, 2);
  assert.equal(p.db.data.onboarding.profielen[sess.key], undefined, 'de bewerker gebruikt geen losse RAM-schrijver');
});
