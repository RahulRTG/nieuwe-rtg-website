/* ROOD CLUSTEREN -- de rode cellen van APPWERKT.json per kandidaat-oorzaak.

   Wat vastligt, en elke regel kan zakken:
     1. BEWEZEN wordt nooit geclusterd; alleen wat nog werk is.
     2. Twee redenen die alleen in getallen, paden, aangehaalde tekst of een
        uitsplitsing tussen haakjes verschillen, zijn een oorzaak.
     3. Dezelfde reden in twee STANDEN is twee clusters, en in twee BEWIJZEN
        ook: ze vragen een andere handeling.
     4. Een echt ander soort reden blijft apart (de normalisatie mag niet alles
        tot een brij maken).
     5. De grootste cluster staat bovenaan. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cluster, normaliseer } = require('../scripts/lib/appcluster');

const rij = (app, bewijzen) => ({ app, bewijzen });
const b = (status, reden) => ({ status, reden });

test('1. BEWEZEN wordt niet geclusterd', () => {
  const c = cluster({ regels: [rij('A', { bereikbaar: b('BEWEZEN', 'opent') })] });
  assert.equal(Object.values(c).flat().length, 0);
});

test('2. wat per app verschilt, valt weg', () => {
  const x = '3 van 21 zichtbare knoppen aangetikt zonder fout, 11 niet aan te tikken (1x element is outside of the viewport, 10x intercepts pointer events) -- de proef raakte minder dan de helft';
  const y = '7 van 40 zichtbare knoppen aangetikt zonder fout, 7 niet aan te tikken (4x element is not visible) -- de proef raakte minder dan de helft';
  assert.equal(normaliseer(x), normaliseer(y));
  assert.equal(normaliseer('400 /api/carriere/ledger/zet -- {"error":"a"}'), normaliseer('400 /api/carriere/ledger/haal -- {"error":"b"}'));
  const c = cluster({ regels: [rij('A', { bedienbaar: b('NIET_GETEST', x) }), rij('B', { bedienbaar: b('NIET_GETEST', y) })] });
  assert.equal(c.NIET_GETEST.length, 1);
  assert.deepEqual(c.NIET_GETEST[0].apps, ['A', 'B']);
  assert.equal(c.NIET_GETEST[0].voorbeeld, x, 'het voorbeeld is de ongewijzigde reden, zodat een mens hem kan nalopen');
});

test('3. andere stand of ander bewijs is een ander cluster', () => {
  const r = 'vraagt een tweede sessie en een herstart op dezelfde data';
  const c = cluster({ regels: [
    rij('A', { persistent: b('GEEN_FIXTURE', r), bevoegd: b('GEEN_FIXTURE', r) }),
    rij('B', { persistent: b('NIET_GETEST', r) })] });
  assert.equal(c.GEEN_FIXTURE.length, 2, 'twee bewijzen, twee clusters');
  assert.equal(c.NIET_GETEST.length, 1, 'een andere stand is een apart cluster');
});

test('4. een ander soort reden blijft apart', () => {
  const c = cluster({ regels: [
    rij('A', { bereikbaar: b('NIET_GETEST', 'een kiezer in de app: het adres ontstaat pas na een keuze') }),
    rij('B', { bereikbaar: b('NIET_GETEST', 'een stand binnen de ledenapp, geen eigen adres') })] });
  assert.equal(c.NIET_GETEST.length, 2);
});

test('5. de grootste cluster staat bovenaan', () => {
  const c = cluster({ regels: [
    rij('A', { bevoegd: b('GEEN_FIXTURE', 'x x x x x') }),
    rij('B', { bevoegd: b('GEEN_FIXTURE', 'y y y y y') }),
    rij('C', { bevoegd: b('GEEN_FIXTURE', 'y y y y y') })] });
  assert.deepEqual(c.GEEN_FIXTURE.map((k) => k.apps.length), [2, 1]);
});
