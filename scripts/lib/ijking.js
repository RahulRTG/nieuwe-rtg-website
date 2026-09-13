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

   EN ER IS EEN VIERDE UITWEG DIE GEEN GRONDWAARHEID NODIG HEEFT: de claim
   versmallen. Niet elke ongeijkte meter vraagt om een nieuwe bron; soms is de
   meting prima en is de NAAM te breed. APPWERKT.json is daarvan het voorbeeld in
   dit huis en het loste het zelf al op: zijn grensveld zegt *"Een BEWEZEN rij
   betekent: de ingang opent voor zijn persona en de bediening breekt niet. Het
   betekent NIET dat de functie werkt."* Dat is een versmalde claim, geen
   ontbrekende ijking. Zo'n meter hoort hier als `waarneming` met zijn grensveld
   erbij, en niet als ONBEPAALD.

     ONBEPAALD  ->  GEIJKT                     (er is een bron gevonden)
     ONBEPAALD  ->  GEEN + reden               (verdedigbaar geen bron mogelijk)
     ONBEPAALD  ->  claim versmald naar waarneming
     ONBEPAALD  ->  "we noemen de generator zelf maar grondwaarheid"   NOOIT

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

/* DE DRIE VRAGEN DIE EEN `ONBEPAALD` MOET BEANTWOORDEN.

   Het doel is niet dat dit getal naar nul gaat. Het doel is dat elk ONBEPAALD
   een expliciete vraag draagt waarvan het ANTWOORD bepaalt welke soort
   grondwaarheid hier uberhaupt geldig zou zijn:

     1. wat is de letterlijke claim van deze meter?
     2. welke informatiebron is onafhankelijk van de constructie van die meter?
     3. kan die bron dezelfde blindheid hebben?

   Heeft vraag 2 geen antwoord, dan zijn er drie geldige uitkomsten -- en geen
   ervan is falen:

     CLAIM_VERSMALLEN                de meting deugt, de naam was te breed
     IJKCORPUS_NODIG                 een mens moet een klein corpus vaststellen
     GEEN_ONAFHANKELIJKE_GRONDWAARHEID  er IS er geen, en dat is informatie

   Een ONBEPAALD zonder `vragen` is een open post zonder vraag, en dan blijft hij
   staan omdat niemand weet wat hem zou sluiten. test/meterwet.test.js eist ze. */


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

  'GELDING.json': {
    grondwaarheid: 'GEEN', claim: 'waarneming', grensveld: 'grens',
    reden: 'dit register doet geen dekkingsclaim en telt met opzet geen percentage: het zegt per cel welke ' +
      'van de drie assen iets zag, en zijn grensveld schrijft uit dat GECLAIMD_GEEN_DRAGER_GEVONDEN niet ' +
      'betekent dat er geen drager is. Wat hier wel geijkt is, is de ONAFHANKELIJKHEID van de assen ' +
      '(test/gelding.test.js), en dat is een andere vraag dan recall.',
  },

  /* --------------------------------- claim versmald in plaats van geijkt */

  /* APPWERKT.json is de vierde uitweg uit de kop, en hij had hem zelf al
     genomen. Zijn `gevonden` is het aantal bedienbare elementen op EEN scherm --
     een waarneming, geen dekking -- en zijn grensveld versmalt de claim in
     woorden die geen ruimte laten. Hij stond hier eerst als ONBEPAALD, en dat
     was mijn fout en niet die van dat register. */
  'APPWERKT.json': {
    grondwaarheid: 'GEEN', claim: 'waarneming', grensveld: 'grens',
    reden: 'dit register doet geen dekkingsclaim: het meet drie van de acht bewijzen uit BETROUWBAARHEID.md ' +
      'en zegt in zijn eigen grensveld dat een BEWEZEN rij NIET betekent dat de functie werkt. Een meter die ' +
      'zijn claim al heeft versmald, heeft geen grondwaarheid nodig om eerlijk te zijn.',
  },

  /* ------------------------------------- dragen een dekkingsgetal, niet geijkt */

  'HERSTEL.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    vragen: {
      claim: 'de afleiding uit routenamen dekt alle omkeerbare routes',
      onafhankelijkeBron: 'HERSTELPROEF.json beproeft 90 paren ECHT (heen, kijken, terug, kijken) en is niet uit namen afgeleid',
      zelfdeBlindheid: 'ja: die proef kent alleen paren die HERSTEL.json hem aanreikt, dus zij deelt de blindheid voor een paar dat geen naamgelijkenis heeft',
    },
    reden: NOGNIET('HERSTELPROEF.json beproeft paren echt -- is die uitslag de grondwaarheid voor de afleiding uit namen?') },
  'KANTOORMACHT.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    vragen: {
      claim: 'het aandeel kantoorroutes dat anoniem uitvoerbaar is',
      onafhankelijkeBron: 'de ROUTER zelf: welke deur een route eist is hard af te lezen, de as `anoniem` is lexicaal',
      zelfdeBlindheid: 'nee voor de harde as, ja voor de zachte -- en juist de zachte draagt het dekkingsgetal',
    },
    reden: NOGNIET('de deur-assen komen uit de router en zijn hard; de as `anoniem` is lexicaal -- is de harde as de grondwaarheid voor de zachte?') },
  'NORM.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    vragen: {
      claim: 'het dekkingsgetal van de ratel',
      onafhankelijkeBron: 'geen: dit getal is GELEEND van andere meters en heeft geen eigen meting',
      zelfdeBlindheid: 'ja, per definitie: het erft de blindheid van elke meter die eraan hangt',
    },
    reden: NOGNIET('de ratel draagt getallen van andere meters; zijn dekkingsgetal is geleend en heeft geen eigen ijking') },

  /* Deze is de scherpste van de vier, want hij is ZELFREFERENTIEEL en het script
     ziet daar maar de helft van. `resolverbereik.js` genereert een proef voor elk
     pad uit `toegestanePaden` en vraagt of dat pad overleeft: dezelfde bron
     levert de gevallen EN de definitie van volledig. Het script benoemt de
     woordhelft daarvan eerlijk ("deels een identiteitstest") en dekt hem af met
     zeven vervormingen -- maar de INVENTARIS-helft niet: een pad dat in
     `toegestanePaden` ontbreekt, is voor de proef en voor de waarheid even
     onzichtbaar, en dan kan 100% blind betekenen. */
  'RESOLVERBEREIK.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    vragen: {
      claim: 'alle geldige resolverpaden worden opgelost',
      onafhankelijkeBron: 'geen: `toegestanePaden` levert de proeven EN bepaalt wat volledig is',
      zelfdeBlindheid: 'ja, en volledig: een pad dat in die lijst ontbreekt is voor de proef en voor de waarheid even onzichtbaar',
    },
    reden: 'zelfreferentieel: de proeven worden gegenereerd uit `toegestanePaden` en diezelfde lijst bepaalt ' +
      'wat volledig is. Een onafhankelijke inventaris van resolverbare paden -- of een klein canoniek corpus ' +
      'dat bewust buiten de generator staat -- zou de grondwaarheid zijn; die bestaat vandaag niet.' },

  'TAALSCHIL.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    vragen: {
      claim: 'het aandeel schilteksten dat per taal gevuld is',
      onafhankelijkeBron: 'een met de hand vastgestelde lijst van teksten die een schil MOET dragen',
      zelfdeBlindheid: 'nee, mits die lijst niet uit de schil zelf wordt afgeleid',
    },
    reden: NOGNIET('welke schilteksten zijn met de hand als volledig vastgesteld?') },
  'VINDBAAR.json': { grondwaarheid: 'ONBEPAALD', claim: 'dekking',
    vragen: {
      claim: 'het aandeel functies dat je terugvindt met het woord dat erop staat',
      onafhankelijkeBron: 'een corpus zoekwoorden van MENSEN die de functie niet hebben gebouwd',
      zelfdeBlindheid: 'nee -- dit is het duidelijkste geval waar een klein menselijk ijkcorpus de vraag zou sluiten',
    },
    reden: NOGNIET('is er een lijst functies waarvan een mens heeft vastgesteld met welk woord je hem zoekt?') },
};

/* WANNEER IS EEN GETAL EEN DEKKINGSCLAIM?

   NIET op de sleutelnaam alleen, en dat is gemeten. De eerste versie hiervan
   keek naar de naam en vond twaalf registers -- waaronder APPWERKT.json, waar
   `gevonden: 34` het aantal bedienbare elementen op EEN scherm is, en
   EXECUTION_MAP.json, waar `bereik: "verboden"` een etiket is. Een te brede
   detector in de handhaver van regel 13 is precies de fout die regel 13 verbiedt.

   Een claimsleutel telt daarom pas als zijn WAARDE zich als verhouding gedraagt:
     - een breuk tussen 0 en 1        (VINDBAAR: dekking 0,6539)
     - een sleutel op -Pct            (HERSTEL, KANTOORMACHT, NORM)
     - een telling met een NOEMER ernaast  (DOCTRINE: gevonden 48, van 50)

   Dat brengt het van twaalf naar acht, en de twee die er bij de eerste
   versmalling ten onrechte uit vielen (VINDBAAR en TAALSCHIL, allebei een breuk)
   staan er weer in. */
const CLAIMSLEUTELS = /^(recall|dekking|dekkingPct|bereik|volledig|compleet|gevonden)$/i;
const NOEMERSLEUTELS = /^(van|totaal|bekend|alle|mogelijk|verwacht|wettenBekend|noemer|randenWachter)$/i;

/* Is deze sleutel-waarde-combinatie een dekkingsclaim? `buren` zijn de sleutels
   van hetzelfde object, want daar woont de noemer. */
function isDekkingsclaim(sleutel, waarde, buren) {
  if (!CLAIMSLEUTELS.test(sleutel) || typeof waarde !== 'number') return false;
  if (/Pct$/.test(sleutel)) return true;
  if (waarde > 0 && waarde < 1) return true;
  return (buren || []).some(b => NOEMERSLEUTELS.test(b));
}

/* Registers die een claimsleutel dragen maar er aantoonbaar geen claim mee doen.
   Elke regel is een BESLUIT met een reden; een lege reden laat de toets zakken. */
const GEEN_CLAIM = {};

module.exports = { METERS, CLAIMSLEUTELS, NOEMERSLEUTELS, isDekkingsclaim, GEEN_CLAIM };
