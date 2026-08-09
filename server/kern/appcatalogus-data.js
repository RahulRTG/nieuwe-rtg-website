/* De ECHTE RTG App-Bibliotheek: geen verzonnen namen meer, maar de apps die
   werkelijk in het RTG-ecosysteem draaien. Elke tegel opent een bestaande,
   werkende pagina. De categorie-glyphen komen uit de huisstijl-set (RTGGlyf).

   Dit is pure data; de motor (kern/appbieb.js) toont, doorzoekt en installeert
   ze, en voegt er de door de RTG Werkplaats gepubliceerde apps aan toe. Alles is
   voor leden inbegrepen bij de pas; de RTFoundation-apps zijn voor iedereen
   gratis. Nieuwe app-pagina's krijgen hier gewoon een regel. */

const CATEGORIEEN = [
  { id: 'sociaal', label: 'Sociaal & contact', icon: 'megafoon' },
  { id: 'reizen', label: 'Reizen & verblijf', icon: 'maison' },
  { id: 'eten', label: 'Eten & uitgaan', icon: 'horeca' },
  { id: 'media', label: 'Media & creatie', icon: 'film' },
  { id: 'geld', label: 'Geld & werk', icon: 'rekening' },
  { id: 'spelen', label: 'Spelen & sport', icon: 'ster' },
  { id: 'leven', label: 'Leven & gezondheid', icon: 'hart' },
  { id: 'veiligheid', label: 'Veiligheid & identiteit', icon: 'schild' },
  { id: 'foundation', label: 'RTFoundation (gratis)', icon: 'diploma' }
];

/* [id, naam, categorie, url, uitleg]. wereld volgt uit de url (foundation = rtf). */

/* De rijen staan in appcatalogus-rijen/. Opgeknipt omdat dit bestand boven de
   10 KB kwam; de bibliotheek groeit met elke nieuwe app-pagina, dus er komen
   delen bij. Hier alleen samenvoegen. */
const R = [].concat(
  require('./appcatalogus-rijen/deel1'),
  require('./appcatalogus-rijen/deel2')
);


const APPS = R.map(([id, naam, categorie, url, uitleg]) => ({
  id: 'rtgapp-' + id, sleutel: id, naam, categorie,
  categorieLabel: (CATEGORIEEN.find(c => c.id === categorie) || {}).label || categorie,
  icon: (CATEGORIEEN.find(c => c.id === categorie) || {}).icon || 'ster',
  url, uitleg,
  wereld: url.startsWith('/apps/foundation/') ? 'rtf' : 'rtg',
  ledenprijsCenten: 0
}));

module.exports = { CATEGORIEEN, APPS };
