/* Wat een deelnemer met een gesprek doet nadat het bericht er staat
   (server/kern/comm/deelnemer.js).

   DIT WAS EEN GAT, en het viel pas op toen de kern werd opgeknipt. De laag
   draagt vijf grenzen die van de MENS zijn en niet van de opslag -- een
   kwartier om te corrigeren, een por per minuut, een reactie van hoogstens een
   teken, een vaste lijst vlaggen, en een intrekking die een spoor achterlaat --
   en geen ervan werd door een toets aangeraakt. Ik heb het gemeten op de manier
   die hier telt: het kwartier op oneindig zetten en kijken of er iets zakte.
   Er zakte niets. Dan is de grens er niet, hij staat er alleen.

   Vijf getallen die niemand controleerde zijn precies het soort dat iemand
   later "even ruimer zet" omdat het niets kapotmaakt. Vandaar deze toets.

   Draait zonder server, op een nagemaakte database. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakComm } = require('../server/kern/comm');

/* MET OPZET NIET UIT DE MODULE GEHAALD. De eerste versie hier deed
   `const { WIJZIG_MS } = require('.../deelnemer')` en rekende de tijdstempel
   daarmee uit -- en toen ik het kwartier op oneindig zette, zakte er niets:
   de toets schoof gewoon mee. Een grens die je uit de code overneemt, meet je
   niet, je herhaalt hem. Dus staan de minuten hier als getal. */
const KWARTIER_MS = 15 * 60000;

const LEDEN = { 'user-1': 'Amberen Vos', 'user-2': 'Noordelijke Ster' };

function opzet() {
  const db = { data: {} };
  let bewaard = 0;
  const comm = maakComm({
    db, save: () => { bewaard++; }, crypto,
    codenaamVan: (k) => LEDEN[k] || null
  });
  const g = comm.gesprekMaak({ soort: 'personal', deelnemers: ['user-1', 'user-2'] });
  const m = comm.bericht({ gesprekId: g.id, van: 'user-1', tekst: 'tot morgen dan' });
  return { db, comm, g, m, bewaard: () => bewaard };
}

/* ---------------------------------------------------- corrigeren */

test('een correctie mag een kwartier, en daarna niet meer', () => {
  const { comm, g, m } = opzet();
  comm.wijzig('user-1', g.id, m.id, 'tot overmorgen dan');
  assert.equal(comm.gesprek('user-1', g.id).berichten[0].tekst, 'tot overmorgen dan');

  /* De klok terugzetten is eerlijker dan wachten. Allebei de kanten van de
     grens staan er, met een echt getal: veertien minuten mag nog, zestien niet
     meer. Zet iemand het venster ruimer of krapper, dan zakt een van deze twee. */
  m.at = new Date(Date.now() - KWARTIER_MS + 60000).toISOString();
  comm.wijzig('user-1', g.id, m.id, 'na veertien minuten mag het nog');
  assert.equal(comm.gesprek('user-1', g.id).berichten[0].tekst, 'na veertien minuten mag het nog');

  m.at = new Date(Date.now() - KWARTIER_MS - 60000).toISOString();
  assert.throws(() => comm.wijzig('user-1', g.id, m.id, 'toch niet'),
    /te oud om nog te wijzigen/i);
});

test('wat er stond blijft staan, en een ander mag er niet aan', () => {
  const { comm, g, m } = opzet();
  comm.wijzig('user-1', g.id, m.id, 'tot overmorgen dan');
  const na = comm.gesprek('user-2', g.id).berichten[0];
  assert.equal(na.was, 'tot morgen dan', '"bewerkt" zonder te zien wat er stond is geen correctie');
  assert.ok(na.gewijzigd, 'en het staat er als gewijzigd bij');

  assert.throws(() => comm.wijzig('user-2', g.id, m.id, 'ik zeg dit'),
    /alleen je eigen bericht/i);
  assert.throws(() => comm.wijzig('user-1', g.id, m.id, '   '),
    /leegmaken is intrekken/i, 'leegmaken is intrekken en niet wijzigen');
});

/* ---------------------------------------------------- intrekken */

test('intrekken haalt de inhoud weg en laat het spoor staan', () => {
  const { comm, g, m } = opzet();
  comm.reactie('user-2', g.id, m.id, '👍');
  comm.wis('user-1', g.id, m.id);

  const na = comm.gesprek('user-2', g.id).berichten[0];
  assert.equal(na.tekst, null, 'de inhoud is weg');
  assert.ok(na.weg, 'maar dat er iets stond, blijft staan -- de ander heeft het gelezen');
  assert.deepEqual(na.reacties, [], 'en de reacties erop gaan mee');
  assert.equal(comm.inbox('user-2').gesprekken[0].laatste, 'Bericht ingetrokken');

  assert.throws(() => comm.wijzig('user-1', g.id, m.id, 'toch weer'), /ingetrokken/i);
  assert.throws(() => comm.reactie('user-2', g.id, m.id, '👍'), /ingetrokken/i);
});

test('een ander trekt jouw bericht niet in', () => {
  const { comm, g, m } = opzet();
  assert.throws(() => comm.wis('user-2', g.id, m.id), /alleen je eigen bericht/i);
});

/* ---------------------------------------------------- reageren */

test('een reactie is een teken, en nog een tik haalt hem weg', () => {
  const { comm, g, m } = opzet();
  comm.reactie('user-2', g.id, m.id, '👍');
  let r = comm.gesprek('user-2', g.id).berichten[0].reacties;
  assert.deepEqual(r, [{ teken: '👍', aantal: 1, vanMij: true }]);
  assert.equal(comm.gesprek('user-1', g.id).berichten[0].reacties[0].vanMij, false,
    'van wie de reactie is, hangt af van wie er kijkt');

  comm.reactie('user-2', g.id, m.id, '👍');
  assert.deepEqual(comm.gesprek('user-2', g.id).berichten[0].reacties, [],
    'nog een tik haalt hem weg, en het lege teken blijft niet achter');

  assert.throws(() => comm.reactie('user-2', g.id, m.id, ''), /welke reactie/i);
  comm.reactie('user-2', g.id, m.id, 'een hele zin die geen teken meer is');
  assert.equal(comm.gesprek('user-2', g.id).berichten[0].reacties[0].teken.length, 8,
    'een reactie wordt op acht tekens afgekapt: langer dan dat is een bericht');
});

/* ---------------------------------------------------- standen */

test('een vlag staat op een vaste lijst, en de stand is per kijker', () => {
  const { comm, g } = opzet();
  assert.throws(() => comm.vlag('user-1', g.id, 'favoriet', true), /onbekende vlag/i);

  comm.vlag('user-1', g.id, 'vast', true);
  assert.equal(comm.inbox('user-1').gesprekken[0].vast, true);
  assert.equal(comm.inbox('user-2').gesprekken[0].vast, false,
    'wat de een vastzet, zet de ander niet vast');

  comm.vlag('user-1', g.id, 'weg', true);
  assert.equal(comm.inbox('user-1').gesprekken.length, 0, 'weg is weg uit de inbox');
  assert.equal(comm.inbox('user-1', { archief: true }).gesprekken.length, 1, 'maar niet uit het archief');
});

test('een concept reist mee, en de teller telt alleen wat van de ander is', () => {
  const { comm, g } = opzet();
  comm.concept('user-2', g.id, 'ik dacht eraan om');
  assert.equal(comm.inbox('user-2').gesprekken[0].concept, 'ik dacht eraan om');
  assert.equal(comm.inbox('user-1').gesprekken[0].concept, null,
    'het halve bericht van de ander is niet van jou');

  assert.equal(comm.inbox('user-2').gesprekken[0].ongelezen, 1);
  assert.equal(comm.inbox('user-1').gesprekken[0].ongelezen, 0,
    'je eigen bericht heb je per definitie gelezen');
  comm.lees('user-2', g.id);
  assert.equal(comm.inbox('user-2').gesprekken[0].ongelezen, 0);
});

/* ---------------------------------------------------- por */

test('een por mag een keer per minuut, per gesprek', () => {
  const { comm, g } = opzet();
  assert.equal(comm.nudge('user-1', g.id), true);
  assert.throws(() => comm.nudge('user-1', g.id), /een keer per minuut/i,
    'een aandachtsknop zonder rem is een pestknop');

  /* En de rem zit op het PAAR (wie, gesprek) en niet op de knop: de ander mag
     nog wel porren, in hetzelfde gesprek. */
  assert.equal(comm.nudge('user-2', g.id), true);
});

/* ---------------------------------------------------- de poort blijft de poort */

test('geen van deze handelingen kan zonder in het gesprek te zitten', () => {
  const { comm, g, m } = opzet();
  const vreemde = 'user-9';
  for (const [wat, doe] of [
    ['wijzig', () => comm.wijzig(vreemde, g.id, m.id, 'ik zeg dit')],
    ['wis', () => comm.wis(vreemde, g.id, m.id)],
    ['reactie', () => comm.reactie(vreemde, g.id, m.id, '👍')],
    ['lees', () => comm.lees(vreemde, g.id)],
    ['vlag', () => comm.vlag(vreemde, g.id, 'vast', true)],
    ['concept', () => comm.concept(vreemde, g.id, 'hoi')],
    ['typtNu', () => comm.typtNu(vreemde, g.id)],
    ['nudge', () => comm.nudge(vreemde, g.id)]
  ]) {
    assert.throws(doe, /niet van jou/i, wat + ' hoort langs magErin te gaan');
  }
});

test('typt en aanwezig vervallen vanzelf en staan niet in de database', () => {
  const { db, comm, g } = opzet();
  comm.typtNu('user-1', g.id);
  assert.deepEqual(comm.wieTypt(g.id, 'user-2'), ['Amberen Vos']);
  assert.deepEqual(comm.wieTypt(g.id, 'user-1'), [], 'jezelf zie je niet typen');
  assert.equal(comm.isAanwezig('user-1'), true, 'typen is ook een teken van leven');
  assert.equal(comm.isAanwezig('user-2'), false);

  const rommel = JSON.stringify(db.data);
  assert.ok(!/typt|aanwezig/i.test(rommel),
    'seconden geldige toestand hoort niet in een schrijfronde terecht te komen');
});
