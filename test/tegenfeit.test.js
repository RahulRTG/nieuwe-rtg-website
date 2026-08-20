/* ============================================================================
   HET TEGENFEIT -- wat zou er gebeurd zijn onder de nieuwe regel?

   WAAROM DIT ER IS. kern/commercie/schaduw.js laat een regel meelopen en telt wat
   hij zou hebben tegengehouden. Na een week staat er een getal, en dan komt de
   vraag die er werkelijk toe doet: kan die regel aan? Zonder antwoord is een
   beleidswijziging een gok met een percentage erop.

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 1   het draait de ECHTE beslisfunctie en niet een nagebouwde
     toets 4   onder de drempel komt er geen getal maar een mededeling -- dat
               precies ogende getal uit een lege week is de duurste verleiding
     toets 5   er wordt geen rangorde verzonnen: TOESTAAN -> BEPERKT is wel
               degelijk iets, en GOEDKEURING is iets anders dan WEIGEREN
     toets 7   een tegenfeit schrijft niets; het is een herhaling en geen besluit

   Draai los: node --experimental-sqlite --test test/tegenfeit.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const tf = require('../server/kern/commercie/tegenfeit');
const bev = require('../server/kern/commercie/bevoegdheid');
const { UITKOMST } = require('../server/kern/commercie/besluit');
const { maakSchaduw, RIJP } = require('../server/kern/commercie/schaduw');

const nu = () => 1_700_000_000_000;
const bevoegd = g => bev.maakBevoegdheid({ capability: 'money.refund', grenzen: g, door: 'manager', nu });
const motor = g => ({ zoekBevoegdheid: () => bevoegd(g) });

function verzoeken(n, centenVan) {
  const uit = [];
  for (let i = 0; i < n; i++)
    uit.push({ actor: 'medewerker', handeling: 'money.refund', doel: 'zaak:A',
      waardeCenten: centenVan ? centenVan(i) : (i % 40) * 1000 });
  return uit;
}

/* DE BEWERING. Een tegenfeit dat op een MODEL van je systeem rekent, meet je
   model en niet je systeem -- en die twee lopen uiteen op precies de gevallen
   waar het om gaat. */
test('1. het draait de echte beslisfunctie, tot en met het beleid erin', () => {
  const v = verzoeken(200, i => (i % 4) * 20000);   // 0, 200, 400 en 600 euro
  const ruim = motor({ maxCenten: 100_000_000 });

  /* Alleen het BELEID verandert -- de bevoegdheid blijft gelijk. Zou deze module
     de bevoegdheid nabouwen in plaats van besluit.js te draaien, dan zag zij
     hier helemaal niets. */
  const r = tf.vergelijk({ verzoeken: v, huidig: ruim,
    voorstel: { ...ruim, beleid: { versie: 'v2', goedkeuringBovenCenten: 30000 } }, nu });

  assert.equal(r.genoeg, true);
  assert.ok(r.anders > 0, 'een strengere goedkeuringsdrempel hoort iets te veranderen');
  assert.ok(r.gevolgen.wachtNu > 0, 'bedragen die eerst zomaar mochten, wachten nu op een handtekening');
  assert.ok(r.overgangen.some(o => o.van === UITKOMST.TOESTAAN && o.naar === UITKOMST.GOEDKEURING));

  /* En een verschuiving BINNEN het wachten telt niet als "wacht nu": van
     EXTRA_BEWIJS naar GOEDKEURING is zwaarder, maar er wachtte al iemand. Dat is
     precies het soort onderscheid dat een verzonnen rangorde zou platslaan. */
  assert.ok(r.overgangen.some(o => o.van === UITKOMST.EXTRA_BEWIJS && o.naar === UITKOMST.GOEDKEURING));
});

test('2. een verandering die niets doet, levert ook niets op', () => {
  const v = verzoeken(150);
  const zelfde = motor({ maxCenten: 25000 });
  const r = tf.vergelijk({ verzoeken: v, huidig: zelfde, voorstel: zelfde, nu });
  assert.equal(r.anders, 0);
  assert.deepEqual(r.overgangen, []);
  assert.match(r.zin, /0 van de 150/);
});

test('3. de overgangen dragen bedragen en voorbeelden, niet alleen een aantal', () => {
  const v = verzoeken(200, i => (i % 2) ? 5000 : 40000);
  const r = tf.vergelijk({ verzoeken: v, huidig: motor({ maxCenten: 100000 }),
    voorstel: motor({ maxCenten: 25000 }), nu });

  const o = r.overgangen[0];
  assert.equal(o.van, UITKOMST.TOESTAAN);
  assert.equal(o.naar, UITKOMST.BEPERKT);
  assert.equal(o.aantal, 100);
  assert.equal(o.centen, 100 * 40000, 'om hoeveel geld gaat het');
  assert.ok(o.voorbeelden.length > 0 && o.voorbeelden.length <= 5,
    'een getal zonder voorbeelden is niet te beoordelen, alle voorbeelden is een tweede logboek');
  assert.equal(o.voorbeelden[0].waardeCenten, 40000);
});

/* DE TWEEDE BEWERING. "3 van de 12" leest als een percentage terwijl het ruis is. */
test('4. onder de drempel komt er geen getal maar een mededeling', () => {
  const r = tf.vergelijk({ verzoeken: verzoeken(tf.MINIMUM - 1),
    huidig: motor({ maxCenten: 100000 }), voorstel: motor({ maxCenten: 1000 }), nu });

  assert.equal(r.genoeg, false);
  assert.equal(r.anders, null, 'geen aantal');
  assert.equal(r.andersCenten, null, 'geen bedrag');
  assert.equal(r.gevolgen, null, 'en geen gevolgen');
  assert.match(r.zin, /Te weinig geschiedenis/);
  assert.doesNotMatch(r.zin, /%/, 'juist geen percentage: dat is het getal dat te veel vertrouwen krijgt');

  // precies op de drempel telt wel
  assert.equal(tf.vergelijk({ verzoeken: verzoeken(tf.MINIMUM),
    huidig: motor({ maxCenten: 100000 }), voorstel: motor({ maxCenten: 1000 }), nu }).genoeg, true);

  // en een lege geschiedenis geeft geen 0% maar dezelfde mededeling
  const leeg = tf.vergelijk({ verzoeken: [], huidig: motor({ maxCenten: 1 }), voorstel: motor({ maxCenten: 2 }), nu });
  assert.equal(leeg.genoeg, false);
  assert.match(leeg.zin, /0 van de/);
});

/* DE DERDE BEWERING. De vier assen bestaan omdat de lijn van los naar streng
   niet bestaat: is BEPERKT strenger of soepeler dan GOEDKEURING? Dat hangt af
   van wie het vraagt. */
test('5. er wordt geen rangorde verzonnen, maar er zijn wel vier eenduidige assen', () => {
  const v = verzoeken(200, () => 40000);

  // minder geld: dat is "krijgt minder", en niet "gaat niet door"
  const minder = tf.vergelijk({ verzoeken: v, huidig: motor({ maxCenten: 100000 }),
    voorstel: motor({ maxCenten: 25000 }), nu });
  assert.equal(minder.gevolgen.krijgtNuMinder, 200);
  assert.equal(minder.gevolgen.geweigerd, 0, 'BEPERKT is geen weigering');
  assert.match(minder.zin, /krijgen minder dan gevraagd/);

  // een handtekening erbij: dat is "wacht", en ook geen weigering
  const wacht = tf.vergelijk({ verzoeken: v, huidig: motor({ maxCenten: 100000 }),
    voorstel: { ...motor({ maxCenten: 100000 }), beleid: { versie: 'v2', goedkeuringBovenCenten: 30000 } }, nu });
  assert.equal(wacht.gevolgen.wachtNu, 200);
  assert.equal(wacht.gevolgen.geweigerd, 0, 'GOEDKEURING is iets anders dan WEIGEREN');

  // geen bevoegdheid meer: DAT is een weigering
  const weg = tf.vergelijk({ verzoeken: v, huidig: motor({ maxCenten: 100000 }),
    voorstel: { zoekBevoegdheid: () => null }, nu });
  assert.equal(weg.gevolgen.geweigerd, 200);
  assert.match(weg.zin, /worden geweigerd/);

  // en de omgekeerde richting telt op de eigen as
  const terug = tf.vergelijk({ verzoeken: v, huidig: { zoekBevoegdheid: () => null },
    voorstel: motor({ maxCenten: 100000 }), nu });
  assert.equal(terug.gevolgen.toegelaten, 200);
  assert.equal(terug.gevolgen.geweigerd, 0);
});

test('6. een onbeantwoordbare vraag telt apart en verdwijnt niet in "geweigerd"', () => {
  const v = verzoeken(150, () => 1000);
  const stuk = { zoekBevoegdheid: () => { throw new Error('rechtenbron onbereikbaar'); } };
  const r = tf.vergelijk({ verzoeken: v, huidig: motor({ maxCenten: 100000 }), voorstel: stuk, nu });

  assert.equal(r.gevolgen.onbeantwoord, 150);
  assert.equal(r.gevolgen.geweigerd, 0,
    'een storing is geen overtreding -- dat onderscheid mag hier niet verdwijnen');
  assert.ok(r.overgangen.some(o => o.naar === UITKOMST.ONBEKEND));
});

/* DE VIERDE BEWERING. Deze module heeft geen db en geen save, en dat is de
   reden dat ze niets KAN schrijven. */
test('7. een tegenfeit schrijft niets', () => {
  const bron = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'server', 'kern', 'commercie', 'tegenfeit.js'), 'utf8');
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\bsave\s*\(/, 'een tegenfeit dat muteert is geen tegenfeit');
  assert.doesNotMatch(code, /\bdb\./, 'en het hoort de opslag niet eens te kennen');
});

/* De vraag die vandaag op tafel ligt: kan de governance-regel aan? */
test('8. vanuit de schaduw is de vraag "kan deze regel aan", en niet "wat kost het"', () => {
  const db = { data: {} };
  const S = maakSchaduw({ db, save: () => {}, nu });
  S.meld('r1');
  for (let i = 0; i < RIJP.minWaarnemingen + 20; i++)
    S.weeg('r1', i % 4 === 0 ? 'geen abonnement' : null, { wie: 'Z' + i, wat: '/api/x' });

  const r = tf.vanSchaduw(S.stand('r1'));
  assert.equal(r.genoeg, true);
  assert.equal(r.zouTegenhouden, Math.ceil((RIJP.minWaarnemingen + 20) / 4));
  assert.match(r.zin, /Aanzetten raakt/);
  assert.match(r.let, /draagt geen bedrag/,
    'beter dan nul euro melden en het als "geen impact" laten lezen');
  assert.equal(r.magAan, false, 'genoeg waarnemingen, maar de dagen nog niet');
});

test('9. een schaduwregel die nooit iets ophield is niet "veilig", maar zonder bewijs', () => {
  const db = { data: {} };
  const S = maakSchaduw({ db, save: () => {}, nu });
  S.meld('stil');
  for (let i = 0; i < RIJP.minWaarnemingen + 1; i++) S.weeg('stil', null, { wie: 'Z' });

  const r = tf.vanSchaduw(S.stand('stil'));
  assert.equal(r.zouTegenhouden, 0);
  assert.match(r.zin, /geen bewijs dat hij veilig is, maar dat hij niets doet/);

  // en te weinig meegelopen geeft ook hier geen percentage
  S.meld('vers');
  S.weeg('vers', 'iets', { wie: 'Z' });
  const vers = tf.vanSchaduw(S.stand('vers'));
  assert.equal(vers.genoeg, false);
  assert.equal(vers.zouTegenhouden, null);
  assert.equal(vers.deel, null);
  assert.match(vers.zin, /Te weinig meegelopen/);
});
