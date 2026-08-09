/* De RTG Mall: de luxe shoppingmall in de leden-app en de enige plek waar je
   binnen RTG koopt. Een gecureerde lijst met etages (verdiepingen): het RTG
   eigen-merk (de hardware en de door het Hardwarelab gepubliceerde ontwerpen)
   plus de mode- en retailpartners. Een mode-boutique opent haar catalogus met
   ledenprijs en verlanglijst; het eigen-merk bestel je direct in de app. De
   mall stelt zich samen uit de partners; een paar demo-boutieks vullen de
   etages.

   Geen echte modemerken; RTG-huisnamen. Beeld met CSS, geen stockfoto's.
   Volgt het vaste kern-patroon maakMall(state). Dit is de orkestrator: de
   producten en het bestellen wonen in ./catalogus, de mall-voorkant en het
   beheer in ./etalage. */

const { alleProducten: winkelCatalogus } = require('../winkelcatalogus');

const ETAGES = [
  { id: 'eigen',    label: 'RTG eigen-merk',       icon: 'store' },
  { id: 'mode',     label: 'Mode',                 icon: 'mode' },
  { id: 'sieraden', label: 'Sieraden & horloges',  icon: 'juweel' },
  { id: 'leer',     label: 'Leer & accessoires',   icon: 'tas' },
  { id: 'wonen',    label: 'Wonen & interieur',    icon: 'wonen' },
  { id: 'beauty',   label: 'Parfum & beauty',      icon: 'beauty' },
  { id: 'land',     label: 'Van het land',         icon: 'oogst' }
];
// de etages waar retail-boutieks op landen (eigen-merk en boerderij vullen we apart)
const ETAGE_IDS = ETAGES.map(e => e.id).filter(id => id !== 'eigen' && id !== 'land');

/* De gids "Alle leveranciers": naast de koop-etages toont de Mall ELKE partner,
   gegroepeerd per genre, met een diepe link naar de plek waar je daar boekt of
   reserveert. De volgorde is bewust: eerst tafelen en verblijven, dan uitgaan
   en beleven, dan diensten en de rest; genres buiten deze vaste lijst (nieuwe
   en niche-genres) komen er in de etalage automatisch achteraan, zodat elk
   leverancier-genre een eigen plek in de Mall heeft. */
const GIDS_GENRES = [
  'restaurant', 'hotel', 'apartment', 'villa', 'bar', 'club', 'beachclub',
  'koffie', 'chef', 'wellness', 'zzp', 'bouw', 'juwelier', 'galerie', 'retail',
  'boerderij', 'activiteit', 'events', 'taxi', 'jet', 'helikopter', 'verhuur',
  'tweewielers', 'charter', 'vastgoed', 'zorg'
];
/* Waar je een genre boekt/reserveert in de app (de diepe link vanuit de gids);
   de dienstverlenende genres landen op het Dienstenplein in de Mall zelf.

   De vervoergenres stonden hier lang NIET in. Ze kwamen wel in de gids, maar
   zonder pagina, en vielen dus terug op /apps/app.html met `boekbaar: false`:
   een privejet en een scooterverhuur waren zichtbaar en tegelijk doodlopend,
   terwijl /apps/hangar.html en /apps/ov.html gewoon bestonden. Dat is precies
   het symptoom-gat waar LAT-regel 1 over gaat -- de oorzaak was dat er twee
   plaatsen waren waar "waar boek je dit genre" werd bepaald (deze tabel en de
   fallback in gidsen()). De tabel is nu de enige, en test/mall-vindlaag.test.js
   eist dat elk genre dat in de Mall aanbod heeft hier een pagina heeft. */
const GENRE_PAGINA = {
  restaurant: '/apps/foodcourt.html', koffie: '/apps/foodcourt.html',
  hotel: '/apps/hotels.html', apartment: '/apps/hotels.html', villa: '/apps/hotels.html',
  bar: '/apps/uitgaan.html', club: '/apps/uitgaan.html', beachclub: '/apps/uitgaan.html',
  retail: '/apps/mall.html', juwelier: '/apps/mall.html', boerderij: '/apps/mall.html',
  zzp: '/apps/mall.html', chef: '/apps/mall.html', wellness: '/apps/mall.html', bouw: '/apps/mall.html',
  // vervoer en verhuur: elk genre naar de plek waar je hem werkelijk aanvraagt
  jet: '/apps/hangar.html', helikopter: '/apps/hangar.html', charter: '/apps/hangar.html',
  taxi: '/apps/ov.html', verhuur: '/apps/mall.html', tweewielers: '/apps/mall.html'
};

function maakMall({ db, save, crypto, isRetail, haalThuis, haalLandVind, haalVakwerk, haalFoodcourt, haalZaakFunctie, haalGroothandel }) {
  const nu = () => new Date().toISOString();
  const va = (sku, kleuren, maten, v) => {
    const out = [];
    for (const k of kleuren) for (const m of maten) out.push({ vsku: sku + '-' + k.slice(0, 3).toUpperCase() + '-' + m, kleur: k, maat: m, voorraad: v });
    return out;
  };

  function isBoer(s) { return !!s && (db.capsVan(s)).includes('boerderij'); }
  const farmTeKoop = s => ((s.boerderij && s.boerderij.producten) || []).filter(p => (p.prijs || 0) > 0 && (p.voorraad || 0) > 0);
  // een leverancier die het kantoor in de Mall heeft verborgen (schakelaar in de
  // boardroom); geldt voor zowel de koop-etages als de gids
  function verborgen(s) { return !!(s && s.mall && s.mall.verborgen); }

  // de gedeelde ctx voor de deelbestanden
  const ctx = {
    db, save, crypto, isRetail, haalThuis, haalLandVind, haalVakwerk, haalFoodcourt, haalZaakFunctie, haalGroothandel,
    nu, va, isBoer, farmTeKoop, verborgen, winkelCatalogus,
    ETAGES, ETAGE_IDS, GIDS_GENRES, GENRE_PAGINA
  };
  // de demo-etalage staat als data apart; hij vult alleen aan wat ontbreekt
  const { seed } = require('./demozaken')(ctx);
  const api = { ETAGES, seed };
  Object.assign(api, require('./catalogus')(ctx)); // vult ctx met de boutiekweergaven
  Object.assign(api, require('./diensten')(ctx)); // vult ctx met het Dienstenplein
  Object.assign(api, require('./thuisplein')(ctx)); // vult ctx met de verdieping RTG Thuis
  Object.assign(api, require('./etalage')(ctx));
  /* De commerciele voorkant van heel RTG: het locatiemodel, het universele
     aanbod-object over alle domeinen heen, en de zoek-/ontdeklaag erboven.
     Staat NA de etalage omdat de aanbod-bronnen haar helpers (thuisplein,
     verborgen, farmTeKoop) uit dezelfde ctx halen. */
  Object.assign(api, require('./plek')(ctx));   // vult ctx.plek
  Object.assign(api, require('./stand')(ctx));  // vult ctx.stand: de Supplier OS-koppeling
  Object.assign(api, require('./aanbod')(ctx)); // vult ctx.aanbodAlles
  Object.assign(api, require('./zoek')(ctx));
  Object.assign(api, require('./lijsten')(ctx));   // bewaren en een reis bouwen
  Object.assign(api, require('./aanvragen')(ctx)); // de vraagkant: wat niemand aanbiedt
  Object.assign(api, require('./collecties')(ctx)); // collectie, bundel, evenement, seizoen
  Object.assign(api, require('./vraagbeeld')(ctx)); // wat gevraagd en niet geleverd wordt
  Object.assign(api, require('./spiegel')(ctx));    // zo staat een zaak in de Mall
  return { mall: api };
}

module.exports = { maakMall, MALL_ETAGES: ETAGES };
