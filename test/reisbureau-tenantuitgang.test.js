'use strict';
/* De bestaande exitpoort blijft een werkruimtepoort. Deze proeven bewijzen
   het expliciete, checksum-gedekte meldpunt, NIET een volledige reisexport of
   een productie-exitrecht in bewaring. Dat laatste vraagt een bestaand bevoegd
   persoon, niet een herleefde personeelssessie. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const maakUitgang = require('../server/kern/tenant/uitgang');
const maakRegister = require('../server/kern/tenant/register');
const { maak: maakSleutels } = require('../server/bedrijf/sleutels');
const { tenantOpen } = require('../server/bedrijf/productie-identiteit');
const clone = value => structuredClone(value);

function huis() {
  const db = { data: {
    werkruimtes: {
      WA: { code: 'WA', naam: 'Werkruimte A', land: 'NL', leden: {
        M1: { id: 'M1', naam: 'Eigen medewerker', rtgKey: 'user-101', status: 'actief', rollen: [{ id: 'directie' }] }
      }, taken: [{ id: 'TA', titel: 'Eigen werk' }] },
      WB: { code: 'WB', naam: 'Werkruimte B', leden: {}, taken: [{ id: 'TB', titel: 'Andermans werk' }] },
      WA2: { code: 'WA2', naam: 'Andere werkruimte van dezelfde tenant', leden: {}, taken: [{ id: 'TA2', titel: 'Ander werk binnen de tenant' }] }
    },
    tenants: {},
    reisAanvragen: [
      { ref: 'REIS-A-PRIVE', customerKey: 'user-101', codename: 'reiziger-privaat', keten: {
        verkoper: { org: 'ORG-A', supplierCode: 'BUREAU-A' }, offerte: { totaalCenten: 93456 },
        leveringen: [{ org: 'ORG-B', supplierCode: 'HOTEL-B', bewijsRef: 'LEVERANCIER-BEWIJS-PRIVAAT' }],
        betaling: { status: 'betaald', boekingRef: 'PAY-PRIVAAT', van: 'lid:reiziger-privaat', sleutel: 'ECONOMISCH-PRIVAAT' }
      } },
      { ref: 'REIS-B-PRIVE', customerKey: 'user-102', keten: { verkoper: { org: 'ORG-B', supplierCode: 'BUREAU-B' },
        leveringen: [{ org: 'ORG-A', supplierCode: 'HOTEL-A', verschuldigdCenten: 87654 }] } }
    ], payBoekingen: [{ id: 'PAY-PRIVAAT', centen: 93456 }] } };
  let saves = 0;
  const save = () => { saves++; };
  const register = maakRegister({ db, save, schoon: (v, max) => String(v || '').slice(0, max), findSupplier: () => ({}) });
  register.zet({ org: 'ORG-A', naam: 'Organisatie A' });
  register.zet({ org: 'ORG-B', naam: 'Organisatie B' });
  register.bind('ORG-A', 'werkruimte', 'WA', true);
  register.bind('ORG-A', 'werkruimte', 'WA2', true);
  register.bind('ORG-B', 'werkruimte', 'WB', true);
  const sleutels = maakSleutels();
  const beheer = sleutels.geefBeheer(db.data.werkruimtes.WA);
  const lid = sleutels.geefLid(db.data.werkruimtes.WA, db.data.werkruimtes.WA.leden.M1);
  const uitgang = maakUitgang({ db, save, register });
  return { db, register, uitgang, sleutels, beheer, lid, saves: () => saves };
}

// Onafhankelijke uitvoering van het meereizende recept, geen server-helper.
function canoniek(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value === undefined ? null : value);
  if (Array.isArray(value)) return '[' + value.map(canoniek).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canoniek(value[k])).join(',') + '}';
}
const som = value => crypto.createHash('sha256').update(canoniek(value)).digest('hex');
function herbereken(h, uitvoer) {
  uitvoer.catalogus = h.uitgang.catalogus(uitvoer.inhoud);
  uitvoer.checksum = som(uitvoer.catalogus);
  return uitvoer;
}

test('de bestaande export meldt gedeeltelijke dekking checksum-gedekt, zonder dummyreis of telling', () => {
  const h = huis(), voor = clone(h.db.data), saves = h.saves();
  const u = h.uitgang.exporteer('WA').uitvoer, grens = u.inhoud.reisketenUitgang;
  assert.equal(u.status, 'gedeeltelijk');
  assert.equal(grens.status, 'gedeeltelijk');
  assert.equal(grens.scope, 'werkruimte');
  assert.equal(grens.volledigeTenantexport, false);
  assert.equal(grens.reiscontracten.status, 'geblokkeerd');
  assert.equal(grens.reiscontracten.code, 'REISKETEN_EXPORT_SCOPE_UNPROVEN');
  assert.match(grens.reiscontracten.reden, /org is geen inzagerecht/);
  assert.equal(grens.reiscontracten.aantal, undefined);
  assert.equal(grens.reiscontracten.reizen, undefined);
  assert.equal(u.inhoud.reisAanvragen, undefined);
  assert.equal(u.inhoud.leveringen, undefined);
  const cat = u.catalogus.find(r => r.soort === 'reisketenUitgang');
  assert.equal(cat.checksum, som(grens));
  assert.equal(u.checksum, som(u.catalogus));
  assert.equal(h.uitgang.controleer(u).ok, true);
  assert.match(u.let, /geen volledige tenant- of reisexport/);
  assert.deepEqual(h.db.data, voor, 'export blijft volledig leeswerk');
  assert.equal(h.saves(), saves);
});

test('werkruimtekeuze geeft geen eigen-tenantbrede of vreemde reis-, klant- en leveranciersgegevens', () => {
  const h = huis();
  for (const code of ['WA', 'WA2', 'WB']) {
    const u = h.uitgang.exporteer(code, { org: 'ORG-B', volledig: true }).uitvoer;
    const tekst = JSON.stringify(u);
    for (const geheim of [h.beheer, h.lid, 'user-101', 'user-102', 'customerKey', 'reiziger-privaat',
      'REIS-A-PRIVE', 'REIS-B-PRIVE', 'LEVERANCIER-BEWIJS-PRIVAAT', 'PAY-PRIVAAT', 'ECONOMISCH-PRIVAAT', '93456', '87654'])
      assert.equal(tekst.includes(geheim), false, code + ': ' + geheim);
    assert.equal(u.status, 'gedeeltelijk');
    assert.equal(u.tenant.org, code === 'WB' ? 'ORG-B' : 'ORG-A', 'opties.org is geen autoriteit');
  }
  const eigen = JSON.stringify(h.uitgang.exporteer('WA').uitvoer);
  assert.equal(eigen.includes('Andermans werk'), false);
  assert.equal(eigen.includes('Ander werk binnen de tenant'), false);
});

test('het meldpunt verraadt geen aanwezigheid, aantal of inhoud van reiscontracten', () => {
  const h = huis();
  const eerste = h.uitgang.exporteer('WA', { at: '2026-11-11T10:00:00Z' }).uitvoer;
  h.db.data.reisAanvragen = [];
  const leeg = h.uitgang.exporteer('WA', { at: '2026-11-11T10:00:00Z' }).uitvoer;
  assert.deepEqual(leeg, eerste, 'reisgegevens worden niet eens gelezen voor deze scopeverklaring');
});

test('kernexport blijft in bewaring leesbaar zonder de productiecontext opnieuw te openen', () => {
  const h = huis();
  h.register.haal('ORG-A').levensloop = { stand: 'bewaring' };
  h.db.data.werkruimtes.WA.leden.M1.status = 'uit dienst';
  const voor = clone(h.db.data);
  const uit = h.uitgang.exporteer('WA');
  assert.equal(uit.ok, true);
  assert.equal(uit.uitvoer.inhoud.reisketenUitgang.reiscontracten.status, 'geblokkeerd');
  assert.match(uit.uitvoer.inhoud.reisketenUitgang.reiscontracten.bewaring, /productie-exitbevoegdheid.*niet gekwalificeerd/);
  assert.equal(tenantOpen(h.register.haal('ORG-A')), false, 'geen verruiming van het productietoegangscontract');
  assert.equal(h.db.data.werkruimtes.WA.leden.M1.status, 'uit dienst');
  assert.deepEqual(h.db.data, voor);
});

test('inlezen bewaart de scopeverklaring zonder nieuwe tenantbinding, reisacceptatie of betaling', () => {
  const h = huis(), u = h.uitgang.exporteer('WA').uitvoer;
  const voor = clone({ tenants: h.db.data.tenants, reizen: h.db.data.reisAanvragen, betalingen: h.db.data.payBoekingen });
  const uit = h.uitgang.lees(u, { naam: 'Herstelarchief' });
  assert.equal(uit.ok, true);
  assert.notEqual(uit.werkruimte, 'WA');
  assert.equal(h.register.vanWerkruimte(uit.werkruimte), null);
  const w = h.db.data.werkruimtes[uit.werkruimte];
  assert.equal(w.leden.M1.rtgKey, undefined);
  assert.equal(w.leden.M1.token, undefined);
  assert.deepEqual(w.leden.M1.sessies, []);
  assert.equal(w.reisAanvragen, undefined);
  assert.equal(h.sleutels.lidVan(w, h.lid), null);
  assert.equal(h.sleutels.beheerVan(w, h.beheer), null);
  assert.deepEqual({ tenants: h.db.data.tenants, reizen: h.db.data.reisAanvragen, betalingen: h.db.data.payBoekingen }, voor);
  const terug = h.uitgang.exporteer(uit.werkruimte).uitvoer;
  assert.equal(terug.status, 'gedeeltelijk');
  assert.deepEqual(terug.inhoud.reisketenUitgang, u.inhoud.reisketenUitgang);
  assert.equal(terug.catalogus.find(r => r.soort === 'reisketenUitgang').checksum,
    u.catalogus.find(r => r.soort === 'reisketenUitgang').checksum);
});

test('een nagerekend bestand mag geen volledige-scopeclaim als autoriteit importeren', () => {
  const h = huis(), u = h.uitgang.exporteer('WA').uitvoer, voor = clone(h.db.data);
  for (const vervals of [a => { a.status = 'volledig'; },
    a => { a.inhoud.reisketenUitgang.volledigeTenantexport = true; },
    a => { a.inhoud.reisketenUitgang.reiscontracten.status = 'bewezen'; }]) {
    const poging = clone(u); vervals(poging); herbereken(h, poging);
    assert.equal(h.uitgang.controleer(poging).ok, false);
    assert.equal(h.uitgang.lees(poging).status, 400);
    assert.deepEqual(h.db.data, voor);
  }
});

test('importchecksum verleent geen oude RTG-binding, sleutel of vervangende werkruimtecode', () => {
  const h = huis(), u = h.uitgang.exporteer('WA').uitvoer;
  u.inhoud.leden.M1.rtgKey = 'user-101';
  u.inhoud.leden.M1.token = h.lid;
  u.inhoud.leden.M1.sessies = clone(h.db.data.werkruimtes.WA.leden.M1.sessies);
  u.inhoud.beheerSessies = clone(h.db.data.werkruimtes.WA.beheerSessies);
  u.inhoud.code = 'WA'; u.inhoud.moeder = 'WB';
  herbereken(h, u);
  const uit = h.uitgang.lees(u);
  assert.equal(uit.ok, true);
  const w = h.db.data.werkruimtes[uit.werkruimte];
  assert.equal(w.code, uit.werkruimte);
  assert.equal(w.moeder, null);
  assert.equal(w.leden.M1.rtgKey, undefined);
  assert.equal(h.sleutels.lidVan(w, h.lid), null);
  assert.equal(h.sleutels.beheerVan(w, h.beheer), null);
  assert.equal(h.db.data.werkruimtes.WA.code, 'WA');
});

test('leesbaar overzicht noemt dezelfde gedeeltelijke scope en ontbrekende productie-exitkwalificatie', () => {
  const h = huis(), md = h.uitgang.leesbaar(h.uitgang.exporteer('WA').uitvoer);
  assert.match(md, /uitvoer is gedeeltelijk/);
  assert.match(md, /reisketenUitgang/);
  assert.match(md, /Inlezen activeert geen reiscontract/);
  assert.match(md, /productie-exitbevoegdheid tijdens bewaring is nog niet gekwalificeerd/);
  assert.equal(md.includes('REIS-A-PRIVE'), false);
});
