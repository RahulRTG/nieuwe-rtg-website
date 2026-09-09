/* KLAARZETTEN IS GEEN SCHRIJVEN -- de klassering van de faalproef.

   WAAROM DEZE TOETS BESTAAT. FAALPROEF.json droeg 24 routes met `gezakt`:
   "status 200 terwijl de toestand niet veranderde: bevestigd en niet bewaard".
   Nagemeten met een tweede oproep per route bleken er 22 LEESroutes te zijn die
   bij hun eerste bezoek hun standaard klaarzetten -- `homekit.overzicht()` legt
   de woning aan, `careOverzicht()` het dossier. `/api/dag` draagt in zijn eigen
   kop "die leest alleen" en `/api/office/rechten` heet in COMMERCIE.md "met
   opzet uitsluitend lezend". Over die 22 is een verdict een beschuldiging
   zonder grond.

   De oorzaak zat in de meter en niet in de code, en dat is in dit huis al twee
   keer eerder gebeurd (SCHERMROUTES 118 -> 0 dode paden, AANROEPGRAAF 587 -> 0
   onbekende doelen). `profielVan()` klasseerde uit EEN steekproef, en dat was
   de eerste oproep die de route ooit kreeg.

   Er draait hier geen ronde -- die duurt een half uur en heeft een server
   nodig. De klasseerder wordt rechtstreeks gevoed, net als in
   test/faalproefvorm.test.js.

   Draai los: node --test test/faalproefklasse.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { profielVan } = require('../scripts/faalproef.js');

test('wie bij de eerste oproep schrijft en bij de tweede niet, is een klaarzetter', () => {
  const p = profielVan({ status: 200, effect: 'opslag=1', effect2: 'geen' });
  assert.equal(p.soort, 'voorziening');
  /* De reden moet BEIDE metingen noemen: een oordeel over twee oproepen dat er
     maar een laat zien, is niet na te kijken. */
  assert.match(p.reden, /eerste oproep schreef/);
  assert.equal(p.effect2, 'geen');
});

test('wie bij ELKE oproep schrijft, blijft duurzaam en houdt zijn oordeel', () => {
  /* Dit zijn de twee die de hermeting overleefden: /api/office/aidata/export en
     /api/office/magnaat/scan. Over die twee mag dit register wel oordelen. */
  const p = profielVan({ status: 200, effect: 'opslag=1', effect2: 'opslag=1' });
  assert.equal(p.soort, 'duurzaam');
});

test('zonder tweede meting verandert er niets -- niet gemeten is geen vrijspraak', () => {
  /* Een ronde van voor deze reparatie draagt geen effect2. Die rijen mogen niet
     stilletjes van `duurzaam` naar `voorziening` schuiven: dat zou een oordeel
     weghalen op grond van een meting die niet is gedaan. */
  const p = profielVan({ status: 200, effect: 'opslag=1', effect2: null });
  assert.equal(p.soort, 'duurzaam');
});

test('een klaarzetter is geen leesroute en geen onzekere waarneming', () => {
  /* Drie soorten die alle drie "geen oordeel" betekenen maar niet hetzelfde
     zeggen. Wie ze op een hoop gooit, kan later niet zien welke groep bewoog. */
  assert.equal(profielVan({ status: 200, effect: 'geen' }).soort, 'leest');
  assert.equal(profielVan({ status: 200, effect: 'geen', veranderd: true }).soort, 'onzeker');
  assert.equal(profielVan({ status: 200, effect: 'opslag=2', effect2: 'geen' }).soort, 'voorziening');
});

test('alleen `duurzaam` krijgt een verdict -- elke andere soort draagt een reden', () => {
  /* De consument in faalproef.js zet elke soort die niet `duurzaam` is op
     `ongemeten` MET p.reden. Een soort zonder reden zou daar als lege waarde
     landen, en dat leest als groen. */
  for (const w of [
    { status: 200, effect: 'opslag=1', effect2: 'geen' },
    { status: 200, effect: 'geen' },
    { status: 404 },
  ]) {
    const p = profielVan(w);
    if (p.soort === 'duurzaam') continue;
    assert.ok(p.reden && p.reden.length > 20, 'soort ' + p.soort + ' draagt geen bruikbare reden');
  }
});
