/* ============================================================================
   DE LEDENPRIJSGARANTIE: het plafond bestond, de rechtzetting niet.

   De garantie was voor de helft echt gebouwd -- de ledenprijs wordt server-side
   afgekapt op de publieke prijs (test/partner.test.js bewaakt dat). Maar de
   voorwaarden beloven meer: "meld het via de app: de partner past de prijs aan
   en het verschil wordt voor u rechtgezet." Er was geen meldknop en geen
   terugbetaalstroom (PRIJZEN.md 4.11).

   Het plafond vangt alleen wat RTG KAN ZIEN. Wat het niet ziet: dat de zaak op
   haar eigen website of op het bord aan de deur iets anders vraagt. Daarvoor is
   de melding.

   DE BEWERING DIE ERTOE DOET staat in toets 5: het bedrag dat rechtgezet wordt,
   komt uit de melding en niet van de aanroeper. Wie hier een bedrag mag
   meegeven, kan een verschil van 2 euro voor 200 euro rechtzetten.

   Draai los: node --experimental-sqlite --test test/prijsmelding.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakPrijsmeldingen, STATUS, magOvergaan } = require('../server/kern/commercie/prijsmelding');

function verse() {
  const db = { data: {} };
  return maakPrijsmeldingen({ db, save: () => {}, nu: () => 1000 });
}
const melding = (p, extra) => p.meld({ codenaam: 'Anemoon', supplierCode: 'kikunoi',
  omschrijving: 'Tonkotsu Ramen', betaaldCenten: 2200, gezienCenten: 1900, ...(extra || {}) });

test('1. een lid meldt een lagere prijs, en het verschil staat vast', () => {
  const p = verse();
  const r = melding(p);
  assert.equal(r.status, 200);
  assert.equal(r.melding.verschil, 3, '22,00 tegen 19,00 is 3,00 verschil');
  assert.equal(r.melding.status, STATUS.GEMELD, 'de zaak is aan zet');
  assert.equal(r.melding.supplierCode, 'KIKUNOI', 'de code wordt genormaliseerd');
});

test('2. een melding zonder verschil wordt geweigerd', () => {
  const p = verse();
  assert.equal(melding(p, { gezienCenten: 2200 }).status, 400, 'gelijk is geen verschil');
  assert.equal(melding(p, { gezienCenten: 2500 }).status, 400, 'hoger al helemaal niet');
  assert.match(melding(p, { gezienCenten: 2500 }).error, /niet lager/);
  assert.equal(melding(p, { codenaam: null }).status, 400, 'een melding hoort bij een lid');
  assert.equal(melding(p, { supplierCode: null }).status, 400);
});

test('3. de zaak erkent, en dan pas kan er worden rechtgezet', () => {
  const p = verse();
  const id = melding(p).melding.id;

  /* Rechtstreeks rechtzetten vanuit GEMELD kan niet: er hoort altijd een moment
     te zijn waarop iemand zegt "dit klopt". */
  assert.equal(p.zetRecht(id).status, 409, 'er is nog niets erkend');

  assert.equal(p.erken(id, 'Kikunoi', 1900).status, 200);
  const r = p.zetRecht(id, 'verrekening-1');
  assert.equal(r.status, 200);
  assert.equal(r.melding.status, STATUS.RECHTGEZET);
  assert.equal(r.melding.rechtgezet, 3);
});

test('4. betwisten vraagt een reden, en gaat niet rechtstreeks naar rechtgezet', () => {
  const p = verse();
  const id = melding(p).melding.id;
  assert.equal(p.betwist(id, 'Kikunoi').status, 400, 'zonder reden kan niemand er iets mee');
  assert.equal(p.betwist(id, 'Kikunoi', 'De prijs op ons bord is 22,00').status, 200);
  assert.equal(p.zetRecht(id).status, 409,
    'een betwisting wordt eerst erkend of afgewezen; er is geen sluiproute');

  // een mens van RTG kan er alsnog uitkomen
  assert.equal(p.erken(id, 'RTG-balie', 1900).status, 200);
  assert.equal(p.zetRecht(id).status, 200);
});

/* DE BEWERING. Het bedrag ligt vast op het moment van melden. */
test('5. het rechtgezette bedrag komt uit de melding, niet van de aanroeper', () => {
  const p = verse();
  const id = melding(p).melding.id;
  p.erken(id, 'Kikunoi');
  // zetRecht neemt geen bedrag aan; het tweede argument is een referentie
  const r = p.zetRecht(id, 99999);
  assert.equal(r.melding.rechtgezet, 3,
    'wie hier een bedrag mag meegeven, zet een verschil van 3 euro voor 999 euro recht');
  assert.equal(p.vind(id).verrekenRef, 99999, 'het tweede argument is alleen een verwijzing');
});

test('6. de statusmachine weigert een sprong die niet mag', () => {
  assert.equal(magOvergaan(STATUS.GEMELD, STATUS.RECHTGEZET), false);
  assert.equal(magOvergaan(STATUS.BETWIST, STATUS.RECHTGEZET), false);
  assert.equal(magOvergaan(STATUS.ERKEND, STATUS.RECHTGEZET), true);
  assert.equal(magOvergaan(STATUS.RECHTGEZET, STATUS.GEMELD), false, 'rechtgezet is een eindstand');
  assert.equal(magOvergaan(STATUS.AFGEWEZEN, STATUS.ERKEND), false);
});

test('7. afwijzen vraagt een reden, want het lid krijgt hem te lezen', () => {
  const p = verse();
  const id = melding(p).melding.id;
  assert.equal(p.wijsAf(id, 'RTG-balie').status, 400);
  const r = p.wijsAf(id, 'RTG-balie', 'De genoemde prijs gold op een ander moment.');
  assert.equal(r.status, 200);
  assert.equal(r.melding.status, STATUS.AFGEWEZEN);
  assert.match(r.melding.reden, /ander moment/);
});

test('8. de stand telt wat er openstaat en wat er is rechtgezet', () => {
  const p = verse();
  const een = melding(p).melding.id;
  melding(p, { betaaldCenten: 5000, gezienCenten: 4500 });
  p.erken(een, 'Kikunoi'); p.zetRecht(een);

  const s = p.stand('KIKUNOI');
  assert.equal(s.aantal, 2);
  assert.equal(s.open, 1, 'de tweede wacht nog op de zaak');
  assert.equal(s.openCenten, 500);
  assert.equal(s.rechtgezetCenten, 300);
});

test('9. een lid ziet alleen zijn eigen meldingen', () => {
  const p = verse();
  melding(p);
  p.meld({ codenaam: 'Berkenhout', supplierCode: 'KIKUNOI', omschrijving: 'x',
    betaaldCenten: 1000, gezienCenten: 800 });
  assert.equal(p.lijst({ codenaam: 'Anemoon' }).length, 1);
  assert.equal(p.lijst({ supplierCode: 'kikunoi' }).length, 2, 'de zaak ziet ze allebei');
  assert.equal(p.lijst({ open: true }).length, 2);
});

/* Wat deze laag NIET is, en dat is een besluit en geen omissie. */
test('10. er wordt niets automatisch beoordeeld en niets automatisch overgemaakt', () => {
  const p = verse();
  const r = melding(p);
  assert.equal(r.melding.status, STATUS.GEMELD,
    'een melding is een bewering over een prijs die RTG niet kan waarnemen; ' +
    'automatisch terugbetalen zou van elke melding een knop maken');

  const bron = require('fs').readFileSync(require.resolve('../server/kern/commercie/prijsmelding.js'), 'utf8');
  const requires = bron.match(/require\(['"][^'"]+['"]\)/g) || [];
  assert.deepEqual(requires, [],
    'deze laag hoort geen grootboek en geen betaal-naad te kennen: zij legt een verplichting vast, ' +
    'wat er echt beweegt weet het grootboek');
});
