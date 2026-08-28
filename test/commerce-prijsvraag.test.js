/* DE PRIJSVRAAG -- het werkwoord `prijs` waar het bedrag van een keuze afhangt.

   DE ZWAARSTE TOETS IS 6. Het bedrag komt uit de OPTIE van de server en nooit
   uit het antwoord van de browser. Een prijsvraag die een meegestuurd bedrag
   overneemt, is een prijslijst die de koper zelf mag invullen -- precies wat
   kern/commerce/afrekening.js in zijn kop afwijst, een laag dieper.

   En toets 2: een onvolledig antwoord geeft NOOIT een getal. Half beantwoord
   levert een half bedrag op, en dat is erger dan geen bedrag: er wordt op
   afgerekend en niemand ziet dat er iets mist.

   Draai los: node --test test/commerce-prijsvraag.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../server/kern/commerce/prijsvraag');
const { vanAanbod } = require('../server/kern/commerce/koopbaar');

/* De vorm is overgenomen uit kern/mall/aanbodrtg.js (bronVerblijven) en niet
   zelf bedacht: een fixture die afwijkt van de bron toetst de fixture. */
const VRAAG = () => ({
  eenheid: 'per nacht',
  basis: { id: 'kamer', label: 'Kamer', vraag: 'Welke kamer wilt u', opties: [
    { id: 'r1', label: 'Sea-view suite', centen: 78000 },
    { id: 'r2', label: 'Garden kamer', centen: 52000 }
  ] },
  maal: { id: 'nachten', label: 'Aantal nachten', vraag: 'Hoeveel nachten blijft u',
    min: 1, max: 30, eenheid: 'nacht', eenheidMeervoud: 'nachten' }
});

test('1. een geldige vraag heeft een grondslag met bedragen en een begrensd aantal', () => {
  assert.ok(V.geldig(VRAAG()));
  const zonderOpties = VRAAG(); zonderOpties.basis.opties = [];
  assert.equal(V.geldig(zonderOpties), false);
  const zonderBedrag = VRAAG(); zonderBedrag.basis.opties[0].centen = undefined;
  assert.equal(V.geldig(zonderBedrag), false, 'een optie zonder bedrag maakt de hele vraag onbruikbaar');
  const geenGrens = VRAAG(); geenGrens.maal.max = 10000;
  assert.equal(V.geldig(geenGrens), false, 'boven ' + V.MAX_MAAL + ' is het geen aantal meer');
  const omgekeerd = VRAAG(); omgekeerd.maal.min = 5; omgekeerd.maal.max = 2;
  assert.equal(V.geldig(omgekeerd), false);
  assert.equal(V.geldig(null), false);
});

test('2. een onvolledig antwoord geeft NOOIT een getal, wel een vraag', () => {
  const v = VRAAG();
  for (const a of [{}, { kamer: 'r1' }, { nachten: 3 }, { kamer: 'bestaat-niet', nachten: 3 },
                   { kamer: 'r1', nachten: 0 }, { kamer: 'r1', nachten: 31 },
                   { kamer: 'r1', nachten: 'veel' }]) {
    const uit = V.antwoordCenten(v, a);
    assert.equal(uit.centen, null, JSON.stringify(a) + ' hoort geen bedrag te geven');
    assert.ok(uit.reden && uit.reden.length > 3, 'en wel een reden');
  }
});

test('3. een volledig antwoord geeft het bedrag van de OPTIE maal het aantal', () => {
  const uit = V.antwoordCenten(VRAAG(), { kamer: 'r1', nachten: 3 });
  assert.equal(uit.centen, 234000);
  assert.equal(uit.keuze.label, 'Sea-view suite');
  assert.equal(uit.keuze.centen, 78000);
  assert.equal(uit.aantal, 3);
  assert.equal(uit.uitleg, 'Sea-view suite x 3 nachten');
  /* Enkelvoud en meervoud, want "1 nachten" leest als een fout. */
  assert.equal(V.antwoordCenten(VRAAG(), { kamer: 'r2', nachten: 1 }).uitleg, 'Garden kamer x 1 nacht');
});

test('4. een antwoord als tekst telt ook -- dat is wat een formulier stuurt', () => {
  assert.equal(V.antwoordCenten(VRAAG(), { kamer: 'r1', nachten: '3' }).centen, 234000);
  assert.equal(V.antwoordCenten(VRAAG(), { kamer: 'r1', nachten: '3.9' }).centen, 234000,
    'naar beneden afgerond: drie en een halve nacht bestaat niet');
});

test('5. het beeld naar buiten draagt CENTEN, en de vraagtekst', () => {
  const p = V.publiek(VRAAG());
  assert.equal(p.basis.opties[0].centen, 78000, 'centen en geen euros -- die verwarring is hier al een keer duur geweest');
  assert.equal(p.basis.vraag, 'Welke kamer wilt u');
  assert.equal(p.maal.min, 1);
  assert.equal(p.maal.max, 30);
  assert.equal(V.publiek({ basis: {} }), null, 'een kapotte vraag levert geen half beeld');
});

test('6. het bedrag komt uit de OPTIE en nooit uit het antwoord', () => {
  const v = VRAAG();
  /* Alles wat een browser zou kunnen meesturen om zijn eigen prijs te bepalen: */
  const uit = V.antwoordCenten(v, {
    kamer: 'r1', nachten: 2,
    centen: 1, prijs: 1, bedrag: 1, totaal: 1,
    opties: [{ id: 'r1', centen: 1 }]
  });
  assert.equal(uit.centen, 156000, 'de optie van de server maal het aantal, en verder niets');
});

/* ---- en wat een koopbaar ermee doet ---- */

const RIJ = (o) => Object.assign({
  id: 'verblijf:HOSHI', bron: 'logies', type: 'verblijf', titel: 'Aguamarina Ibiza',
  aanbieder: { soort: 'zaak', code: 'HOSHI', naam: 'Aguamarina Ibiza' },
  prijs: { bedrag: 520, eenheid: 'per nacht', valuta: 'EUR', vanaf: true },
  beschikbaar: { tekst: '2 kamers vrij', hard: true }
}, o || {});

test('7. een vanaf-prijs MET prijsvraag houdt prijs en bevestig', () => {
  /* DIT IS HET PROBLEEM DAT DE PRIJSVRAAG OPLOST. Een verblijf belooft een
     prijs (aanbodvorm.js), dus een kale vanaf-prijs kost hem ZOWEL `prijs` als
     `bevestig`: drie huizen met kamerprijzen ernaast vielen uit de etalage met
     "zet een prijs". */
  const zonder = vanAanbod(RIJ());
  assert.equal(zonder.werkwoorden.includes('prijs'), false, 'een kale vanaf-prijs is geen prijs');
  assert.equal(zonder.werkwoorden.includes('bevestig'), false, 'en sleept de bevestiging mee');

  const met = vanAanbod(RIJ({ prijsAard: 'keuze', prijsvraag: VRAAG() }));
  assert.equal(met.werkwoorden.includes('prijs'), true,
    'het bedrag BESTAAT en hangt van een keuze af -- dat is een prijs, alleen nog niet beantwoord');
  assert.equal(met.werkwoorden.includes('bevestig'), true);
  assert.ok(met.prijsvraag, 'en de vraag reist mee zodat een scherm hem kan stellen');
  assert.equal(met.prijsvraag.basis.opties.length, 2);
});

test('8. een prijsNIVEAU is geen ontbrekende prijs maar een andere soort', () => {
  const niveau = vanAanbod(RIJ({
    id: 'eten:VORA', type: 'eten', titel: 'Vora Beach Club', prijsAard: 'niveau',
    prijs: { bedrag: 14, eenheid: 'per gerecht', valuta: 'EUR', vanaf: true }
  }));
  assert.equal(niveau.werkwoorden.includes('prijs'), false);
  const reden = (niveau.ontbreekt || []).find(o => o.werkwoord === 'prijs');
  assert.match(reden.reden, /prijsniveau/i, '"zet een prijs" zou een ondernemer aan het werk zetten aan iets wat niet bestaat');
  assert.equal(niveau.prijsAard, 'niveau');
  assert.equal(niveau.prijsvraag, null);
});

test('9. een kapotte prijsvraag telt niet mee als prijs', () => {
  const stuk = vanAanbod(RIJ({ prijsAard: 'keuze', prijsvraag: { basis: { id: 'x', opties: [] }, maal: {} } }));
  assert.equal(stuk.werkwoorden.includes('prijs'), false, 'half is hier hetzelfde als niet');
  assert.equal(stuk.prijsvraag, null);
});
