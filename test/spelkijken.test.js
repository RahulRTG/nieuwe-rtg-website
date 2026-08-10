/* Meekijken bij een lopend potje. Twee poorten die verschillend werk doen:
   MAG DIT SPEL bekeken worden (per spel in de descriptor, standaard NIET), en
   MAG JIJ dit potje bekijken (vriend van een speler, of mededeelnemer aan
   hetzelfde toernooi).

   De reden dat het per spel moet en niet in het algemeen mag, staat als toets
   onderaan: de weergave van 30 Seconden verbergt de kaart voor de rader door
   op zijn spelersindex te kijken -- en een kijker heeft geen index, dus die
   zou hem juist wel zien. Nagemeten, niet aangenomen.

   Draai los: node --experimental-sqlite --test test/spelkijken.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakSpellen = require('../server/kern/spellen');
const maakRegister = require('../server/kern/spellen/register');
const spelCtx = { save() {}, crypto: require('crypto'), schud: (a) => a, beurtDoor() {}, codenaamVan: (x) => 'CN-' + x, nudge() {} };
const REG = maakRegister(spelCtx);

function opstelling({ vrienden = () => false, geblokkeerd = () => false } = {}) {
  const db = { data: { spellen: { potjes: {}, wachtrij: {} } } };
  const kern = maakSpellen({ db, save() {}, crypto: require('crypto'), zijnVrienden: vrienden,
    codenaamVan: (x) => 'CN-' + x, sseToCustomer() {}, isGeblokkeerd: geblokkeerd,
    socialZoek: async () => [], sociaalRate: () => true, volwassen: () => true,
    sseClients: [], lidBoardUit: () => false });
  const potje = (id, soort, spelers, extra) => {
    const p = Object.assign({ id, soort, modus: 'vrij', spelers, uitgenodigd: [], beurt: 0,
      teams: [0, 1, 0, 1], status: 'bezig', winnaar: null, at: new Date().toISOString() }, extra || {});
    REG.INITS[soort](p);
    db.data.spellen.potjes[id] = p;
    return p;
  };
  return { db, kern, potje };
}

test('een vriend van een speler mag meekijken', () => {
  const o = opstelling({ vrienden: (mij, sp) => mij === 'vriend' });
  o.potje('p1', 'schaak', ['a', 'b']);
  const r = o.kern.spelKijk('vriend', 'p1');
  assert.equal(r.status, 200);
  assert.equal(r.potje.kijker, true, 'het antwoord zegt dat je kijkt en niet speelt');
  assert.deepEqual(r.potje.spelers, ['CN-a', 'CN-b'], 'op codenaam');
  assert.ok(r.potje.staat.bord, 'en het bord is te zien');
});

test('een vreemde mag niet meekijken', () => {
  const o = opstelling();
  o.potje('p1', 'schaak', ['a', 'b']);
  const r = o.kern.spelKijk('vreemde', 'p1');
  assert.equal(r.status, 403);
  assert.match(r.error, /vrienden|toernooi/);
});

test('een speler gebruikt de kijkweergave niet', () => {
  // die heeft zijn eigen weergave, met zijn eigen hand erin
  const o = opstelling({ vrienden: () => true });
  o.potje('p1', 'schaak', ['a', 'b']);
  assert.equal(o.kern.spelKijk('a', 'p1').status, 403);
});

test('een blokkade weegt zwaarder dan een vriendschap', () => {
  const o = opstelling({ vrienden: () => true, geblokkeerd: (mij, sp) => sp === 'b' });
  o.potje('p1', 'schaak', ['a', 'b']);
  assert.equal(o.kern.spelKijk('vriend', 'p1').status, 403,
    'wie jou heeft geblokkeerd hoeft niet te dulden dat je zijn partij volgt');
});

test('wat aan een persoon hangt valt weg in de kijkweergave', () => {
  const o = opstelling({ vrienden: () => true });
  o.potje('p1', 'pesten', ['a', 'b']);
  const kijker = o.kern.spelKijk('vriend', 'p1').potje.staat;
  assert.equal(kijker.hand, undefined, 'een kijker ziet niemands kaarten');
  assert.ok(Array.isArray(kijker.aantallen), 'wel hoeveel kaarten iedereen heeft');
  assert.ok(kijker.open, 'en wat er open ligt');
});

test('een mededeelnemer aan hetzelfde toernooi mag meekijken', () => {
  const o = opstelling();   // geen vrienden
  o.kern.toernooiNieuw('a', { soort: 'schaak', maat: 4, vorm: 'knockout', spelers: ['b', 'c', 'd'] });
  const t = o.db.data.spelToernooien[0];
  ['b', 'c', 'd'].forEach(x => o.kern.toernooiAntwoord(x, t.id, true));
  const anderePartij = t.paren[1];
  const kijker = t.paren[0].a;                       // speelt zelf in de andere wedstrijd
  const r = o.kern.spelKijk(kijker, anderePartij.potje);
  assert.equal(r.status, 200, 'in een toernooi kijk je bij de andere wedstrijd');
  assert.equal(r.potje.kijker, true);
});

/* ---------- waarom het per spel moet ---------- */

test('de poort weigert een spel dat niet bekeken mag worden', () => {
  /* De descriptor zeggen dat het niet mag is een ding; hem ook echt laten
     weigeren is een ander. Zonder deze toets kon de controle uit magKijken
     verdwijnen zonder dat er iets rood werd -- gemeten met een mutatie. */
  const o = opstelling({ vrienden: () => true });
  o.potje('p2', 'seconden', ['a', 'b', 'c', 'd'], { modus: 'teams' });
  const r = o.kern.spelKijk('vriend', 'p2');
  assert.equal(r.status, 403);
  assert.match(r.error, /niet meekijken/);
});

test('30 Seconden mag NIET bekeken worden, en dit is de reden', () => {
  /* De weergave verbergt de kaart voor de RADER op zijn spelersindex. Een
     kijker heeft geen index, dus `indexOf(null)` geeft -1 en dat is nooit
     gelijk aan de rader -- de kaart zou dus juist aan de kijker getoond
     worden, die hem kan doorgeven. Deze toets meet dat, zodat de uitzondering
     geen aanname is. */
  const spelers = ['s0', 's1', 's2', 's3'];
  const p = { id: 'x', soort: 'seconden', modus: 'teams', spelers, uitgenodigd: [], beurt: 0,
    teams: [0, 1, 0, 1], status: 'bezig', winnaar: null, at: '' };
  REG.INITS.seconden(p);
  REG.ZETTEN.seconden(p, 's0', { actie: 'kaart' });
  const rader = (p.beurt + 2) % spelers.length;
  assert.equal(REG.VIEWS.seconden(p, p.staat, spelers[rader]).kaart, null, 'de rader ziet de kaart niet');
  assert.ok(REG.VIEWS.seconden(p, p.staat, null).kaart, 'maar een kijker WEL -- vandaar geen kijken');
  assert.ok(!REG.SPEL.seconden.kijken, 'dus staat kijken bij dit spel uit');
});

test('meekijken staat standaard UIT voor een nieuw spel', () => {
  /* Opt-in en niet opt-out: een spel dat de vraag niet beantwoordt is niet te
     bekijken, in plaats van per ongeluk wel. */
  const spel = "module.exports = () => ({ spel: { sleutel: 'nieuw', naam: 'Nieuw', max: 2, wereld: 'rtg', init(){}, zet(){}, view(){} } });";
  const fs = require('fs'), os = require('os'), path = require('path');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'kijk-'));
  try {
    fs.writeFileSync(path.join(map, 'nieuw.js'), spel);
    const { SPEL } = maakRegister(spelCtx, map);
    assert.ok(!SPEL.nieuw.kijken, 'zonder kijken in de descriptor: niet te bekijken');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

test('vijftien spellen mogen bekeken worden, en precies een niet', () => {
  const uit = Object.keys(REG.SPEL).filter(k => !REG.SPEL[k].kijken);
  assert.deepEqual(uit, ['seconden'], 'elke andere uitzondering hoort een reden te hebben');
});
