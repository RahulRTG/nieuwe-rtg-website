/* ============================================================================
   DE OPENINGEN -- wat zou dit knelpunt kunnen opheffen, en waar kijken wij
   aantoonbaar niet.

   HDI.md par. 7 regel 6 (laag 6, Opportunity). ./index.js rekent uit WELKE weg
   geblokkeerd is en waardoor; dit bestand stelt de vraag die daarna komt: is er
   in dit huis uberhaupt iets dat die randvoorwaarde zou kunnen opheffen?

   HIJ BOUWT MET OPZET GEEN NIEUW REGISTER. Dat is niet mijn regel maar die van
   kern/stadsweefsel/kansen.js, die precies deze fout een keer heeft vermeden:
   *"het BOUWT MET OPZET GEEN NIEUWE REGISTERS voor dingen die al bestaan"*.
   Vacatures wonen in kern/werk.js, leerpaden in de Beroepen-Bibliotheek,
   kinderopvang in kern/verzorging/opvang.js en woningen in het makelaarsaanbod.
   Deze laag is er de LEZER van, en de meetuitslag staat in ./openingen-kaart.js
   met per terrein de drie standen en de reden erbij.

   WAT DEZE LAAG NOOIT DOET, en alle vier staan ze in HDI.md par. 5:

   1. HIJ TREKT NIETS AF. Er zit geen enkele geschiktheidstoets in -- geen
      leeftijd, geen inkomen, geen postcode, geen "u komt hiervoor niet in
      aanmerking". FOUNDATION.md par. 5.3: een eligibility-motor mag alleen
      toevoegen. Een opening die niet blijkt te passen, hoort de mens te
      ontdekken bij de aanbieder en niet bij ons.
   2. HIJ HANDELT NIET. Er wordt niets aangevraagd, geboekt of gereserveerd.
      COMMERCE.md par. 3 en APPSTORE.md grens 5: alles wat een derde raakt is
      maximaal KLAARZETTEN. Deze laag wijst een bestaande ingang aan; de mens
      loopt er zelf doorheen.
   3. ER KOMT GEEN GETAL OP EEN MENS. Geen match-score, geen rangorde, geen
      plaats op een lijst -- ook niet intern als sorteersleutel (LEVEN.md par.
      2.4, ONTMOETEN.md par. 4).
   4. HIJ VERZINT GEEN BESCHIKBAARHEID. Een aantal plekken of een wachttijd
      staat er alleen als een bron hem noemt. Geen van deze bronnen doet dat per
      opening, dus staat er `null` -- en `null` leest als "niet nagegaan" en
      nooit als vol of leeg.

   GEEN OPSLAG. Alles komt binnen als argument, net als ./index.js, en om
   dezelfde reden: zonder database uit te rekenen is zonder database te toetsen.
   ========================================================================== */
'use strict';

const { TERREINEN, WOORDEN, KAART } = require('./openingen-kaart');

/* De vaste zin die bij ELKE bruikbare opening hoort. Punt 2 hierboven, in het
   antwoord zelf en niet alleen in dit bestand: een lezer die de ingang voor een
   aanvraag aanziet, doet dat anders alsnog. */
const ZELF_DOEN = 'RTG vraagt hier niets voor u aan en reserveert niets. Dit is de ingang; de stap ' +
  'ernaartoe zet u zelf.';

const laag = (v) => String(v == null ? '' : v).toLowerCase();

/* Op welk terrein ligt deze randvoorwaarde? Geeft `null` als geen enkel woord
   matcht -- en dat is een uitslag en geen fout; zie `nietThuisTeBrengen`. */
function terreinVan(voorwaarde) {
  const t = laag(voorwaarde && voorwaarde.id) + ' ' + laag(voorwaarde && voorwaarde.wat);
  for (const terrein of TERREINEN) {
    if (WOORDEN[terrein].some(w => t.includes(w))) return terrein;
  }
  return null;
}

/* ---------------------------------------------------------------------------
   De brug. Krijgt de knelpunten zoals ./index.js ze teruggeeft, en zegt per
   knelpunt wat er in dit huis bestaat dat hem zou kunnen opheffen.
   ------------------------------------------------------------------------- */
function voorKnelpunten(knelpunten) {
  const rij = Array.isArray(knelpunten) ? knelpunten : [];
  const nietThuisTeBrengen = [];

  const uit = rij.map(k => {
    const knel = k || {};
    const terrein = terreinVan(knel);
    if (!terrein) {
      /* Punt 1 in het klein: een knelpunt dat wij niet herkennen verdwijnt niet
         uit de lijst en krijgt ook geen verzonnen terrein. Hij staat er met de
         mededeling dat wij hem niet konden plaatsen. */
      nietThuisTeBrengen.push(knel.wat || knel.id);
      return { id: knel.id, wat: knel.wat, terrein: null, stand: 'niet-geplaatst',
        ingang: null, plekken: null, wachttijd: null, watErIs: null, bron: null, zelfDoen: null,
        waarom: 'Wij konden deze randvoorwaarde nergens thuisbrengen. Dat zegt iets over onze ' +
          'woordenlijst en niets over uw knelpunt.' };
    }
    const kaart = KAART[terrein];
    return {
      id: knel.id, wat: knel.wat, terrein,
      stand: kaart.stand,
      /* Alleen bij een echte bron staat er een ingang, en nergens een aantal
         plekken of een wachttijd: zie punt 4 hierboven. */
      ingang: kaart.stand === 'bron' ? kaart.ingang : null,
      plekken: null, wachttijd: null,
      watErIs: kaart.wat || null,
      waarom: kaart.waarom || null,
      bron: kaart.bron || null,
      zelfDoen: kaart.stand === 'bron' ? ZELF_DOEN : null
    };
  });

  const aannames = [
    'Een randvoorwaarde is op woorden op een terrein gelegd, niet door een model uitgelegd. Dat is ' +
    'na te rekenen en het zit er soms naast; wat wij niet konden plaatsen staat erbij.',
    'Er staat nergens een aantal vrije plekken of een wachttijd. Geen van deze bronnen levert die ' +
    'per opening, en hem alsnog tonen zou hem verzinnen.'
  ];
  if (nietThuisTeBrengen.length) {
    aannames.push('Niet thuisgebracht: ' + nietThuisTeBrengen.slice(0, 8).join(', ') + '.');
  }

  return {
    openingen: uit,
    aannames,
    /* De stand van ELK terrein, ook die waar dit knelpunt niet op ligt. Zonder
       dat blok leest "niets gevonden" als een van de drie standen terwijl het
       er drie kan zijn. */
    terreinen: TERREINEN.map(t => ({ terrein: t, stand: KAART[t].stand, waarom: KAART[t].waarom || null })),
    grens: 'Dit wijst alleen aan wat er in dit huis bestaat. Er wordt niets aangevraagd, niets ' +
      'gereserveerd en niets beoordeeld: er zit geen enkele geschiktheidstoets in, dus hier komt ' +
      'nooit uit dat iets niets voor u is.'
  };
}

module.exports = { voorKnelpunten, terreinVan, ZELF_DOEN, TERREINEN, KAART };
