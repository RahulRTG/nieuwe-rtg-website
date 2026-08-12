/* EEN VERLOREN ANTWOORD MAG GEEN TWEEDE AFSCHRIJVING WORDEN -- EN TWEE ECHTE
   OPDRACHTEN MOGEN NIET STIL SAMENVALLEN.

   WAAROM DEZE TOETS BESTAAT NAAST sleutelvorm.test.js. Die bewijst dat twee
   schrijfwijzen dezelfde SLEUTEL opleveren, en dat de tweede aanroep hetzelfde
   id teruggeeft. Dat is niet hetzelfde als bewijzen dat er precies EEN duurzame
   mutatie is ontstaan: een implementatie die netjes hetzelfde id teruggeeft en
   ondertussen tweemaal wegschrijft, komt daar gewoon doorheen. Wat je wil weten
   is hoe vaak er ECHT iets is vastgelegd, en dat meet je alleen door te tellen.

   Daarom hangt hier een telstore onder betaal.js (koppelStore): elke schrijf-
   actie wordt geteld en bewaard. Wat we daarmee aantonen is de idempotentie van
   de betaallaag. Wat we hiermee NIET aantonen -- en dat hoort erbij -- is het
   grootboek als geheel: saldi, tegenboekingen en de muntketen hebben hun eigen
   toetsen (balans, geld-conservatie-last). Deze toets gaat over de plek waar de
   sleutel de beslissing neemt.

   DE TWEE KANTEN, EN ZE ZIJN ALLEBEI NODIG.

   1. HET VERLOREN ANTWOORD. De client betaalt, het antwoord komt niet aan, de
      client probeert opnieuw -- en bouwt zijn sleutel net iets anders op
      (" abc " in plaats van "abc", want er zat witruimte in een formulierveld).
      Precies waarvoor idempotentie bestaat. Eis: EEN entry, EEN mutatie, en een
      antwoord dat inhoudelijk gelijk is aan het eerste.

   2. DE NEGATIEVE SPIEGEL, en die is minstens zo belangrijk. "aB" en "Ab" zijn
      TWEE legitieme opdrachten. Zou de canonisatie te gretig zijn (case vouwen),
      dan wordt de tweede stilzwijgend als herhaling gezien en gebeurt hij NIET.
      Dat is geld dat niet aankomt, zonder foutmelding. Een dubbele afschrijving
      valt op; een betaling die stil verdwijnt niet.

   Zonder allebei de kanten bewijs je alleen dat canonisatie WERKT, niet dat ze
   niet te ver gaat. Over-deduplicatie is de duurdere fout van de twee.

   Gemuteerd en zien zakken: de trim() uit canoniekeSleutel halen (kant 1 rood:
   twee entries), en er een toLowerCase() bij zetten (kant 2 rood: een entry in
   plaats van twee).
   Draai los: node --test test/retrygedrag.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const betaal = require('../server/betaal.js');

/* Een store die telt hoe vaak er ECHT iets duurzaams wordt weggeschreven. Het
   tellen is het punt: een gelijk id in het antwoord zegt niets over hoe vaak er
   is vastgelegd. */
function telStore() {
  const kast = new Map();
  const schrijfacties = [];
  betaal.koppelStore({
    get: (k) => kast.get(k),
    set: (k, v) => { schrijfacties.push({ sleutel: k, waarde: v }); kast.set(k, v); }
  });
  return { kast, schrijfacties };
}

test('een retry met andere witruimte levert EEN mutatie en EEN entry op', async () => {
  const store = telStore();
  const bedrag = 2500;

  const eerste = await betaal.maakBetaling({ bedrag, idempotentieSleutel: 'retry:verloren:1' });
  // het antwoord gaat verloren; de client probeert opnieuw en bouwt de sleutel
  // net iets anders op -- witruimte uit een formulierveld
  const tweede = await betaal.maakBetaling({ bedrag, idempotentieSleutel: '  retry:verloren:1  ' });

  assert.equal(store.schrijfacties.length, 1,
    'er mag PRECIES EEN duurzame entry ontstaan; ' + store.schrijfacties.length +
    ' betekent dat de retry een tweede keer is vastgelegd');
  assert.equal(store.kast.size, 1, 'en er staat maar een sleutel in de kast, niet twee');

  assert.equal(tweede.herhaald, true, 'de tweede aanroep wordt als herhaling herkend');
  // het antwoord is inhoudelijk gelijk: alleen de herhaald-vlag mag verschillen
  const zonderVlag = (o) => { const k = Object.assign({}, o); delete k.herhaald; return k; };
  assert.deepEqual(zonderVlag(tweede), zonderVlag(eerste),
    'de client hoort exact hetzelfde antwoord te krijgen, anders weet hij nog steeds niet wat er gebeurd is');
});

test('twee legitieme opdrachten die alleen in hoofdletters verschillen, worden ALLEBEI uitgevoerd', async () => {
  const store = telStore();
  const bedrag = 700;

  const een = await betaal.maakBetaling({ bedrag, idempotentieSleutel: 'opdracht:aB' });
  const twee = await betaal.maakBetaling({ bedrag, idempotentieSleutel: 'opdracht:Ab' });

  assert.equal(store.schrijfacties.length, 2,
    'dit zijn twee verschillende opdrachten; ' + store.schrijfacties.length +
    ' entry betekent dat er een betaling stilzwijgend is verdwenen');
  assert.notEqual(twee.id, een.id, 'en ze krijgen elk een eigen betaling');
  assert.ok(!twee.herhaald, 'de tweede is geen herhaling en mag ook niet zo worden gemeld');
  assert.equal(new Set(store.schrijfacties.map(s => s.sleutel)).size, 2,
    'twee opdrachten horen onder twee sleutels vastgelegd te worden');
});

test('een derde poging op dezelfde sleutel voegt nog steeds niets toe', async () => {
  const store = telStore();
  const bedrag = 100;
  await betaal.maakBetaling({ bedrag, idempotentieSleutel: 'retry:drie' });
  await betaal.maakBetaling({ bedrag, idempotentieSleutel: 'retry:drie ' });
  await betaal.maakBetaling({ bedrag, idempotentieSleutel: '\tretry:drie\n' });
  assert.equal(store.schrijfacties.length, 1,
    'idempotent betekent onbeperkt herhaalbaar, niet een keer vergeeflijk');
});

test('een uitbetaling is even idempotent als een betaling', async () => {
  const store = telStore();
  const opdracht = { bedrag: 5000, iban: 'NL02ABNA0123456789', begunstigde: 'Proef' };
  const eerste = await betaal.maakUitbetaling(Object.assign({ idempotentieSleutel: 'uitbetaling:1' }, opdracht));
  const tweede = await betaal.maakUitbetaling(Object.assign({ idempotentieSleutel: ' uitbetaling:1 ' }, opdracht));
  assert.equal(store.schrijfacties.length, 1,
    'geld naar buiten is de richting waar een dubbele mutatie niet terug te draaien is');
  assert.equal(tweede.id, eerste.id);
  assert.equal(tweede.herhaald, true);
});
