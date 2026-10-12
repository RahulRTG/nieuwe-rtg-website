'use strict';
/* RTG Office, de documenten zelf (server/kern/office/docs.js), rechtstreeks op
   de echte basis met een db in het geheugen: de mappenlijst met de omvang per
   soort, maken (leeg, per soort, vanuit een sjabloon, en het maximum), openen
   met rechten, bewaren met versies, de versievergrendeling en het seintje aan
   wie meeleest, markeren en verwijderen door alleen de eigenaar. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakBasis, MAX_DOCS, MAX_VERSIES, SJABLONEN } = require('../server/kern/office/basis');
const maakDocs = require('../server/kern/office/docs');

function wereld(o = {}) {
  const db = { data: {} };
  const seinen = [];
  let saves = 0;
  const state = {
    db, crypto, save() { saves++; },
    codenaamVan: (k) => 'cn-' + k,
    schoon: (s, max) => String(s == null ? '' : s).trim().slice(0, max),
    sseToCustomer: (k, kanaal, data) => { if (o.seinGooit) throw new Error('weg'); seinen.push({ k, kanaal, data }); }
  };
  const basis = maakBasis(state);
  const d = maakDocs(state, basis);
  return { db, d, basis, seinen, saves: () => saves, alle: () => db.data.officeDocs };
}

test('maken: per soort een eigen lege inhoud en titel, en een onbekende soort wordt tekst', () => {
  const { d, alle } = wereld();
  const verwacht = { tekst: 'Nieuw document', blad: 'Nieuw rekenblad', presentatie: 'Nieuwe presentatie',
    formulier: 'Nieuw formulier', schets: 'Nieuwe schets', bord: 'Nieuw bord' };
  for (const [soort, titel] of Object.entries(verwacht)) {
    const r = d.officeMaak('a', { soort });
    assert.equal(r.status, 200);
    assert.equal(r.soort, soort);
    assert.equal(r.titel, titel);
  }
  const raar = d.officeMaak('a', { soort: 'video', titel: '  Mijn stuk  ' });
  assert.equal(raar.soort, 'tekst');
  assert.equal(raar.titel, 'Mijn stuk');
  const doc = alle()[raar.id];
  assert.deepEqual(doc.inhoud, { tekst: '' });
  assert.equal(doc.fase, 'concept');
  assert.equal(doc.audit[0].actie, 'aangemaakt');
  assert.equal(doc.laatstDoor, 'cn-a');
  assert.equal(doc.kring, undefined);
  assert.deepEqual(alle()[d.officeMaak('a', { soort: 'blad' }).id].inhoud, { cellen: {}, rijen: 20, kolommen: 8 });
});

test('maken vanuit een sjabloon neemt soort en titel over, en een kring wordt vastgelegd', () => {
  const { d, alle } = wereld();
  const [naam, sjab] = Object.entries(SJABLONEN).find(([, s]) => s.soort === 'blad');
  const r = d.officeMaak('rtf:G1:p1', { sjabloon: naam, soort: 'tekst' }, 'G1');
  assert.equal(r.soort, 'blad');
  assert.equal(r.titel, sjab.titel);
  const doc = alle()[r.id];
  assert.ok(Object.keys(doc.inhoud.cellen).length > 0);
  assert.equal(doc.kring, 'G1');
  assert.equal(doc.kringDeel, null);
  assert.equal(doc.laatstDoor, 'p1', 'een gezinsprofiel heet naar zijn handle');
});

test('het maximum aantal documenten per eigenaar', () => {
  const { d } = wereld();
  for (let i = 0; i < MAX_DOCS; i++) d.officeMaak('sup:ZAAK', { titel: 'D' + i });
  const vol = d.officeMaak('sup:ZAAK', {});
  assert.equal(vol.status, 409);
  assert.match(vol.error, /maximum van 200 documenten/);
  assert.equal(d.officeMaak('b', {}).status, 200, 'een ander heeft zijn eigen ruimte');
});

test('de mappenlijst: eigen en gedeeld, met de omvang in de eenheid van de soort', () => {
  const { d, alle } = wereld();
  const id = (soort, inhoud) => { const r = d.officeMaak('a', { soort }); if (inhoud) alle()[r.id].inhoud = inhoud; return r.id; };
  const blad1 = id('blad', { cellen: { A1: { w: '1' } } });
  const blad2 = id('blad', { cellen: { A1: {}, B1: {} } });
  const dia1 = id('presentatie');
  const dia0 = id('presentatie', {});
  const vraag1 = id('formulier');
  const vragen = id('formulier', { vragen: [] });
  const vorm1 = id('schets', { vormen: [{}] });
  const vormen = id('schets');
  const woord = id('tekst', { tekst: '<p>hallo</p>' });
  const woorden = id('tekst', { tekst: 'een twee drie' });
  const leeg = id('tekst', null);
  const bord = id('bord');
  /* een inhoud waarvan het lezen gooit, levert een lege omvang */
  const kapot = id('tekst');
  alle()[kapot].inhoud = Object.defineProperty({}, 'tekst', { get() { throw new Error('kapot'); }, enumerable: true });
  alle()[woorden].ster = true;
  alle()[woorden].opmerkingen = [{ opgelost: false }, { opgelost: true }];
  alle()[woorden].beheer = { herzienOp: '2027-01-01', tags: ['kas'] };
  delete alle()[woord].beheer;
  delete alle()[woord].gemaakt;
  delete alle()[woord].laatstDoor;
  delete alle()[woord].versies;
  /* een gedeeld document van een ander */
  const vreemd = d.officeMaak('b', { titel: 'Van b' }).id;
  alle()[vreemd].gedeeldMet = ['a'];
  d.officeMaak('c', { titel: 'Niet gedeeld' });

  const r = d.officeMijn('a');
  assert.equal(r.status, 200);
  assert.equal(r.max, MAX_DOCS);
  const om = Object.fromEntries(r.docs.map(x => [x.id, x.omvang]));
  assert.equal(om[blad1], '1 cel');
  assert.equal(om[blad2], '2 cellen');
  assert.equal(om[dia1], '1 dia');
  assert.equal(om[dia0], "0 dia's");
  assert.equal(om[vraag1], '1 vraag');
  assert.equal(om[vragen], '0 vragen');
  assert.equal(om[vorm1], '1 vorm');
  assert.equal(om[vormen], '0 vormen');
  assert.equal(om[woord], '1 woord');
  assert.equal(om[woorden], '3 woorden');
  assert.equal(om[leeg], '0 woorden');
  assert.equal(om[bord], '0 woorden');
  assert.equal(om[kapot], '');
  assert.equal(r.docs.find(x => x.id === kapot).grootte, Infinity, 'een inhoud die niet te lezen is, is oneindig groot');
  const w = r.docs.find(x => x.id === woorden);
  assert.equal(w.ster, true);
  assert.equal(w.openActies, 1);
  assert.equal(w.herzienOp, '2027-01-01');
  assert.deepEqual(w.tags, ['kas']);
  const kaal = r.docs.find(x => x.id === woord);
  assert.equal(kaal.herzienOp, '');
  assert.deepEqual(kaal.tags, []);
  assert.equal(kaal.gemaakt, kaal.gewijzigd);
  assert.equal(kaal.laatstDoor, 'cn-a');
  assert.equal(kaal.versies, 0);
  assert.deepEqual(r.gedeeld.map(x => [x.id, x.vanMij, x.door]), [[vreemd, false, 'cn-b']]);
  assert.ok(r.sjablonen.length > 0);
  assert.ok(r.sjablonen.every(s => s.groep));
});

test('markeren: alleen de eigenaar, en uitzetten met false', () => {
  const { d } = wereld();
  const id = d.officeMaak('a', {}).id;
  assert.equal(d.officeSter('a', 'doc-weg', true).status, 404);
  assert.equal(d.officeSter('b', id, true).status, 403);
  assert.equal(d.officeSter('a', id).ster, true);
  assert.equal(d.officeSter('a', id, false).ster, false);
});

test('openen: de eigenaar ziet de delingen, een meelezer niet, en een vreemde krijgt 403', () => {
  const { d, alle } = wereld();
  const id = d.officeMaak('a', { titel: 'Plan' }).id;
  alle()[id].gedeeldMet = ['b'];
  alle()[id].bewerkers = ['c'];
  assert.equal(d.officeOpen('a', 'nergens').status, 404);
  assert.equal(d.officeOpen('z', id).status, 403);
  const eig = d.officeOpen('a', id);
  assert.equal(eig.eigenaar, true);
  assert.equal(eig.magBewerken, true);
  assert.deepEqual(eig.gedeeldMet, ['cn-b']);
  assert.deepEqual(eig.bewerkers, ['cn-c']);
  assert.deepEqual(eig.delingen.map(x => x.rechten), ['bewerken', 'lezen']);
  assert.equal(eig.kringDeel, undefined);
  assert.equal(eig.werkstroom.audit.length, 1);
  const lezer = d.officeOpen('b', id);
  assert.equal(lezer.magBewerken, false);
  assert.equal(lezer.gedeeldMet, undefined);
  assert.equal(lezer.werkstroom.audit, undefined);
  assert.equal(d.officeOpen('c', id).magBewerken, true);
  /* strikt sluit het meelezen, ook met een oude deling */
  alle()[id].beheer.classificatie = 'strikt';
  assert.equal(d.officeOpen('b', id).status, 403);
  assert.equal(d.officeOpen('a', id).samenwerken.classificatie, 'strikt');
});

test('openen in een gezinskring: de kringdeling bepaalt lezen en schrijven', () => {
  const { d, alle } = wereld();
  const id = d.officeMaak('rtf:G1:p1', {}, 'G1').id;
  assert.equal(d.officeOpen('rtf:G1:p2', id, 'G1').status, 403);
  alle()[id].kringDeel = 'lezen';
  const r = d.officeOpen('rtf:G1:p2', id, 'G1');
  assert.equal(r.magBewerken, false);
  assert.equal(r.kringDeel, 'lezen');
  assert.equal(d.officeOpen('rtf:G1:p1', id, 'G1').kringDeel, 'lezen');
  delete alle()[id].laatstDoor;
  delete alle()[id].opmerkingen;
  assert.equal(d.officeOpen('rtf:G1:p1', id, 'G1').werkstroom.laatstDoor, 'p1');
  alle()[id].kringDeel = null;
  assert.equal(d.officeOpen('rtf:G1:p1', id, 'G1').kringDeel, null);
});

test('bewaren: rechten, versieconflict en een te groot document', () => {
  const { d, alle } = wereld();
  const id = d.officeMaak('a', {}).id;
  assert.equal(d.officeBewaar('a', 'nergens', {}).status, 404);
  assert.equal(d.officeBewaar('b', id, { inhoud: { tekst: 'x' } }).status, 403);
  const conflict = d.officeBewaar('a', id, { verwachtGewijzigd: '1999-01-01', inhoud: { tekst: 'x' } });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.code, 'VERSIECONFLICT');
  assert.equal(conflict.laatstDoor, 'cn-a');
  delete alle()[id].laatstDoor;
  assert.equal(d.officeBewaar('a', id, { verwachtGewijzigd: 'x' }).laatstDoor, 'cn-a');
  const groot = d.officeBewaar('a', id, { titel: 'Nieuw', inhoud: { tekst: 'x'.repeat(500001) } });
  assert.equal(groot.status, 413);
  assert.equal(alle()[id].titel, 'Nieuw document', 'een geweigerde opslag wijzigt ook de titel niet');
});

test('bewaren zonder wijziging is een stille ok; een echte wijziging maakt een versie', () => {
  const { d, alle, saves } = wereld();
  const id = d.officeMaak('a', {}).id;
  const voor = saves();
  const niets = d.officeBewaar('a', id, { inhoud: { tekst: '' }, titel: '   ' });
  assert.equal(niets.ok, true);
  assert.equal(niets.fase, 'concept');
  assert.equal(saves(), voor, 'geen wijziging, niets bewaard');
  assert.equal(alle()[id].versies.length, 0);
  const tekst = d.officeBewaar('a', id, { inhoud: { tekst: 'eerste' } });
  assert.equal(tekst.ok, true);
  assert.equal(alle()[id].versies.length, 1);
  assert.deepEqual(alle()[id].versies[0].inhoud, { tekst: '' });
  /* alleen de titel: geen nieuwe versie */
  d.officeBewaar('a', id, { titel: 'Hernoemd' });
  assert.equal(alle()[id].titel, 'Hernoemd');
  assert.equal(alle()[id].versies.length, 1);
  /* een niet-object als inhoud telt niet */
  assert.equal(d.officeBewaar('a', id, { inhoud: 'tekst' }).ok, true);
  /* de versies blijven onder het plafond */
  for (let i = 0; i < MAX_VERSIES + 3; i++) d.officeBewaar('a', id, { inhoud: { tekst: 'v' + i } });
  assert.equal(alle()[id].versies.length, MAX_VERSIES);
  /* een document zonder versielijst krijgt er een */
  delete alle()[id].versies;
  d.officeBewaar('a', id, { inhoud: { tekst: 'weer' } });
  assert.equal(alle()[id].versies.length, 1);
});

test('een meeschrijver wijzigt de inhoud maar niet de titel, en een goedgekeurd stuk wordt weer concept', () => {
  const { d, alle, seinen } = wereld();
  const id = d.officeMaak('a', {}).id;
  alle()[id].bewerkers = ['c'];
  alle()[id].gedeeldMet = ['b', 'x'];
  alle()[id].fase = 'goedgekeurd';
  const r = d.officeBewaar('c', id, { titel: 'Van c', inhoud: { tekst: 'door c' } });
  assert.equal(r.ok, true);
  assert.equal(r.fase, 'concept');
  assert.equal(alle()[id].titel, 'Nieuw document');
  assert.equal(alle()[id].laatstDoor, 'cn-c');
  assert.deepEqual(alle()[id].audit.slice(0, 2).map(a => a.actie), ['bewerkt', 'status-teruggezet']);
  /* een seintje naar iedereen behalve de schrijver zelf */
  assert.deepEqual(seinen.map(s => s.k).sort(), ['a', 'b', 'x']);
  assert.equal(seinen.length, 3);
  assert.ok(seinen.every(s => s.kanaal === 'office' && s.data.kind === 'gewijzigd'));
  /* strikt: meelezers krijgen geen seintje meer, de eigenaar wel */
  seinen.length = 0;
  alle()[id].beheer.classificatie = 'strikt';
  d.officeBewaar('a', id, { inhoud: { tekst: 'strikt' } });
  assert.equal(seinen.length, 0);
  assert.equal(d.officeBewaar('c', id, { inhoud: { tekst: 'mag niet' } }).status, 403);
});

test('een seintje dat faalt, breekt het bewaren niet', () => {
  const { d, alle } = wereld({ seinGooit: true });
  const id = d.officeMaak('a', {}).id;
  alle()[id].gedeeldMet = ['b'];
  assert.equal(d.officeBewaar('a', id, { inhoud: { tekst: 'nieuw' } }).ok, true);
  assert.deepEqual(alle()[id].inhoud, { tekst: 'nieuw' });
});

test('verwijderen: alleen de eigenaar, en een formulier neemt zijn inzendingen mee', () => {
  const { d, db, alle } = wereld();
  const id = d.officeMaak('a', { soort: 'formulier' }).id;
  const ander = d.officeMaak('a', {}).id;
  assert.equal(d.officeWeg('a', 'nergens').status, 404);
  assert.equal(d.officeWeg('b', id).status, 403);
  db.data.officeAntwoorden = { [id]: [{ a: 1 }], [ander]: [] };
  assert.equal(d.officeWeg('a', id).ok, true);
  assert.equal(alle()[id], undefined);
  assert.equal(db.data.officeAntwoorden[id], undefined);
  assert.ok(db.data.officeAntwoorden[ander]);
  assert.equal(Object.keys(alle()).length, 1);
  delete db.data.officeAntwoorden;
  assert.equal(d.officeWeg('a', ander).ok, true);
  assert.equal(Object.keys(alle()).length, 0);
});
