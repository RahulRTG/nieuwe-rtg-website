/* Magnaat: DE SECTOREN -- wat een bedrijf van dit soort eigenlijk IS.

   Een restaurant en een hotel draaien op dezelfde economische kern (klanten
   binnen, omzet, kosten, marge, reputatie) maar hun OPERATIE verschilt: een
   hotel heeft kamers en bezetting, een restaurant heeft couverts per avond, een
   logistiek bedrijf heeft ritten. Die verschillen staan hier als GETALLEN op
   een rij, en de kern die ermee rekent staat in ./stap.js.

   Dat is de belangrijkste scheiding van dit spel. Zou elke sector zijn eigen
   rekenwerk krijgen, dan zijn er zeven economieen die uiteen gaan lopen -- en
   dan is "waarom verdient mijn hotel niets" een vraag die per sector een ander
   antwoord heeft. Nu is er EEN antwoord, met per sector andere getallen.

   HOE JE DEZE TABEL LEEST
     eenheid      waarin de OMVANG van een vestiging telt (stoelen, kamers,
                  voertuigen, werkplekken) -- in gewone taal, voor het scherm
     perMaand     hoe vaak een eenheid omvang per maand verkocht wordt bij volle
                  bezetting. Een restaurantstoel gaat ~36 keer per maand over de
                  toonbank, een hotelkamer 30 keer, een productielijn 20 keer
     perMedewerker hoeveel eenheden omvang een medewerker aankan
     markt        de vraag in eenheden per maand op een GEMIDDELDE plek. De
                  kavelindex uit ../vraag.js schaalt hierop
     bouw         wat openen kost, per eenheid omvang
     prijs        [laag, midden, hoog] -- de band waarbinnen je mag prijzen
     inkoop       welk deel van de omzet naar inkoop gaat (marge is de rest)
     loon         maandloon per medewerker
     vast         vaste maandlast per eenheid omvang (energie, schoonmaak)
     trekt        welke bevolkingssegmenten hier komen, met hun gewicht
     dagdeel      of dit bedrijf van dag, avond of allebei leeft
     seizoen      hoe hard het seizoen doorwerkt (0 = niet, 1 = volledig)

   `perMaand` EN `markt` ZIJN DE TWEE DIE HET SPEL MAKEN OF BREKEN, en ze zijn
   er allebei bijgekomen nadat de eerste versie gemeten werd. Daarin was
   `omvang` tegelijk de maandcapaciteit -- veertig couverts per MAAND voor een
   restaurant met veertig stoelen. Gevolg: iedereen ging failliet, en MINDER
   personeel en GEEN onderhoud wonnen de partij, omdat capaciteit toch niet de
   bindende factor was. Een spel waarin niets doen de beste zet is, is geen
   spel. `scripts/magnaat-balans.js` meet dit nu, en `test/spelmagnaat.test.js`
   houdt de uitkomst vast.

   DE GETALLEN ZIJN SPELBALANS EN GEEN ECONOMISCH ONDERZOEK. Ze staan hier bij
   elkaar zodat ze te vergelijken en te verstellen zijn; dat is precies waarom
   ze niet verspreid door de motor mogen staan.

   ZE ZIJN GEIJKT OP DE JUISTE MAAT, en die tweede ijking kwam er nadat
   `scripts/magnaat-strateeg.js` honderden campagnes uitspeelde en er een
   profiel 100% van zijn duels won. De eerste ijking mat elke sector bij een
   VASTE omvang (veertig), en dat loog: bij die maat staat elke sector ongeveer
   even veel leeg, dus zag hij ze als gelijk. Maar de winst zit in OP MAAT
   bouwen -- precies zo groot als de vraag -- en daar liepen ze ver uiteen,
   omdat een sector waarvan de lonen met de omvang meebewegen veel meer
   overhoudt aan krimpen dan een sector met lompe personeelsstappen.
   Logistiek verdiende zichzelf op maat in 5,7 maanden terug en horeca in 9,6.
   `bouw` is nu zo gezet dat elke sector OP ZIJN JUISTE MAAT rond de twaalf
   maanden zit. Dat op maat bouwen loont blijft: dat is een vaardigheid en geen
   uitbuiting. Wat weg is, is dat EEN sector daar veel meer aan overhield.

   EN OP DE MEDIAAN, niet op het beste kavel -- de derde ijking. Een campagne
   opent tien plekken, geen een, dus wat telt is niet wat de mooiste plek doet
   maar wat een doorsnee geschikte plek doet.

   DE VIERDE EN LAATSTE IJKING GING NIET OVER RENDEMENT MAAR OVER MAAT, en die
   loste op wat de eerste drie niet konden. Elke sector verdiende zichzelf even
   snel terug, en tOch won er telkens een -- eerst logistiek, toen horeca, toen
   weer logistiek. De oorzaak was dat een KAVEL in de ene sector veertig keer
   zoveel kapitaal opnam als in de andere: een doorsnee industrieplek vroeg
   miljoenen, een plek voor vrije tijd zeventigduizend. Bij gelijk startkapitaal
   en een campagne van drie jaar is dat geen smaakverschil maar een ander spel:
   de goedkope sectoren zetten hun geld meteen aan het werk en liepen tegen het
   aantal kavels aan, de dure stonden maanden te sparen.

   Nu neemt elk kavel ongeveer evenveel kapitaal op -- rond de tweehonderdduizend
   -- en verdient het zich in twaalf maanden terug. Een hotelplek draagt zes
   kamers, een winkelplek zesenzestig kassaplekken; dat is dezelfde ORDE VAN
   KANS in een andere vorm. Het karakter van een sector zit in hoe hij werkt
   (personeelsverhouding, seizoen, prijsband, welke zones), niet in hoeveel
   nullen erachter staan.

   `levert` EN `koopt` ZIJN ER IN FASE B BIJGEKOMEN, en ze verdelen de BESTAANDE
   inkoopsom -- er komt geen kostenpost bij, `koopt` telt per sector op tot 1.
   Zonder contract verandert er dus niets aan de balans hierboven, en dat is de
   eis: een economie die anders rekent zodra er een laag bijkomt, is twee
   economieen. Wat de soorten betekenen en wat een handelseenheid kost staat in
   ./handel.js, bij de laag die ermee rekent. */

/* WAT EEN EENHEID PER MAAND VAST KOST, en waarom kantoor en industrie zijn
   bijgesteld. Dit is ijking 4 uit fase A, nog een keer en op twee andere
   sectoren. Daar stond het over logistiek: "had vrijwel geen vaste lasten (41
   per voertuig) en dus geen enkele hefboom -- leegstand deed er niet aan pijn.
   Een vloot heeft verzekering, belasting en een depot."

   Precies hetzelfde gold hier. Gemeten als deel van de steen:

     logistiek 2,17%   vrije-tijd 0,95%   retail 0,67%   horeca 0,58%
     hotel 0,19%       kantoor 0,08%      industrie 0,08%

   Een werkplek van 36.966 die 28 per maand kost, en een productielijn van
   71.831 die er 55 kost: dat is een orde van grootte onder de rest. Zulke
   panden hebben energie, onderhoud, verzekering en schoonmaak, en zonder die
   post doet leegstand geen pijn -- je kunt dertig kantoren aanhouden zonder
   nadeel. Nu op 0,5% van de bouwsom, tussen hotel en horeca in.

   Het scheelde in de sectorproef 8,9x naar 6,7x spreiding. De rest van die
   spreiding komt ergens anders vandaan en staat als open bevinding in TAKEN.md;
   dit is de post die aantoonbaar FOUT stond, niet de post die hem oplost. */
const SECTOREN = {
  horeca: {
    naam: 'Restaurant', eenheid: 'stoelen', perMaand: 36, perMedewerker: 14, markt: 669, bouw: 5903,
    prijs: [22, 35, 62], inkoop: 0.32, loon: 2400, vast: 34,
    trekt: { gezinnen: 1.0, ouderen: 0.8, studenten: 0.7, toeristen: 1.4, zakelijk: 1.1, nachtpubliek: 1.2 },
    dagdeel: 'avond', seizoen: 0.7,
    koopt: { goederen: 0.80, vervoer: 0.15, diensten: 0.05 }
  },
  hotel: {
    naam: 'Hotel', eenheid: 'kamers', perMaand: 30, perMedewerker: 9, markt: 170, bouw: 32120,
    prijs: [78, 135, 240], inkoop: 0.18, loon: 2500, vast: 62,
    trekt: { gezinnen: 0.9, ouderen: 0.7, studenten: 0.2, toeristen: 1.8, zakelijk: 1.5, nachtpubliek: 0.3 },
    dagdeel: 'beide', seizoen: 1.0,
    koopt: { goederen: 0.55, vervoer: 0.25, diensten: 0.20 }
  },
  retail: {
    naam: 'Winkel', eenheid: 'kassaplekken', perMaand: 30, perMedewerker: 42, markt: 1035, bouw: 2406,
    prijs: [14, 26, 48], inkoop: 0.52, loon: 2250, vast: 16,
    trekt: { gezinnen: 1.3, ouderen: 1.1, studenten: 0.9, toeristen: 1.1, zakelijk: 0.5, nachtpubliek: 0.3 },
    dagdeel: 'dag', seizoen: 0.4,
    levert: 'goederen', koopt: { productie: 0.45, goederen: 0.35, vervoer: 0.20 }
  },
  logistiek: {
    naam: 'Logistiek', eenheid: 'voertuigen', perMaand: 150, perMedewerker: 1, markt: 1801, bouw: 18420,
    prijs: [34, 52, 88], inkoop: 0.38, loon: 2700, vast: 400,
    trekt: { zakelijk: 2.2, toeristen: 0.4, gezinnen: 0.2, ouderen: 0.2, studenten: 0.1, nachtpubliek: 0.2 },
    dagdeel: 'beide', seizoen: 0.2,
    levert: 'vervoer', koopt: { productie: 0.45, diensten: 0.30, goederen: 0.25 }
  },
  'vrije-tijd': {
    naam: 'Vrije tijd', eenheid: 'plaatsen', perMaand: 30, perMedewerker: 34, markt: 1405, bouw: 2304,
    prijs: [9, 17, 32], inkoop: 0.22, loon: 2200, vast: 22,
    trekt: { gezinnen: 1.6, ouderen: 0.6, studenten: 1.2, toeristen: 1.5, zakelijk: 0.3, nachtpubliek: 0.9 },
    dagdeel: 'dag', seizoen: 0.9,
    koopt: { goederen: 0.75, diensten: 0.15, vervoer: 0.10 }
  },
  kantoor: {
    naam: 'Zakelijke dienst', eenheid: 'werkplekken', perMaand: 2.6, perMedewerker: 1, markt: 31, bouw: 36966,
    prijs: [1800, 3200, 5600], inkoop: 0.12, loon: 3600, vast: 185,
    trekt: { zakelijk: 2.6, gezinnen: 0.2, ouderen: 0.2, studenten: 0.1, toeristen: 0.1, nachtpubliek: 0.1 },
    dagdeel: 'dag', seizoen: 0.1,
    levert: 'diensten', koopt: { diensten: 0.55, goederen: 0.30, vervoer: 0.15 }
  },
  industrie: {
    naam: 'Productie', eenheid: 'productielijnen', perMaand: 20, perMedewerker: 2, markt: 133, bouw: 71831,
    prijs: [420, 760, 1350], inkoop: 0.45, loon: 2900, vast: 359,
    trekt: { zakelijk: 2.4, gezinnen: 0.1, ouderen: 0.1, studenten: 0.1, toeristen: 0.1, nachtpubliek: 0.1 },
    dagdeel: 'dag', seizoen: 0.1,
    levert: 'productie', koopt: { productie: 0.40, goederen: 0.30, vervoer: 0.30 }
  }
};

const SECTORLIJST = Object.keys(SECTOREN);

module.exports = { SECTOREN, SECTORLIJST };
