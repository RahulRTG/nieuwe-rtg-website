/* WELKE METER IS TEGEN WELKE BEKENDE WAARHEID GEIJKT?

   LAT.md regel 13: een meter die uitspraken doet over onbekend terrein wordt
   eerst geijkt tegen beschikbare bekende waarheid. Is er geen grondwaarheid,
   dan zegt de meter dat expliciet en beperkt hij zijn conclusies tot wat hij
   werkelijk heeft waargenomen.

   Dit bestand is de inventaris die dat naloopbaar maakt, en het is met opzet
   GEEN berekening: welke bron als grondwaarheid mag gelden, is een oordeel.
   Dezelfde vorm als WETTEN.json en scripts/lib/metingen.js.

   PER METER DRIE DINGEN:

     grondwaarheid  het register of de bron waartegen geijkt wordt, of GEEN,
                    of ONBEPAALD (niemand heeft het vastgelegd -- dat is een
                    stand en geen leeg veld).
     reden          verplicht bij GEEN en bij ONBEPAALD. Zonder reden is een
                    ontbrekende ijking niet te onderscheiden van vergeten.
     claim          wat deze meter mag beweren:
                      'waarneming'  alleen "ik vond er N" -- geen dekking
                      'dekking'     mag over recall of volledigheid spreken,
                                    en dat MAG alleen met een grondwaarheid.

   WAAROM ONBEPAALD BESTAAT EN NIET STIL WORDT WEGGELATEN. Toen deze regel werd
   geschreven droegen twaalf registers in de wortel een dekkings- of
   recallachtig getal. Twee daarvan zijn hier gebouwd en dus te verantwoorden;
   van de tien andere weet de schrijver van dit bestand niet genoeg om een
   grondwaarheid te VERZINNEN, en dat zou precies de fout zijn die regel 13
   verbiedt. Ze staan er dus als ONBEPAALD in, met de vraag die beantwoord moet
   worden. Het aantal hoort te dalen doordat er geijkt wordt, niet doordat er
   regels verdwijnen -- test/meterwet.test.js houdt die vloer vast.

   NIEUW WERK STAAT OP DE NORM. Een register dat een dekkingsclaim draagt en
   hier NIET in staat, laat de toets meteen zakken. Dat is de enige harde kant
   van deze wet, en hij is bewust hard: de tien ONBEPAALD zijn historie, een
   elfde is een keuze. */
'use strict';

/* De vraagvorm voor een meter die nog niet geijkt is. Staat hier een keer, zodat
   tien regels niet tien formuleringen van dezelfde onzekerheid worden. */
const NOGNIET = (vraag) => 'niemand heeft vastgelegd waartegen deze meter te ijken is; ' + vraag;

const METERS = {
  /* -------------------------------------------------- hier gebouwd en geijkt */

  'DOCTRINE.json': {
    grondwaarheid: 'WETTEN.json',
    hoe: 'elke wet wijst een plek aan waar een mens heeft vastgesteld dat er een harde uitspraak staat; ' +
      'vindt de extractor daar niets, dan is hij blind voor een bekende wet',
    ijkveld: 'ijking',
    claim: 'dekking',
  },
  'VERBAND.json': {
    grondwaarheid: 'WETTEN.json',
    hoe: 'het veld `handhaver` verklaart welke wachter bij welke wet hoort; geen enkele sensor leest dat ' +
      'veld, dus de recall is een echte reconstructie en geen echo',
    ijkveld: 'sensoren',
    claim: 'dekking',
  },

  /* ------------------------------------- dragen een dekkingsgetal, niet geijkt */

  'APPWERKT.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    reden: NOGNIET('bestaat er een lijst functies waarvan met de hand is vastgesteld dat ze werken?') },
  'EXECUTION_MAP.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    reden: NOGNIET('de kaart is een projectie van vier bronnen; welke daarvan geldt als waarheid voor bereik?') },
  'HERSTEL.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    reden: NOGNIET('HERSTELPROEF.json beproeft paren echt -- is die uitslag de grondwaarheid voor de afleiding uit namen?') },
  'ISOLATIEPROEF.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    reden: NOGNIET('welke isolatiegevallen zijn met de hand vastgesteld?') },
  'KANTOORMACHT.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    reden: NOGNIET('de deur-assen komen uit de router en zijn hard; de as `anoniem` is lexicaal -- is de harde as de grondwaarheid voor de zachte?') },
  'NORM.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    reden: NOGNIET('de ratel draagt getallen van andere meters; zijn dekkingsgetal is geleend en heeft geen eigen ijking') },
  'RESOLVERBEREIK.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    reden: NOGNIET('de proeven worden gegenereerd uit de toegestane paden -- is dat een grondwaarheid of dezelfde bron als de meting?') },
  'TAALOORDEEL.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    reden: NOGNIET('het oordeel van een spreker is menselijk bewijs; geldt dat als grondwaarheid voor de automatische keuring?') },
  'TAALSCHIL.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    reden: NOGNIET('welke schilteksten zijn met de hand als volledig vastgesteld?') },
  'VINDBAAR.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    reden: NOGNIET('is er een lijst functies waarvan een mens heeft vastgesteld met welk woord je hem zoekt?') },
};

/* Sleutels die een DEKKINGSCLAIM verraden: ze spreken over volledigheid en niet
   over een waarneming. `gevonden` hoort er bewust bij -- "gevonden: 48 van 50"
   is een recall, en juist die vorm was de aanleiding voor regel 13. */
const CLAIMSLEUTELS = /^(recall|dekking|dekkingPct|bereik|volledig|compleet|gevonden)$/i;

/* Registers die een claimsleutel dragen maar er aantoonbaar geen claim mee doen.
   Elke regel is een BESLUIT met een reden; een lege reden laat de toets zakken. */
const GEEN_CLAIM = {};

module.exports = { METERS, CLAIMSLEUTELS, GEEN_CLAIM };
