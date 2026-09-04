/* DE OBJECTPAGINASTRUCTUUR (server/kern/objectlaag/pagina.js) -- MAATSTAF.md U28.

   Elke objectpagina draagt dezelfde tien secties. De gemakkelijke uitvoering was
   geweest: schrijf ze op in ONTWERP.md en tel achteraf. Dit is de andere: de
   secties worden SAMENGESTELD, en een sectie die niemand vult verdwijnt niet
   maar zegt waarom.

   DE GEVAARLIJKSTE TOETS IS NUMMER 3. Een structuur die haar eigen gaten
   wegvouwt, meet zichzelf nooit -- dan lijkt elke pagina compleet omdat alles
   wat ontbreekt onzichtbaar is. `nietGevraagd` moet dus in het antwoord staan,
   met de soort erbij.

   Draai los: node --test test/objectpagina.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../server/kern/objectlaag/pagina');
const echteBijdragers = require('../server/kern/objectlaag/paginabijdragers');

const EVENT = { ok: true, soort: 'event', id: 'E1', titel: 'Diner',
  over: { datum: '2026-09-09', tijd: '20:00', waar: 'Kikunoi', gastheer: 'Sperwer', ja: 4, misschien: 1 },
  caps: [{ id: 'antwoord', titel: 'Antwoorden', naar: '/apps/sociaal.html' }], stil: [] };

const bouw = (bijdragers, obj = EVENT) =>
  P.maakPagina({ objectlaag: { object: () => obj }, bijdragers });

test('1. de tien secties staan er altijd, in dezelfde volgorde', () => {
  const p = bouw(echteBijdragers()).pagina('k', 'event', 'E1');
  assert.deepEqual(p.secties.map(s => s.id), P.SECTIE_IDS);
  assert.equal(p.secties.length, 10, 'een elfde sectie is geen uitbreiding maar het einde van de structuur');
  for (const s of P.SECTIES) assert.ok(s.vraag && s.vraag.endsWith('?'),
    s.id + ': een sectie zonder vraag vult zich met wat er toevallig voorhanden is');
});

test('2. een sectie die niemand vult, verdwijnt niet', () => {
  const p = bouw(echteBijdragers()).pagina('k', 'event', 'E1');
  const geld = p.secties.find(s => s.id === 'geld');
  assert.equal(geld.stand, 'nietGevraagd');
  assert.match(geld.uitleg, /event/, 'de uitleg noemt de soort niet, dus het gat is niet te tellen');
  assert.ok(p.telling.nietGevraagd > 0);
});

test('3. leeg en nietGevraagd zijn met opzet niet hetzelfde', () => {
  /* `leeg`: er is een bijdrager, en die weet niets over DIT ding -- een feit
     over het object. `nietGevraagd`: er is niemand -- een gat in het platform.
     Wie die twee samenvoegt, verliest precies het verschil dat je wil zien. */
  const p = bouw([{ id: 'zwijgt', sectie: 'geld', voor: ['*'], lever: () => [] }]).pagina('k', 'event', 'E1');
  assert.equal(p.secties.find(s => s.id === 'geld').stand, 'leeg');
  assert.equal(p.secties.find(s => s.id === 'documenten').stand, 'nietGevraagd');
});

test('4. elke bijdrage draagt een bewijsgraad, en onbekend is de veilige val', () => {
  const p = bouw([
    { id: 'a', sectie: 'status', voor: ['*'], lever: () => ({ tekst: 'iets' }) },
    { id: 'b', sectie: 'status', voor: ['*'], lever: () => ({ tekst: 'meer', graad: 'verzonnen' }) },
    { id: 'c', sectie: 'status', voor: ['*'], lever: () => ({ tekst: 'hard', graad: 'gemeten' }) }
  ]).pagina('k', 'event', 'E1');
  const g = p.secties.find(s => s.id === 'status').bijdragen.map(b => b.graad);
  assert.deepEqual(g, ['onbekend', 'onbekend', 'gemeten'],
    'een bijdrager die niets over de hardheid zegt, of iets verzint, krijgt een graad cadeau');
});

test('5. een bijdrager die klapt, neemt de pagina niet mee', () => {
  const p = bouw([
    { id: 'stuk', sectie: 'status', voor: ['*'], lever: () => { throw new Error('kapot'); } },
    { id: 'goed', sectie: 'samenvatting', voor: ['*'], lever: () => ({ tekst: 'ok', graad: 'gemeten' }) }
  ]).pagina('k', 'event', 'E1');
  assert.equal(p.secties.find(s => s.id === 'samenvatting').stand, 'gevuld');
  const b = p.secties.find(s => s.id === 'status').bijdragen[0];
  assert.match(b.storing, /kapot/);
  assert.equal(b.door, 'stuk', 'een storing zonder naam is niet te repareren');
});

test('6. een bijdrager voor een verzonnen sectie komt er niet in', () => {
  assert.throws(() => bouw([{ id: 'x', sectie: 'sfeerbeeld', voor: ['*'], lever: () => null }]),
    /bestaat niet/, 'een sectie erbij is het einde van de structuur; dat hoort te knallen');
  assert.throws(() => bouw([{ id: 'y', sectie: 'geld', voor: ['*'] }]), /lever/);
});

test('7. een bijdrager voor een andere soort doet niet mee', () => {
  const p = bouw([{ id: 'alleen-groep', sectie: 'geld', voor: ['groep'], lever: () => ({ tekst: 'x' }) }])
    .pagina('k', 'event', 'E1');
  assert.equal(p.secties.find(s => s.id === 'geld').stand, 'nietGevraagd');
});

test('8. de pagina bezit niets: hij leest object() en verder niets', () => {
  const bron = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'server', 'kern', 'objectlaag', 'pagina.js'), 'utf8');
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const kaal = zonderCommentaar(bron);
  assert.doesNotMatch(kaal, /db\.data|save\(/,
    'de paginalaag raakt de opslag aan; dan bestaat een bijeenkomst op twee plekken');
});

test('9. de eerste lichting bijdragers noemt per stuk een sectie die bestaat', () => {
  for (const b of echteBijdragers()) {
    assert.ok(P.SECTIE_IDS.includes(b.sectie), b.id + ': onbekende sectie');
    assert.ok(Array.isArray(b.voor) && b.voor.length, b.id + ': zegt niet voor welke soort hij is');
    assert.equal(typeof b.lever, 'function');
  }
});
