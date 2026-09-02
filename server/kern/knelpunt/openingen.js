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
   Deze laag is er de LEZER van, en de meetuitslag staat in ./openingen-kaart.js.

   TWEE ASSEN, EN ZE ZATEN EEN DAG LANG IN ELKAAR. `stand` beantwoordt alleen de
   vraag of deze mens hier iets kan bereiken (bron / geen-ingang / geen-bron);
   `dektNiet` zegt of wat daar staat de randvoorwaarde ook oplost, en is
   VERPLICHT bij elke bron. Zonder die tweede as leest `bron` als "dit is
   geregeld" -- terwijl een vacature geen inkomen is en een koopwoning geen dak
   boven het hoofd. Zie de kop van ./openingen-kaart.js voor de fout waaruit die
   splitsing volgde; hij staat daar met naam omdat de reparatie anders niet te
   begrijpen is.

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

/* Op welke terreinen ligt deze randvoorwaarde? ALLEMAAL, en dat is een besluit
   dat een echte fout heeft gerepareerd.

   Dit gaf eerst de EERSTE treffer in de volgorde van TERREINEN. Een ronde tegen
   een draaiende server liet zien wat dat doet: *"kunnen reizen naar de
   opleiding"* belandde op `opleiding` (want dat woord staat erin en staat
   eerder in de lijst) en *"een woning waar de kinderen kunnen slapen"* op
   `opvang` (want "kinderen"). Beide keren werd het terrein waar het knelpunt
   werkelijk over ging stil weggegooid, en de mens kreeg een ingang die zijn
   probleem niet raakte.

   De verleiding is dan een slimmere keuze te maken: wegen op woordlengte, of op
   positie in de zin. Dat is dezelfde fout als de afkapgrens uit EXECUTIE.md die
   midden in een GELIJKE score sneed -- willekeur die eruitziet als een oordeel,
   en die een vermogen verbergt zonder dat iemand het merkt. Dus wordt er niet
   gekozen: alle rakende terreinen komen terug, en dat er meer dan een was staat
   in de aannames. Een lege uitkomst is een uitslag en geen fout; zie
   `nietThuisTeBrengen`. */
function terreinenVan(voorwaarde) {
  const t = laag(voorwaarde && voorwaarde.id) + ' ' + laag(voorwaarde && voorwaarde.wat);
  return TERREINEN.filter(terrein => WOORDEN[terrein].some(w => t.includes(w)));
}

/* ---------------------------------------------------------------------------
   De brug. Krijgt de knelpunten zoals ./index.js ze teruggeeft, en zegt per
   knelpunt wat er in dit huis bestaat dat hem zou kunnen opheffen.
   ------------------------------------------------------------------------- */
function voorKnelpunten(knelpunten) {
  const rij = Array.isArray(knelpunten) ? knelpunten : [];
  const nietThuisTeBrengen = [];

  const meerdereTerreinen = [];
  const uit = [];

  for (const k of rij) {
    const knel = k || {};
    const terreinen = terreinenVan(knel);
    if (!terreinen.length) {
      /* Punt 1 in het klein: een knelpunt dat wij niet herkennen verdwijnt niet
         uit de lijst en krijgt ook geen verzonnen terrein. Hij staat er met de
         mededeling dat wij hem niet konden plaatsen. */
      nietThuisTeBrengen.push(knel.wat || knel.id);
      uit.push({ id: knel.id, wat: knel.wat, terrein: null, stand: 'niet-geplaatst',
        ingang: null, plekken: null, wachttijd: null, watErIs: null, dektNiet: null,
        bron: null, zelfDoen: null,
        waarom: 'Wij konden deze randvoorwaarde nergens thuisbrengen. Dat zegt iets over onze ' +
          'woordenlijst en niets over uw knelpunt.' });
      continue;
    }
    if (terreinen.length > 1) meerdereTerreinen.push((knel.wat || knel.id) + ' (' + terreinen.join(', ') + ')');
    /* EEN RIJ PER TERREIN. Er wordt niet gekozen welke de "beste" is; zie de kop
       van terreinenVan(). Dezelfde knelpunt-id kan dus meer dan een keer
       voorkomen, en dat is de bedoeling en geen dubbeling. */
    for (const terrein of terreinen) {
      const kaart = KAART[terrein];
      uit.push({
        id: knel.id, wat: knel.wat, terrein,
        stand: kaart.stand,
        /* Alleen bij een echte bron staat er een ingang, en nergens een aantal
           plekken of een wachttijd: zie punt 4 hierboven. */
        ingang: kaart.stand === 'bron' ? kaart.ingang : null,
        plekken: null, wachttijd: null,
        watErIs: kaart.wat || null,
        /* AS 2, en hij reist MEE met de ingang en staat er nooit los van. Dit is
           de reparatie van 2 september 2026: `bron` beantwoordt alleen de vraag
           of u erbij kunt, en zonder deze zin leest dat als "dit is geregeld". */
        dektNiet: kaart.dektNiet || null,
        waarom: kaart.waarom || null,
        bron: kaart.bron || null,
        zelfDoen: kaart.stand === 'bron' ? ZELF_DOEN : null
      });
    }
  }

  const aannames = [
    'Een randvoorwaarde is op woorden op een terrein gelegd, niet door een model uitgelegd. Dat is ' +
    'na te rekenen en het zit er soms naast; wat wij niet konden plaatsen staat erbij.',
    'Er staat nergens een aantal vrije plekken of een wachttijd. Geen van deze bronnen levert die ' +
    'per opening, en hem alsnog tonen zou hem verzinnen.'
  ];
  if (nietThuisTeBrengen.length) {
    aannames.push('Niet thuisgebracht: ' + nietThuisTeBrengen.slice(0, 8).join(', ') + '.');
  }
  if (meerdereTerreinen.length) {
    aannames.push('Deze randvoorwaarden raken meer dan een terrein, en er is niet gekozen welk ' +
      'terrein het "echte" is: ' + meerdereTerreinen.slice(0, 8).join('; ') + '. Ze staan hieronder ' +
      'dus meer dan een keer.');
  }

  return {
    openingen: uit,
    aannames,
    /* De stand van ELK terrein, ook die waar dit knelpunt niet op ligt. Zonder
       dat blok leest "niets gevonden" als een van de drie standen terwijl het
       er drie kan zijn. */
    terreinen: TERREINEN.map(t => ({ terrein: t, stand: KAART[t].stand,
      waarom: KAART[t].waarom || null, dektNiet: KAART[t].dektNiet || null })),
    grens: 'Dit wijst alleen aan wat er in dit huis bestaat. Er wordt niets aangevraagd, niets ' +
      'gereserveerd en niets beoordeeld: er zit geen enkele geschiktheidstoets in, dus hier komt ' +
      'nooit uit dat iets niets voor u is.'
  };
}

module.exports = { voorKnelpunten, terreinenVan, ZELF_DOEN, TERREINEN, KAART };
