/* HET COMMAND-JOURNAAL TAK VOOR TAK (server/kern/command/journaal.js).

   Wat dit bestand vasthoudt: het journaal schrijft in een meegegeven vak of in
   opslag.vak(), en via een auditopslag (append en rewrite) als die er is; elke
   regel krijgt zijn standaardwaarden en een beknopte voor- en na-toestand; een
   meegegeven tijd van vandaag blijft, een andere niet; de keten klopt en
   controleer() wijst een gewijzigde regel of een gebroken verwijzing aan; de
   staart wordt afgekapt maar de teller niet; wisActor herschrijft de keten,
   zegelt opnieuw en noteert dat hij het deed; en de lezing filtert op object,
   actor, actie, niveau en tijd. Alles in het geheugen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakJournaal } = require('../server/kern/command/journaal');

function opzet(extra = {}) {
  const vak = {};
  let saves = 0;
  const j = maakJournaal(Object.assign({ db: { data: {} }, save: () => { saves++; }, crypto, vak: () => vak }, extra));
  return { j, vak, saves: () => saves };
}

/* Een nagebootste auditopslag: een vaste lijst, append geeft de top mee, rewrite werkt op een kopie. */
function auditOpslag() {
  const staat = { commandJournaal: [] };
  return {
    staat,
    view: () => staat,
    append(maak) { const top = staat.commandJournaal[staat.commandJournaal.length - 1] || null;
      const w = maak(top); staat.commandJournaal.push(w); return w; },
    rewrite(werk) { const kopie = JSON.parse(JSON.stringify(staat)); const uit = werk(kopie);
      staat.commandJournaal = kopie.commandJournaal; return uit; }
  };
}

test('noteer: standaardwaarden voor een kale regel', () => {
  const { j, vak, saves } = opzet();
  const r = j.noteer({});
  assert.equal(r.actor, 'onbekend');
  assert.equal(r.actie, '');
  assert.equal(r.objectType, null);
  assert.equal(r.objectId, null);
  assert.equal(r.niveau, 'hand');
  assert.equal(r.risico, null);
  assert.equal(r.reden, '');
  assert.equal(r.beleid, null);
  assert.equal(r.uitslag, 'gedaan');
  assert.equal(r.voor, null);
  assert.equal(r.na, null);
  assert.equal(r.vorig, null);
  assert.equal('verzoek' in r, false);
  assert.match(r.zegel, /^[0-9a-f]{32}$/);
  assert.equal(vak.commandJournaal.length, 1);
  assert.equal(vak.commandJournaalTotaal, 1);
  assert.equal(saves(), 1);
});

test('noteer: velden worden tekst, risico een getal, het verzoek wordt afgekapt', () => {
  const { j } = opzet();
  const r = j.noteer({ actor: 'user-1', actie: 'wijzig', objectType: 'dossier', objectId: 0, niveau: 'auto',
    risico: '3', reden: 'omdat', beleid: 'B-1', uitslag: 'geweigerd', verzoek: 'v'.repeat(60) });
  assert.equal(r.objectId, '0', 'een id van nul is een id');
  assert.equal(r.risico, 3);
  assert.equal(r.beleid, 'B-1');
  assert.equal(r.uitslag, 'geweigerd');
  assert.equal(r.verzoek, 'v'.repeat(40));
});

test('noteer: voor en na worden beknopt, het verschil blijft leesbaar', () => {
  const { j } = opzet();
  const r = j.noteer({ actor: 'a', voor: 'x'.repeat(400), na: { naam: 'y'.repeat(250), lijst: [1, 2, 3], obj: { a: 1 }, leeg: null, getal: 5, nooit: undefined } });
  assert.equal(r.voor.length, 300);
  assert.deepEqual(r.na, { naam: 'y'.repeat(200), lijst: '3 stuk(s)', obj: '{…}', leeg: null, getal: '5', nooit: null });
  assert.equal(j.noteer({ voor: 7 }).voor, '7');
});

test('noteer: een tijd van vandaag blijft, een andere tijd of geen tekst niet', () => {
  const { j } = opzet();
  const vandaag = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const r = j.noteer({ at: vandaag });
  /* Rond middernacht kan "vandaag" net verschuiven; dan hoort hij juist te zijn vervangen. */
  if (new Date().toISOString().slice(0, 10) === vandaag.slice(0, 10)) assert.equal(r.at, vandaag);
  assert.notEqual(j.noteer({ at: '2001-01-01T00:00:00.000Z' }).at, '2001-01-01T00:00:00.000Z');
  assert.match(j.noteer({ at: 12345 }).at, /^\d{4}-\d\d-\d\dT/);
});

test('noteer: de keten verwijst naar de vorige, controleer() vindt hem heel', () => {
  const { j } = opzet();
  const a = j.noteer({ actor: 'a' }), b = j.noteer({ actor: 'b' });
  assert.equal(b.vorig, a.zegel);
  assert.deepEqual(j.controleer(), { heel: true, regels: 2 });
  assert.equal(j.aantal(), 2);
  assert.equal(j.venster(), 2);
});

test('controleer: een lege keten is heel; een gewijzigde regel en een gebroken verwijzing niet', () => {
  assert.deepEqual(opzet().j.controleer(), { heel: true, regels: 0 });
  const { j, vak } = opzet();
  j.noteer({ actor: 'a' }); const b = j.noteer({ actor: 'b' }); j.noteer({ actor: 'c' });
  vak.commandJournaal[1].reden = 'achteraf aangepast';
  assert.deepEqual(j.controleer(), { heel: false, bij: b.id, waarom: 'de regel is gewijzigd na het noteren' });
  vak.commandJournaal[1].reden = '';
  assert.equal(j.controleer().heel, true);
  const c = vak.commandJournaal[2];
  vak.commandJournaal.splice(1, 1);
  assert.deepEqual(j.controleer(), { heel: false, bij: c.id, waarom: 'de verwijzing naar de vorige regel klopt niet' });
});

test('het vak: een vak zonder lijst krijgt er een, opslag.vak() is de standaard', () => {
  const eigen = { commandJournaal: 'kapot' };
  const j = maakJournaal({ db: {}, save: null, crypto, opslag: { vak: () => eigen } });
  j.noteer({ actor: 'a' });
  assert.ok(Array.isArray(eigen.commandJournaal));
  assert.equal(eigen.commandJournaal.length, 1);
  assert.equal(j.aantal(), 1);
});

test('de staart wordt afgekapt op MAX, de teller niet', () => {
  const { j, vak } = opzet();
  vak.commandJournaal = []; vak.commandJournaalTotaal = j.MAX + 10;
  for (let i = 0; i < j.MAX; i++) vak.commandJournaal.push({ id: 'oud' + i, zegel: 'z' + i });
  j.noteer({ actor: 'nieuw' });
  assert.equal(j.venster(), j.MAX);
  assert.equal(j.aantal(), j.MAX + 11);
  assert.equal(vak.commandJournaal[0].id, 'oud1');
  assert.equal(vak.commandJournaal[j.MAX - 1].actor, 'nieuw');
});

test('wisActor: zonder actor of zonder treffer verandert er niets', () => {
  const { j, saves } = opzet();
  j.noteer({ actor: 'a' });
  assert.deepEqual(j.wisActor('', 'x'), { geraakt: 0 });
  assert.deepEqual(j.wisActor(null), { geraakt: 0 });
  assert.deepEqual(j.wisActor('niemand'), { geraakt: 0 });
  assert.equal(j.aantal(), 1);
  assert.equal(saves(), 1);
});

test('wisActor: de actor wordt gewist, de keten opnieuw gezegeld en de wissing genoteerd', () => {
  const { j, vak } = opzet();
  j.noteer({ actor: 'user-7', actie: 'betaal' });
  j.noteer({ actor: 'user-8', actie: 'kijk' });
  const kop = j.noteer({ actor: 'user-7', actie: 'annuleer' }).zegel;
  const uit = j.wisActor('user-7');
  assert.deepEqual(uit, { geraakt: 2, kopVoor: kop });
  assert.deepEqual(vak.commandJournaal.map(r => r.actor), ['gewist', 'user-8', 'gewist', 'systeem']);
  const laatste = vak.commandJournaal[3];
  assert.equal(laatste.reden, 'recht op vergetelheid (AVG art. 17)');
  assert.equal(laatste.niveau, 'auto');
  assert.deepEqual(laatste.voor, { kopVoorWissing: kop });
  assert.deepEqual(laatste.na, { regelsGewist: '2' });
  assert.deepEqual(j.controleer(), { heel: true, regels: 4 });
  assert.equal(j.wisActor('user-9', 'eigen reden').geraakt, 0);
  j.noteer({ actor: 'user-9' });
  j.wisActor('user-9', 'eigen reden');
  assert.equal(vak.commandJournaal[vak.commandJournaal.length - 1].reden, 'eigen reden');
});

test('auditopslag: noteren loopt via append met de top als vorige', () => {
  const opslag = auditOpslag();
  let saves = 0;
  const j = maakJournaal({ db: {}, save: () => { saves++; }, crypto, auditOpslag: opslag });
  const a = j.noteer({ actor: 'a' });
  const b = j.noteer({ actor: 'b' });
  assert.equal(a.vorig, null);
  assert.equal(b.vorig, a.zegel);
  assert.equal(opslag.staat.commandJournaal.length, 2);
  assert.equal(saves, 0, 'de auditopslag bewaart zelf');
  assert.deepEqual(j.controleer(), { heel: true, regels: 2 });
  assert.equal(j.recent(1)[0].actor, 'b');
});

test('auditopslag: wisActor herschrijft via rewrite, met vaste id en tijd voor de wissing', () => {
  const opslag = auditOpslag();
  const j = maakJournaal({ db: {}, save: () => {}, crypto, auditOpslag: opslag });
  j.noteer({ actor: 'user-1' }); j.noteer({ actor: 'user-2' });
  const uit = j.wisActor('user-1', 'verzoek lid');
  assert.equal(uit.geraakt, 1);
  assert.deepEqual(opslag.staat.commandJournaal.map(r => r.actor), ['gewist', 'user-2', 'systeem']);
  const w = opslag.staat.commandJournaal[2];
  assert.match(w.id, /^[0-9a-f-]{36}$/);
  assert.equal(w.reden, 'verzoek lid');
  assert.deepEqual(j.controleer(), { heel: true, regels: 3 });
  /* Na de herschrijving schrijft het journaal weer gewoon via append. */
  assert.equal(j.noteer({ actor: 'user-3' }).vorig, w.zegel);
});

test('de lezing: per object, recent met filters en herbeleven tussen twee tijden', () => {
  const { j } = opzet();
  j.noteer({ actor: 'a', actie: 'dossier openen', objectType: 'dossier', objectId: 1 });
  j.noteer({ actor: 'b', actie: 'dossier sluiten', objectType: 'dossier', objectId: 2, niveau: 'auto', uitslag: 'mislukt' });
  j.noteer({ actor: 'a', actie: 'betaling', objectType: 'pay', objectId: 1, niveau: 'assist' });
  assert.equal(j.overObject('dossier', 1).length, 1);
  assert.equal(j.overObject('dossier', 3).length, 0);
  assert.deepEqual(j.recent().map(r => r.actor), ['a', 'b', 'a']);
  assert.deepEqual(j.recent(10, { actor: 'a' }).map(r => r.actie), ['betaling', 'dossier openen']);
  assert.deepEqual(j.recent(10, { actie: 'dossier' }).map(r => r.actor), ['b', 'a']);
  assert.deepEqual(j.recent(10, { niveau: 'assist' }).map(r => r.actie), ['betaling']);
  assert.equal(j.recent(1).length, 1);
  const alles = j.herbeleef();
  assert.equal(alles.stappen, 3);
  assert.deepEqual(alles.actoren, ['a', 'b']);
  assert.equal(alles.automatisch, 1);
  assert.equal(alles.mislukt, 1);
  assert.equal(alles.lijn[0].object, 'dossier 1');
  const dossiers = j.herbeleef(null, null, { objectType: 'dossier' });
  assert.equal(dossiers.stappen, 2);
  const een = j.herbeleef('', undefined, { objectType: 'dossier', objectId: 2 });
  assert.equal(een.stappen, 1);
  assert.equal(een.lijn[0].actor, 'b');
  assert.equal(j.herbeleef('2999-01-01').stappen, 0);
  const zonderObject = opzet().j;
  zonderObject.noteer({ actor: 'x' });
  assert.equal(zonderObject.herbeleef().lijn[0].object, null);
});
