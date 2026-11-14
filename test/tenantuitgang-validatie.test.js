'use strict';
// Geïsoleerde opslag, echte bestaande uitgang; geen claim over productieherstel.
const test = require('node:test'), assert = require('node:assert/strict');
const maakUitgang = require('../server/kern/tenant/uitgang');
const kloon = structuredClone;
function huis() {
  const db = { data: { werkruimtes: { WA: { code: 'WA', naam: 'Bron', leden: {}, taken: [{ id: 'T1' }] } } } };
  let saves = 0;
  const uitgang = maakUitgang({ db, save: () => saves++, register: { vanWerkruimte: () => null } });
  return { db, uitgang, basis: uitgang.exporteer('WA').uitvoer, saves: () => saves };
}
function som(h, u) { u.catalogus = h.uitgang.catalogus(u.inhoud); u.checksum = h.uitgang.som(u.catalogus); return u; }
function weiger(h, u) {
  const voor = kloon(h.db.data), saves = h.saves();
  assert.equal(h.uitgang.controleer(u).ok, false);
  assert.equal(h.uitgang.lees(u).status, 400);
  assert.deepEqual(h.db.data, voor); assert.equal(h.saves(), saves);
}
test('afwijkende catalogusvormen worden 400 zonder uitzondering of gedeeltelijke werkruimte', () => {
  for (const vorm of [{}, 'catalogus', [null], [1], [{ soort: 'leden' }]]) {
    const h = huis(), u = kloon(h.basis); u.catalogus = vorm; weiger(h, u);
  }
});
test('catalogus draagt unieke soorten en werkelijke aantallen, ook met zelf herrekende eindsom', () => {
  for (const wijzig of [u => { u.catalogus[0].aantal = 999; },
    u => { u.catalogus.push({ ...u.catalogus[0] }); },
    u => { u.catalogus[0].aantal = -1; }, u => { u.catalogus[0].aantal = '0'; }]) {
    const h = huis(), u = kloon(h.basis); wijzig(u); u.checksum = h.uitgang.som(u.catalogus); weiger(h, u);
  }
});
test('ongeldige inhoud-, kop- en ledenvormen krijgen geen nieuwe opslag', () => {
  for (const wijzig of [u => { u.inhoud = []; }, u => { u.werkruimte = []; },
    u => { u.werkruimte.naam = {}; }, u => { u.inhoud.leden = ['geen lid']; },
    u => { u.inhoud.leden = { M1: null }; }, u => { u.inhoud.leden = { M1: { rollen: {} } }; }]) {
    const h = huis(), u = kloon(h.basis); wijzig(u); som(h, u); weiger(h, u);
  }
  const h = huis(), voor = kloon(h.db.data);
  assert.equal(h.uitgang.lees(h.basis, { naam: {} }).status, 400);
  assert.deepEqual(h.db.data, voor); assert.equal(h.saves(), 0);
});
test('prototypevelden en niet-JSON-objecten geven geen actief gezag of prototypewijziging', () => {
  for (const gevaar of [JSON.parse('{"__proto__":{"beheerder":true}}'),
    JSON.parse('{"constructor":{"prototype":{"beheerder":true}}}'), Object.create({ beheerder: true })]) {
    const h = huis(), u = kloon(h.basis); u.inhoud.vrijVeld = gevaar; som(h, u); weiger(h, u);
    assert.equal({}.beheerder, undefined);
  }
  const h = huis(), cyclus = kloon(h.basis); cyclus.inhoud.terug = cyclus;
  weiger(h, cyclus);
  const diep = kloon(h.basis); let punt = diep.inhoud;
  for (let i = 0; i < 150; i++) { punt.volgend = {}; punt = punt.volgend; }
  weiger(h, diep);
});
test('geldige vrije dossierinhoud blijft bewaard, maar oude koppelsleutels en kopbinding worden niet actief', () => {
  const h = huis(), u = kloon(h.basis);
  u.inhoud.documentair = { willekeurigeHistorie: ['bewaard'], autoriteit: 'slechts tekst', rtgKey: 'user-123', token: 'oud' };
  u.inhoud.code = 'WBESTAAND'; u.inhoud.moeder = 'WGEHEIM'; som(h, u);
  const r = h.uitgang.lees(u); assert.equal(r.ok, true);
  const w = h.db.data.werkruimtes[r.werkruimte];
  assert.notEqual(w.code, 'WBESTAAND'); assert.equal(w.moeder, null); assert.deepEqual(w.leden, {});
  assert.deepEqual(w.documentair, { willekeurigeHistorie: ['bewaard'], autoriteit: 'slechts tekst' });
  const terug = h.uitgang.exporteer(r.werkruimte).uitvoer;
  assert.equal(h.uitgang.controleer(terug).ok, true); assert.doesNotThrow(() => h.uitgang.leesbaar(terug));
});
test('documentair reisarchief weigert onleesbare rijen vóór import', () => {
  for (const reizen of [[null], ['reis'], [{}], [{ ref: 'R', versie: -1, status: 'aangevraagd' }]]) {
    const h = huis(), u = kloon(h.basis);
    u.inhoud = { reisketenUitgang: u.inhoud.reisketenUitgang, reisarchief: {
      schemaVersion: 1, status: 'documentair', operationeelHerstel: false,
      scope: { soort: 'zaak', rol: 'verkoper', org: 'O-A', supplierCode: 'B-A' }, reizen,
      dekking: { volledig: [], nietGedekt: [] }
    } }; som(h, u); weiger(h, u);
  }
});
