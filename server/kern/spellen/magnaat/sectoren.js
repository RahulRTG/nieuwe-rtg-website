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
   ze niet verspreid door de motor mogen staan. Ze zijn GEIJKT op een doel:
   een goed geplaatste, goed bemande vestiging draait rond de 75% bezetting en
   verdient zijn bouwsom in ongeveer veertien maanden terug. Een slecht
   geplaatste haalt dat niet, en dat verschil is de hele keuze. */

const SECTOREN = {
  horeca: {
    naam: 'Restaurant', eenheid: 'stoelen', perMaand: 36, perMedewerker: 14, markt: 460, bouw: 4600,
    prijs: [22, 35, 62], inkoop: 0.32, loon: 2400, vast: 34,
    trekt: { gezinnen: 1.0, ouderen: 0.8, studenten: 0.7, toeristen: 1.4, zakelijk: 1.1, nachtpubliek: 1.2 },
    dagdeel: 'avond', seizoen: 0.7
  },
  hotel: {
    naam: 'Hotel', eenheid: 'kamers', perMaand: 30, perMedewerker: 9, markt: 375, bouw: 26000,
    prijs: [78, 135, 240], inkoop: 0.18, loon: 2500, vast: 62,
    trekt: { gezinnen: 0.9, ouderen: 0.7, studenten: 0.2, toeristen: 1.8, zakelijk: 1.5, nachtpubliek: 0.3 },
    dagdeel: 'beide', seizoen: 1.0
  },
  retail: {
    naam: 'Winkel', eenheid: 'kassaplekken', perMaand: 30, perMedewerker: 42, markt: 440, bouw: 1700,
    prijs: [14, 26, 48], inkoop: 0.52, loon: 2250, vast: 16,
    trekt: { gezinnen: 1.3, ouderen: 1.1, studenten: 0.9, toeristen: 1.1, zakelijk: 0.5, nachtpubliek: 0.3 },
    dagdeel: 'dag', seizoen: 0.4
  },
  logistiek: {
    naam: 'Logistiek', eenheid: 'voertuigen', perMaand: 150, perMedewerker: 1, markt: 7400, bouw: 12000,
    prijs: [34, 52, 88], inkoop: 0.38, loon: 2700, vast: 41,
    trekt: { zakelijk: 2.2, toeristen: 0.4, gezinnen: 0.2, ouderen: 0.2, studenten: 0.1, nachtpubliek: 0.2 },
    dagdeel: 'beide', seizoen: 0.2
  },
  'vrije-tijd': {
    naam: 'Vrije tijd', eenheid: 'plaatsen', perMaand: 30, perMedewerker: 34, markt: 390, bouw: 1000,
    prijs: [9, 17, 32], inkoop: 0.22, loon: 2200, vast: 22,
    trekt: { gezinnen: 1.6, ouderen: 0.6, studenten: 1.2, toeristen: 1.5, zakelijk: 0.3, nachtpubliek: 0.9 },
    dagdeel: 'dag', seizoen: 0.9
  },
  kantoor: {
    naam: 'Zakelijke dienst', eenheid: 'werkplekken', perMaand: 2.6, perMedewerker: 1, markt: 150, bouw: 27000,
    prijs: [1800, 3200, 5600], inkoop: 0.12, loon: 3600, vast: 28,
    trekt: { zakelijk: 2.6, gezinnen: 0.2, ouderen: 0.2, studenten: 0.1, toeristen: 0.1, nachtpubliek: 0.1 },
    dagdeel: 'dag', seizoen: 0.1
  },
  industrie: {
    naam: 'Productie', eenheid: 'productielijnen', perMaand: 20, perMedewerker: 2, markt: 1111, bouw: 66000,
    prijs: [420, 760, 1350], inkoop: 0.45, loon: 2900, vast: 55,
    trekt: { zakelijk: 2.4, gezinnen: 0.1, ouderen: 0.1, studenten: 0.1, toeristen: 0.1, nachtpubliek: 0.1 },
    dagdeel: 'dag', seizoen: 0.1
  }
};

const SECTORLIJST = Object.keys(SECTOREN);

/* De prijsstanden die een speler kan kiezen. Drie en niet een schuifbalk: een
   getal invoeren nodigt uit tot micro-optimaliseren, en dat is precies het
   soort bezigheid dat een spel in een spreadsheet verandert. */
const PRIJSSTANDEN = ['laag', 'midden', 'hoog'];
const prijsVan = (sector, stand) => SECTOREN[sector].prijs[Math.max(0, PRIJSSTANDEN.indexOf(stand))];

/* Wat een prijsstand met de VRAAG doet. Goedkoper trekt meer mensen, duurder
   minder -- maar duurder trekt ook een ander publiek, dus het valt niet zomaar
   weg tegen de hogere prijs. Dat is de hele keuze. */
const VRAAGFACTOR = { laag: 1.32, midden: 1.0, hoog: 0.68 };
/* En met de VERWACHTING. Wie de hoofdprijs vraagt en matige kwaliteit levert,
   zakt harder in reputatie dan wie goedkoop is en matig levert. */
const LATFACTOR = { laag: 0.82, midden: 1.0, hoog: 1.22 };

module.exports = { SECTOREN, SECTORLIJST, PRIJSSTANDEN, prijsVan, VRAAGFACTOR, LATFACTOR };
