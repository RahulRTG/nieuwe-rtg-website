/* De Residence, deelbestand "zalen": de vaste zalen van het virtuele
   RTG-grandhotel en de meubelcatalogus van RTG Maison. Pure data: het
   raster (b x d tegels), de vaste inrichting per zaal en de plek waar een
   lid binnenkomt. De client tekent alles zelf met canvas (huisstijl, geen
   sprites of extern beeld); de server kent alleen de voetafdrukken zodat
   niemand door een vleugelpiano kan lopen. */

/* de meubelcatalogus: b/d = voetafdruk in tegels, zit = je kunt erop
   plaatsnemen, vlak = beloopbaar (tapijten) */
const MEUBELS = {
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
  fontein: { naam: 'Fontein', b: 2, d: 2 }
};

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
    naam: 'De Gouden Bar', sub: 'aperitieven en gesprekken',
    b: 12, d: 9, spawn: [6, 7],
    meubels: [
      ['bar', 4, 1], ['kruk', 4, 3], ['kruk', 5, 3], ['kruk', 6, 3],
      ['tafel', 1, 5], ['fauteuil', 0, 5], ['fauteuil', 3, 6],
      ['tafel', 9, 5], ['fauteuil', 8, 5], ['fauteuil', 11, 6],
      ['vleugel', 9, 0], ['palm', 0, 0], ['lamp', 11, 3], ['palm', 0, 8]
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
  }
};

// de suite van een lid: leeg raster, zelf in te richten met de catalogus
const SUITE = { b: 10, d: 8, spawn: [5, 6], maxMeubels: 40 };

module.exports = { MEUBELS, ZALEN, SUITE };
