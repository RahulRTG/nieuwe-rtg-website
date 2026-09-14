/* DE ONTVANGEROPLOSSING -- wie krijgt een bericht, en wat als niemand het kreeg.

   server/kern/ontvanger.js vervangt `if (!a.key) return;` in kern/werk.js. Die
   regel liet een sollicitant zonder LIDsessie stil vallen; de Adam-keten
   (scripts/adamproef.js, schakel 10) mat dat een aangenomen zeventienjarige uit
   een RTF-gezin nooit iets hoorde.

   DE SCHERPSTE TOETS HIER IS NUMMER 4. De hele reparatie staat of valt bij de
   regel dat deze laag NOOIT stil terugkeert: een ontvanger zonder enkele weg
   hoort een uitslag te geven waar een aanroeper iets mee kan. Zonder die toets
   glijdt de module vanzelf terug naar het gedrag dat hij opheft.

   Draai los: node --test test/ontvanger.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakBezorger, uitSollicitatie, SOORTEN } = require('../server/kern/ontvanger');

/* Een bezorger waarvan elke weg noteert dat hij is aangeroepen. `mislukt` laat
   een weg weigeren, `breekt` laat hem gooien. */
function proefBezorger(opties) {
  const o = opties || {};
  const geraakt = [];
  const weg = (naam) => (doel, bericht) => {
    geraakt.push({ weg: naam, doel, titel: bericht && bericht.titel });
    if (o.breekt === naam) throw new Error('kapot');
    if (o.mislukt === naam) return { ok: false, reden: 'proef-weigering' };
    return { ok: true };
  };
  const wegen = {};
  for (const s of (o.wegen || SOORTEN)) wegen[s] = weg(s);
  return { bezorger: maakBezorger(wegen), geraakt };
}

test('1. een ontvanger met drie wegen krijgt het langs alle drie', () => {
  const { bezorger, geraakt } = proefBezorger();
  const uit = bezorger.bezorg(
    { lid: 'user-7', gezin: { code: 'ABC123', profielId: 'p1' }, mail: 'a@b.nl' },
    { titel: 'Hallo', tekst: 'iets' });
  assert.deepEqual(uit.bezorgd, ['lid', 'gezin', 'mail']);
  assert.deepEqual(uit.nietBezorgd, []);
  assert.equal(uit.geenEnkeleWeg, false);
  assert.equal(geraakt.length, 3, 'niet elke weg is werkelijk aangeroepen');
});

test('2. een gezinslid zonder lidsessie wordt WEL bereikt -- de bevinding zelf', () => {
  /* Dit is de rij die routes/member/werk/rtf.js aanmaakt: geen `key`, wel
     `rtf`. Onder de oude code viel hij volledig stil. */
  const { bezorger, geraakt } = proefBezorger();
  const rij = { name: 'Adam', contact: 'adam@voorbeeld.nl', rtf: { code: 'ABC123', profielId: 'p1' } };
  const uit = bezorger.bezorg(uitSollicitatie(rij), { titel: 'Aangenomen', tekst: 'x' });
  assert.ok(uit.bezorgd.includes('gezin'), 'de gezinsweg is niet gebruikt');
  assert.equal(uit.geenEnkeleWeg, false);
  assert.equal(geraakt.find(g => g.weg === 'gezin').doel.profielId, 'p1');
  assert.ok(!uit.bezorgd.includes('lid'), 'er is geen lidsessie, dus die weg hoort niet te lopen');
});

test('3. een lid houdt zijn eigen weg -- de reparatie neemt niets weg', () => {
  const { bezorger } = proefBezorger();
  const uit = bezorger.bezorg(uitSollicitatie({ key: 'user-7', contact: '06-12345678' }),
    { titel: 'Aangenomen', tekst: 'x' });
  assert.deepEqual(uit.bezorgd, ['lid'], 'een lid zonder e-mailadres krijgt precies een weg');
  /* Een telefoonnummer is geen mailadres. Dat is de bestaande regel uit
     kern/werk.js en geen nieuwe aanname. */
  assert.ok(!uit.bezorgd.includes('mail'));
});

test('4. niemand bereikt is een UITSLAG en geen stilte', () => {
  const { bezorger } = proefBezorger();
  const leeg = bezorger.bezorg(uitSollicitatie({ name: 'Zonder alles' }), { titel: 'x', tekst: 'y' });
  assert.equal(leeg.geenEnkeleWeg, true, 'dit is precies het geval dat stil verdween');
  assert.equal(leeg.bezorgd.length, 0);
  assert.ok(leeg.nietBezorgd.length > 0, 'er staat geen reden in; dan is dit weer een stille return');
  assert.equal(leeg.nietBezorgd[0].reden, 'geen-ontvanger-opgegeven');
});

test('5. een weg die niet is ingericht valt op in plaats van weg', () => {
  const { bezorger } = proefBezorger({ wegen: ['lid'] });   // geen gezin-, geen mailweg
  const uit = bezorger.bezorg({ gezin: { code: 'A', profielId: 'p' } }, { titel: 'x', tekst: 'y' });
  assert.equal(uit.geenEnkeleWeg, true);
  assert.deepEqual(uit.nietBezorgd, [{ weg: 'gezin', reden: 'weg-niet-ingericht' }]);
});

test('6. een kapotte weg neemt de andere niet mee', () => {
  /* Dezelfde regel als in opzet/meldaan.js, waar de push in een try staat: een
     pushdienst die stukligt mag een alarm niet laten verdwijnen. */
  const { bezorger } = proefBezorger({ breekt: 'gezin' });
  const uit = bezorger.bezorg({ gezin: { code: 'A', profielId: 'p' }, mail: 'a@b.nl' }, { titel: 'x', tekst: 'y' });
  assert.deepEqual(uit.bezorgd, ['mail'], 'de mail is niet meer verstuurd nadat de gezinsweg brak');
  assert.match(uit.nietBezorgd[0].reden, /weg-brak/);
  assert.equal(uit.geenEnkeleWeg, false, 'er is er een aangekomen, dus dit is geen totale mislukking');
});

test('7. een onbekende soort wordt gemeld en niet genegeerd', () => {
  /* Een typefout (`gezinn:`) hoort niet stil te verdwijnen -- dat is precies de
     faalvorm die deze module bestrijdt. */
  const { bezorger } = proefBezorger();
  const uit = bezorger.bezorg({ gezinn: { code: 'A' } }, { titel: 'x', tekst: 'y' });
  assert.ok(uit.nietBezorgd.some(n => n.weg === 'gezinn' && n.reden === 'soort-onbekend'));
  assert.equal(uit.geenEnkeleWeg, true);
});

test('8. de lijst soorten is gesloten', () => {
  /* Een soort erbij hoort een besluit te zijn en geen gevolg van een aanroeper
     die een nieuw veld meestuurt. */
  assert.deepEqual(SOORTEN, ['lid', 'gezin', 'mail']);
  assert.ok(Object.isFrozen(SOORTEN), 'de lijst is aan te passen tijdens het draaien');
});

test('9. uitSollicitatie verzint geen ontvanger', () => {
  /* Regel 3 van de module: niets afleiden uit een naam of een codenaam. */
  const uit = uitSollicitatie({ name: 'Adam', codenaam: 'Groene Vos F928', func: 'Keukenhulp' });
  assert.deepEqual(uit, {});
  assert.deepEqual(uitSollicitatie(null), {});
  assert.deepEqual(uitSollicitatie({ rtf: { code: 'A' } }), {}, 'een halve rtf-verwijzing is geen ontvanger');
});
