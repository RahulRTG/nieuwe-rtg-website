/* ============================================================================
   HET CONTRACT: maand 13, en de prijs die vaststaat.

   kern/aanmeldingen/betaalschema.js zette twaalf termijnen klaar en hield op.
   Geen maand 13, geen verlenging, geen opzegging, geen opzegtermijn -- een
   lidmaatschap liep administratief af zonder dat iemand het besloot.

   De oplossing is niet "genereer meer termijnen", want dan verhuist het
   probleem naar maand 25. De billing engine vraagt per datum of er een geldige
   betalingsverplichting is, en maakt dan pas een termijn.

   DE TWEE BEWERINGEN DIE ERTOE DOEN:

     toets 5  maand 13 bestaat als het contract verlengd is, en NIET als het is
              opgezegd
     toets 8  een prijswijziging raakt een lopend contract niet -- de afgesproken
              prijs is een momentopname en wordt nooit opnieuw uit de catalogus
              gehaald (besluit 20 augustus 2026, COMMERCIE.md 3b)

   Draai los: node --experimental-sqlite --test test/contract.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakContracten, STATUS, magOvergaan, plusMaanden } = require('../server/kern/commercie/contract');

const START = '2026-01-15T10:00:00.000Z';
function verse() {
  const db = { data: {} };
  return maakContracten({ db, save: () => {}, nu: () => Date.parse(START) });
}
function actief(c, opties) {
  const k = c.open({ pas: 'rtg', naam: 'Lid', startAt: START, afgesprokenCenten: 6500, ...(opties || {}) });
  c.bied(k); c.accepteer(k); c.activeer(k);
  return k;
}

test('1. een contract loopt van CONCEPT naar ACTIEF, en niet in een keer', () => {
  const c = verse();
  const k = c.open({ pas: 'rtg', startAt: START, afgesprokenCenten: 6500 });
  assert.equal(k.status, STATUS.CONCEPT);
  assert.ok(c.activeer(k).error, 'een concept kan niet meteen actief worden');
  c.bied(k);
  assert.equal(k.status, STATUS.AANGEBODEN);
  c.accepteer(k);
  assert.equal(k.status, STATUS.GEACCEPTEERD);
  assert.ok(c.activeer(k).ok);
  assert.equal(k.status, STATUS.ACTIEF);
});

/* De grendel die voorkomt dat er ooit nog een lidmaatschap loopt waarvan
   niemand weet wat het kost. */
test('2. een contract zonder afgesproken bedrag wordt niet actief', () => {
  const c = verse();
  const k = c.open({ pas: 'business', startAt: START, afgesprokenCenten: null });
  c.bied(k);
  assert.ok(c.accepteer(k).error, 'accepteren zonder bedrag kan niet');
  assert.ok(c.activeer(k).error, 'en actief worden al helemaal niet');
  assert.equal(k.status, STATUS.AANGEBODEN, 'de stand is niet stiekem opgeschoven');

  /* De grendel in activeer() apart, want langs de normale weg is hij
     ONBEREIKBAAR: de statusmachine houdt AANGEBODEN -> ACTIEF al tegen, dus een
     mutatie die de bedragcontrole weghaalt liet alles groen. Een grendel die
     geen enkele toets kan laten zakken, bewaakt niets (LAT.md regel 10).

     Hier wordt de enige stand nagebootst waarin hij WEL het verschil maakt: een
     contract dat GEACCEPTEERD is en waarvan het bedrag daarna is kwijtgeraakt --
     door een migratie, een handmatige ingreep of een latere fout. Dan hoort
     actief worden te weigeren in plaats van een lidmaatschap te starten waarvan
     niemand weet wat het kost. */
  const stuk = c.open({ pas: 'business', startAt: START, afgesprokenCenten: 500000 });
  c.bied(stuk); c.accepteer(stuk);
  stuk.afgesprokenCenten = null;
  const r = c.activeer(stuk);
  assert.ok(r.error, 'zonder bedrag hoort actief worden te weigeren');
  assert.match(r.error, /afgesproken bedrag/);
  assert.equal(stuk.status, STATUS.GEACCEPTEERD, 'en de stand blijft staan');
});

test('3. een verbintenis van twaalf maanden geeft twaalf termijnen, niet dertien', () => {
  const c = verse();
  const k = actief(c);
  const t = c.termijnenTussen(k, k.startAt, c.eindeVerbintenis(k));
  assert.equal(t.length, 12,
    'start + 12 maanden is het BEGIN van maand 13 en hoort er niet bij');
  assert.equal(t[0].vervalt, START, 'de eerste termijn valt op de startdatum');
  assert.equal(t[11].vervalt, plusMaanden(START, 11), 'en de laatste elf maanden later');
  assert.equal(t[0].centen, 6500);
});

test('4. de billing engine antwoordt per datum, met de reden als het nee is', () => {
  const c = verse();
  const k = actief(c);
  const ja = c.verplichtingOp(k, plusMaanden(START, 3));
  assert.equal(ja.verschuldigd, true);
  assert.equal(ja.centen, 6500);
  assert.equal(ja.termijn, 4);

  assert.equal(c.verplichtingOp(k, '2025-12-01T10:00:00.000Z').reden, 'voor de startdatum');
  assert.equal(c.verplichtingOp(k, '2026-02-20T10:00:00.000Z').reden, 'geen termijndatum',
    '"er is niets" en "we weten het niet" zijn niet hetzelfde');
  const concept = c.open({ pas: 'rtg', startAt: START, afgesprokenCenten: 6500 });
  assert.match(c.verplichtingOp(concept, START).reden, /CONCEPT/);
});

/* DE BEWERING. Maand 13 bestaat als het contract verlengd is -- en niet als het
   is opgezegd. Dat was voorheen niet uit te drukken. */
test('5. maand 13 bestaat na verlengen, en niet na opzeggen', () => {
  const c = verse();
  const k = actief(c);
  const maand13 = plusMaanden(START, 12);

  assert.equal(c.verplichtingOp(k, maand13).verschuldigd, false,
    'binnen de eerste verbintenis is maand 13 er nog niet');

  c.verlengbaar(k);
  c.verleng(k);
  assert.equal(k.status, STATUS.ACTIEF, 'verlengen zet hem terug op actief');
  assert.equal(k.periode, 2);
  assert.equal(c.verplichtingOp(k, maand13).verschuldigd, true, 'en NU bestaat maand 13');
  assert.equal(c.termijnenTussen(k, k.startAt, c.eindeVerbintenis(k)).length, 24,
    'twee periodes van twaalf');

  // en het andere pad: opzeggen laat maand 13 juist niet ontstaan
  const c2 = verse();
  const k2 = actief(c2);
  c2.zegOp(k2, plusMaanden(START, 6));
  assert.equal(k2.status, STATUS.OPZEGGEND);
  assert.equal(c2.verplichtingOp(k2, maand13).reden, 'na de einddatum');
});

test('6. opzeggen kan de minimumtermijn niet inkorten', () => {
  const c = verse();
  const k = actief(c);
  // opzeggen in maand 2, met een opzegtermijn van een maand
  c.zegOp(k, plusMaanden(START, 1));
  assert.equal(k.eindigtOp, plusMaanden(START, 12),
    'de einddatum is het einde van de verbintenis, niet een maand na de opzegging');
  assert.equal(c.termijnenTussen(k, k.startAt, c.eindeVerbintenis(k)).length, 12,
    'alle twaalf termijnen blijven verschuldigd');
});

test('7. laat opzeggen laat de opzegtermijn gelden, niet de minimumtermijn', () => {
  const c = verse();
  const k = actief(c, { opzegMaanden: 2 });
  c.zegOp(k, plusMaanden(START, 11));         // in maand 12 opzeggen
  assert.equal(k.eindigtOp, plusMaanden(START, 13),
    'twee maanden na de opzegging, want dat ligt na het einde van de verbintenis');
});

/* DE TWEEDE BEWERING. Besluit van 20 augustus 2026: een prijswijziging raakt
   nooit een lopend contract. */
test('8. de afgesproken prijs is een momentopname en verandert niet mee', () => {
  const c = verse();
  const k = actief(c);
  assert.equal(k.prijsVastTot, plusMaanden(START, 12), 'vast tot het einde van de verbintenis');

  /* Er is geen enkele functie die de prijs van een lopend contract herziet: de
     catalogus wordt hier niet gelezen, en `verleng` is het enige moment waarop
     het bedrag mag veranderen. Dat is de hele bescherming. */
  /* Niet "geen enkele require" -- dat was te grof, en het hield ook de tijdmachine
     tegen (server/lib/klok.js), die juist een huisregel is. De bewering die telt
     is smaller: dit bestand mag de PRIJSLAAG niet kennen. Wie pasprijs of
     pasladder hier binnenhaalt, laat een boardroom-klik landen op een contract
     dat al getekend is. */
  const bron = require('fs').readFileSync(require.resolve('../server/kern/commercie/contract.js'), 'utf8');
  const requires = (bron.match(/require\(['"]([^'"]+)['"]\)/g) || []);
  const verboden = requires.filter(r => /pasprijs|pasladder|geldregie|catalogus/.test(r));
  assert.deepEqual(verboden, [], 'de prijslaag hoort hier niet binnen te komen: ' + verboden.join(', '));

  const teller = c.termijnenTussen(k, k.startAt, c.eindeVerbintenis(k));
  assert.ok(teller.every(t => t.centen === 6500), 'elke termijn draagt het afgesproken bedrag');

  // en bij verlengen MAG hij veranderen -- dat is het enige moment
  c.verlengbaar(k); c.verleng(k, 7500);
  assert.equal(k.afgesprokenCenten, 7500);
  assert.equal(k.prijsVastTot, plusMaanden(START, 24), 'en dan schuift de vaste periode mee');
  const na = c.termijnenTussen(k, plusMaanden(START, 12), c.eindeVerbintenis(k));
  assert.ok(na.every(t => t.centen === 7500), 'de nieuwe periode draagt het nieuwe bedrag');
});

test('9. de statusmachine weigert een sprong die niet mag', () => {
  assert.equal(magOvergaan(STATUS.ACTIEF, STATUS.VERLENGBAAR), true);
  assert.equal(magOvergaan(STATUS.GEEINDIGD, STATUS.ACTIEF), false, 'geeindigd is een eindstand');
  assert.equal(magOvergaan(STATUS.CONCEPT, STATUS.ACTIEF), false, 'niet in een keer van concept naar actief');
  assert.equal(magOvergaan(STATUS.OPZEGGEND, STATUS.ACTIEF), false, 'een opzegging draai je niet stil terug');

  const c = verse();
  const k = actief(c);
  c.beeindig(k);
  const weer = c.verleng(k);
  assert.ok(weer.error, 'en de weigering komt als fout terug');
  assert.equal(k.status, STATUS.GEEINDIGD);
});

test('10. een contract dat niet verlengt, verlengt ook echt niet', () => {
  const c = verse();
  const k = actief(c, { verlenging: 'geen' });
  c.verlengbaar(k);
  const r = c.verleng(k);
  assert.ok(r.error);
  assert.match(r.error, /eindigt op de afgesproken datum/);
});

/* Een maandbijdrage die op de 31e begint, hoort in februari niet op 3 maart te
   vallen. Dit is de reden dat er met maanden wordt gerekend en niet met dagen. */
test('11. maandrekenen klemt op de laatste dag van de maand', () => {
  assert.equal(plusMaanden('2026-01-31T10:00:00.000Z', 1).slice(0, 10), '2026-02-28');
  assert.equal(plusMaanden('2028-01-31T10:00:00.000Z', 1).slice(0, 10), '2028-02-29', 'schrikkeljaar');
  assert.equal(plusMaanden('2026-01-31T10:00:00.000Z', 3).slice(0, 10), '2026-04-30');
  assert.equal(plusMaanden('2026-01-15T10:00:00.000Z', 12).slice(0, 10), '2027-01-15');
});

test('12. verlooptBinnen vindt de contracten waar iets moet gebeuren', () => {
  const c = verse();
  const k = actief(c);
  assert.equal(c.verlooptBinnen(30, START).length, 0, 'aan het begin nog niet');
  /* 45 en niet 30: tussen 15 december en 15 januari zitten 31 dagen, dus een
     venster van precies 30 valt er een dag naast. Dat is geen fout in de code
     maar een randgeval in de toets -- en het is de reden dat een
     herinneringsronde ruimer moet kijken dan de kalendermaand suggereert. */
  const bijna = c.verlooptBinnen(45, plusMaanden(START, 11));
  assert.equal(bijna.length, 1, 'een maand voor het einde van de verbintenis wel');
  assert.equal(bijna[0].id, k.id);
  assert.equal(c.verlooptBinnen(5, plusMaanden(START, 11)).length, 0,
    'en een venster van vijf dagen vindt hem nog niet');
});
