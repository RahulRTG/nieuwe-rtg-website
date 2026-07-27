/* De Residence, deelbestand "zalen": de vaste zalen van het virtuele
   RTG-grandhotel. Pure data: het raster (b x d tegels), de vaste inrichting
   per zaal en de plek waar een lid binnenkomt. De catalogus en de suite
   staan in maison.js. De client tekent alles zelf met canvas (huisstijl,
   geen sprites of extern beeld); de server kent alleen de voetafdrukken
   zodat niemand door een vleugelpiano kan lopen. De activiteitenzalen zijn
   er om elkaar te leren kennen: samen golfen, darten, kegelen, zwemmen of
   uit eten -- een eerste kennismaking voor een echte date. */
const { MEUBELS, SUITE, DELUXE } = require('./maison');

/* de vaste zalen; meubels als [soort, x, y] */
const ZALEN = {
  lobby: {
    naam: 'De Lobby', sub: 'het kloppend hart van het huis',
    b: 14, d: 10, spawn: [7, 8],
    meubels: [
      ['fontein', 6, 3], ['tapijt', 5, 6], ['palm', 0, 0], ['palm', 13, 0],
      ['bank', 2, 2], ['fauteuil', 1, 4], ['fauteuil', 4, 1],
      ['bank', 10, 2], ['fauteuil', 12, 4], ['bijzet', 11, 4],
      ['lamp', 0, 5], ['lamp', 13, 5], ['palm', 0, 9], ['palm', 13, 9]
    ]
  },
  bar: {
    naam: 'De Gouden Bar', sub: 'aperitieven, gesprekken en darts',
    b: 12, d: 9, spawn: [6, 7],
    meubels: [
      ['bar', 4, 1], ['kruk', 4, 3], ['kruk', 5, 3], ['kruk', 6, 3],
      ['tafel', 1, 5], ['fauteuil', 0, 5], ['fauteuil', 3, 6],
      ['tafel', 9, 5], ['fauteuil', 8, 5], ['fauteuil', 11, 6],
      ['vleugel', 9, 0], ['palm', 0, 0], ['lamp', 11, 3], ['palm', 0, 8],
      ['dartbord', 1, 1], ['dartbord', 2, 1]
    ]
  },
  bibliotheek: {
    naam: 'De Bibliotheek', sub: 'stilte, boeken en schaak',
    b: 11, d: 9, spawn: [5, 7],
    meubels: [
      ['boekenkast', 1, 0], ['boekenkast', 5, 0], ['haard', 8, 0],
      ['tapijt', 4, 3], ['schaak', 2, 3], ['fauteuil', 1, 3], ['fauteuil', 3, 4],
      ['schaak', 8, 4], ['fauteuil', 7, 4], ['fauteuil', 9, 5],
      ['chaise', 4, 6], ['lamp', 0, 6], ['lamp', 10, 2], ['palm', 10, 8]
    ]
  },
  terras: {
    naam: 'Het Terras', sub: 'avondlucht boven Ibiza',
    b: 12, d: 8, spawn: [6, 6],
    meubels: [
      ['palm', 0, 0], ['palm', 3, 0], ['palm', 8, 0], ['palm', 11, 0],
      ['tafel', 2, 3], ['fauteuil', 1, 3], ['fauteuil', 4, 4],
      ['tafel', 8, 3], ['fauteuil', 7, 3], ['fauteuil', 10, 4],
      ['chaise', 2, 6], ['chaise', 9, 6], ['lamp', 5, 1], ['fontein', 5, 4]
    ]
  },
  golf: {
    naam: 'De Golfbaan', sub: 'midgetgolf onder de sterren',
    b: 13, d: 9, spawn: [6, 8],
    meubels: [
      ['green', 1, 1], ['golfhole', 2, 1], ['green', 9, 1], ['golfhole', 10, 2],
      ['green', 5, 3], ['golfhole', 6, 4],
      ['golfmat', 1, 7], ['golfmat', 6, 6], ['golfmat', 11, 7],
      ['palm', 0, 0], ['palm', 12, 0], ['lamp', 0, 5], ['lamp', 12, 5], ['bank', 3, 8]
    ]
  },
  kegel: {
    naam: 'De Kegelzaal', sub: 'kegelen op het gladde hout',
    b: 12, d: 9, spawn: [6, 8],
    meubels: [
      ['kegelbaan', 3, 1], ['kegelbaan', 5, 1], ['kegelbaan', 7, 1],
      ['bar', 9, 7], ['kruk', 9, 6], ['kruk', 10, 6],
      ['bank', 0, 7], ['bijzet', 2, 7], ['lamp', 0, 0], ['lamp', 11, 0], ['palm', 0, 4]
    ]
  },
  badhuis: {
    naam: 'Het Badhuis', sub: 'baantjes en ligstoelen',
    b: 12, d: 9, spawn: [6, 8],
    meubels: [
      ['water', 3, 1], ['water', 5, 1], ['water', 3, 3], ['water', 5, 3],
      ['chaise', 9, 1], ['chaise', 9, 3], ['douche', 11, 5], ['wastafel', 11, 6],
      ['palm', 0, 0], ['palm', 11, 0], ['palm', 0, 6], ['lamp', 8, 6], ['bijzet', 9, 5]
    ]
  },
  restaurant: {
    naam: 'Het Restaurant', sub: 'diner bij kaarslicht, met vragen van het huis',
    b: 12, d: 9, spawn: [6, 8],
    meubels: [
      ['dinertafel', 1, 1], ['fauteuil', 0, 1], ['fauteuil', 3, 2],
      ['dinertafel', 8, 1], ['fauteuil', 7, 1], ['fauteuil', 10, 3],
      ['dinertafel', 4, 4], ['fauteuil', 3, 4], ['fauteuil', 6, 5],
      ['vleugel', 9, 6], ['palm', 0, 8], ['lamp', 0, 5], ['lamp', 11, 5], ['palm', 0, 0]
    ]
  },
  balzaal: {
    naam: 'De Balzaal', sub: 'het gemaskerde bal, elke avond',
    b: 13, d: 10, spawn: [6, 9],
    meubels: [
      ['dansvloer', 4, 3], ['dansvloer', 6, 3], ['dansvloer', 4, 5], ['dansvloer', 6, 5],
      ['kroonluchter', 5, 4], ['kroonluchter', 7, 4],
      ['vleugel', 10, 0], ['bank', 0, 4], ['bank', 11, 5],
      ['palm', 0, 0], ['palm', 12, 0], ['lamp', 0, 8], ['lamp', 12, 8], ['bar', 0, 9]
    ]
  },
  biljart: {
    naam: 'De Biljartkamer', sub: 'caramboles en een goed gesprek',
    b: 11, d: 9, spawn: [5, 8],
    meubels: [
      ['biljarttafel', 4, 3], ['lamp', 5, 2],
      ['bar', 7, 7], ['kruk', 7, 6], ['kruk', 8, 6],
      ['bank', 0, 6], ['bijzet', 2, 6], ['boekenkast', 0, 0], ['palm', 10, 0], ['lamp', 0, 3]
    ]
  },
  boog: {
    naam: 'De Boogbaan', sub: 'boogschieten op de roos',
    b: 12, d: 9, spawn: [6, 8],
    meubels: [
      ['doelwit', 2, 0], ['doelwit', 6, 0], ['doelwit', 10, 0],
      ['golfmat', 2, 6], ['golfmat', 6, 6], ['golfmat', 10, 6],
      ['bank', 0, 8], ['palm', 0, 0], ['palm', 11, 4], ['lamp', 0, 4], ['lamp', 11, 8]
    ]
  },
  sterrenwacht: {
    naam: 'De Sterrenwacht', sub: 'stil samen kijken, hoog boven het huis',
    b: 11, d: 9, spawn: [5, 8],
    meubels: [
      ['telescoop', 5, 2], ['telescoop', 8, 3],
      ['chaise', 2, 4], ['chaise', 7, 6], ['bank', 1, 7],
      ['bijzet', 3, 7], ['lamp', 0, 0], ['palm', 10, 0], ['palm', 0, 8]
    ]
  }
};

module.exports = { MEUBELS, ZALEN, SUITE, DELUXE };
