/* De Residence, deelbestand "maison": de volledige RTG Maison-catalogus en
   de standaard-inrichting van de suite. Elke suite is vanaf de eerste dag
   een compleet penthouse: slaapkamer, badkamer met douche en bad, keuken,
   eethoek, zithoek met haard en televisie, bureau en een telefoon om
   iemand uit te nodigen. Alles inbegrepen bij de pas -- geen koop-lussen.
   b/d = voetafdruk in tegels, zit = erop plaatsnemen, vlak = beloopbaar. */

const MEUBELS = {
  /* zitten en salon */
  fauteuil: { naam: 'Fauteuil Marfil', b: 1, d: 1, zit: true },
  bank: { naam: 'Canape Riviera', b: 2, d: 1, zit: true },
  chaise: { naam: 'Chaise longue', b: 2, d: 1, zit: true },
  kruk: { naam: 'Barkruk', b: 1, d: 1, zit: true },
  tafel: { naam: 'Marmeren tafel', b: 2, d: 2 },
  bijzet: { naam: 'Bijzettafel', b: 1, d: 1 },
  vleugel: { naam: 'Vleugelpiano', b: 2, d: 2 },
  haard: { naam: 'Open haard', b: 2, d: 1 },
  bar: { naam: 'Gouden bar', b: 3, d: 1 },
  palm: { naam: 'Palm in pot', b: 1, d: 1 },
  lamp: { naam: 'Vloerlamp', b: 1, d: 1 },
  schaak: { naam: 'Schaaktafel', b: 1, d: 1 },
  boekenkast: { naam: 'Boekenwand', b: 3, d: 1 },
  tapijt: { naam: 'Perzisch tapijt', b: 3, d: 2, vlak: true },
  fontein: { naam: 'Fontein', b: 2, d: 2 },
  /* slapen en wonen */
  bed: { naam: 'Kingsize bed', b: 2, d: 2, zit: true },
  kast: { naam: 'Kledingkast', b: 2, d: 1 },
  spiegel: { naam: 'Staande spiegel', b: 1, d: 1 },
  tv: { naam: 'Televisiewand', b: 2, d: 1 },
  bureau: { naam: 'Schrijfbureau', b: 2, d: 1 },
  telefoon: { naam: 'Huistelefoon', b: 1, d: 1 },
  /* badkamer */
  bad: { naam: 'Vrijstaand bad', b: 2, d: 1, zit: true },
  douche: { naam: 'Regendouche', b: 1, d: 1, vlak: true },
  wastafel: { naam: 'Marmeren wastafel', b: 1, d: 1 },
  toilet: { naam: 'Toilet', b: 1, d: 1, zit: true },
  /* keuken */
  keuken: { naam: 'Keukeneiland', b: 3, d: 1 },
  koelkast: { naam: 'Koelkast', b: 1, d: 1 },
  dinertafel: { naam: 'Dinertafel voor twee', b: 2, d: 2 },
  /* bal en salon */
  kroonluchter: { naam: 'Kroonluchter', b: 1, d: 1, vlak: true },
  dansvloer: { naam: 'Dansvloer', b: 2, d: 2, vlak: true },
  biljarttafel: { naam: 'Biljarttafel', b: 3, d: 2 },
  doelwit: { naam: 'Boogdoel', b: 1, d: 1 },
  telescoop: { naam: 'Telescoop', b: 1, d: 1 },
  /* spel en buiten */
  water: { naam: 'Privebad (water)', b: 2, d: 2, vlak: true },
  green: { naam: 'Golfgreen', b: 2, d: 2, vlak: true },
  golfhole: { naam: 'Golfhole met vlag', b: 1, d: 1, vlak: true },
  golfmat: { naam: 'Afslagmat', b: 1, d: 1, vlak: true },
  dartbord: { naam: 'Dartbord op voet', b: 1, d: 1 },
  kegelbaan: { naam: 'Kegelbaan', b: 1, d: 5, vlak: true }
};

/* de suite: een penthouse-raster, standaard volledig ingericht */
const SUITE = { b: 12, d: 9, spawn: [6, 7], maxMeubels: 60 };

/* de standaard deluxe-inrichting [soort, x, y] -- de eigenaar mag alles
   verzetten of weghalen; dit is het vertrekpunt, geen verplichting */
const DELUXE = [
  ['bed', 0, 0], ['bijzet', 2, 0], ['telefoon', 2, 1],
  ['kast', 0, 2], ['spiegel', 2, 2],
  ['keuken', 4, 0], ['koelkast', 7, 0],
  ['bad', 9, 0], ['douche', 11, 0], ['wastafel', 9, 1], ['toilet', 11, 1],
  ['dinertafel', 8, 3], ['fauteuil', 10, 3], ['fauteuil', 7, 4],
  ['haard', 0, 4], ['bank', 3, 4], ['bijzet', 5, 4],
  ['tapijt', 3, 5], ['tv', 3, 7],
  ['lamp', 0, 6], ['palm', 11, 4], ['kruk', 10, 6], ['bureau', 10, 7], ['palm', 0, 8]
];

module.exports = { MEUBELS, SUITE, DELUXE };
