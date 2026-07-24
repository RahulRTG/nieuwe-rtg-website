/* De app-gids: voor elke app-pagina een korte, eerlijke uitleg (wat is dit,
   wat kun je hier, een leerzame tip). De gedeelde basis-laag (shared/basis.js)
   haalt dit op via /api/gids/app en toont het achter het ?-knopje; zo heeft
   elke app dezelfde rustige leerlaag zonder eigen teksten te onderhouden.
   Pure data + een opzoekfunctie; geen state, geen db. */

const G = (wat, doe, tip) => ({ wat, doe, tip });

/* De teksten zelf staan per deel in ./appgids-data/ (elk 5-10 KB);
   dit bestand voegt ze samen en houdt de opzoekfunctie. */
const GIDS = Object.assign({},
  require('./appgids-data/deel1'), require('./appgids-data/deel2'),
  require('./appgids-data/deel3'), require('./appgids-data/deel4'),
  require('./appgids-data/deel5'), require('./appgids-data/deel6'));


// de terugvaluitleg: ook een onbekende of nieuwe pagina krijgt nette hulp
const FALLBACK_RTG = G('Een RTG-app: onderdeel van jouw ledenomgeving.',
  ['Kijk rustig rond; alles legt zichzelf uit', 'Vraag Rahul als je iets zoekt', 'Terug naar alle apps kan altijd linksboven'],
  'Elke RTG-app werkt hetzelfde: rustig, veilig en zonder trucjes.');
const FALLBACK_RTF = G('Een RTFoundation-app: gratis hulp voor jullie gezin.',
  ['Kijk rustig rond', 'Vraag een grote mee als iets moeilijk is', 'Terug naar alle hulp kan altijd bovenaan'],
  'Alles in de RTFoundation is gratis en veilig; er zit nooit een addertje onder.');

function gidsVan(pad) {
  const p = String(pad || '').split('?')[0].split('#')[0].slice(0, 120);
  const entry = GIDS[p];
  const wereld = p.startsWith('/apps/foundation/') ? 'rtf' : 'rtg';
  if (entry) return { pad: p, wereld, ...entry };
  if (!/^\/apps\//.test(p)) return null;
  return { pad: p, wereld, algemeen: true, ...(wereld === 'rtf' ? FALLBACK_RTF : FALLBACK_RTG) };
}

module.exports = { gidsVan, GIDS, TOTAAL: Object.keys(GIDS).length };
