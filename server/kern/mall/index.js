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
  { id: 'eigen',    label: 'RTG eigen-merk',       icon: '🛒' },
  { id: 'mode',     label: 'Mode',                 icon: '👗' },
  { id: 'sieraden', label: 'Sieraden & horloges',  icon: '💎' },
  { id: 'leer',     label: 'Leer & accessoires',   icon: '👜' },
  { id: 'wonen',    label: 'Wonen & interieur',    icon: '🛋️' },
  { id: 'beauty',   label: 'Parfum & beauty',      icon: '🧴' },
  { id: 'land',     label: 'Van het land',         icon: '🌾' }
];
// de etages waar retail-boutieks op landen (eigen-merk en boerderij vullen we apart)
const ETAGE_IDS = ETAGES.map(e => e.id).filter(id => id !== 'eigen' && id !== 'land');

/* De gids "Alle leveranciers": naast de koop-etages toont de Mall elke partner,
   gegroepeerd per genre, met een diepe link naar de plek waar je daar boekt of
   reserveert. Alleen de gastvrije/lifestyle-genres horen in de mall-gids; de
   hulpdiensten, zorgketen en defensie horen hier niet thuis. De volgorde is
   bewust: eerst tafelen en verblijven, dan uitgaan en beleven, dan de rest. */
const GIDS_GENRES = [
  'restaurant', 'hotel', 'apartment', 'villa', 'bar', 'club', 'beachclub',
  'koffie', 'chef', 'wellness', 'juwelier', 'galerie', 'retail', 'boerderij',
  'activiteit', 'events', 'taxi', 'jet', 'helikopter', 'verhuur', 'tweewielers',
  'charter', 'vastgoed', 'zorg'
];
// waar je een genre boekt/reserveert in de app (de diepe link vanuit de gids)
const GENRE_PAGINA = {
  restaurant: '/apps/foodcourt.html',
  hotel: '/apps/hotels.html', apartment: '/apps/hotels.html', villa: '/apps/hotels.html',
  bar: '/apps/uitgaan.html', club: '/apps/uitgaan.html', beachclub: '/apps/uitgaan.html',
  retail: '/apps/mall.html', juwelier: '/apps/mall.html', boerderij: '/apps/mall.html'
};

function maakMall({ db, save, crypto, isRetail }) {
  const nu = () => new Date().toISOString();
  const va = (sku, kleuren, maten, v) => {
    const out = [];
    for (const k of kleuren) for (const m of maten) out.push({ vsku: sku + '-' + k.slice(0, 3).toUpperCase() + '-' + m, kleur: k, maat: m, voorraad: v });
    return out;
  };

  function seed() {
    if (!db.data.suppliers || !Array.isArray(db.data.suppliers)) return;
    if (!db.data.supplierTypes.retail)
      db.data.supplierTypes.retail = { label: 'Mode & retail', icon: '🛍️', caps: ['retail', 'location', 'pricing'] };
    // de bestaande modepartner op de mode-etage zetten
    const maison = db.data.suppliers.find(s => s.code === 'MAISON');
    if (maison && !maison.mall) maison.mall = { etage: 'mode', tagline: 'Stille luxe uit eigen atelier, gesneden op de Riviera.' };

    if (db.data._mallSeed) return;
    db.data._mallSeed = true;
    const boutieks = [
      {
        code: 'ORFEVRE', name: 'Maison Orfèvre', type: 'retail', city: 'Ibiza',
        loc: { lat: 38.906, lng: 1.436, label: 'Dalt Vila, Ibiza' }, rate: 0.10, menu: [], photos: [],
        settings: { retailDrempel: 2 }, mall: { etage: 'sieraden', tagline: 'Hoge juwelierskunst en horloges, met de hand gezet.' },
        collecties: [{ id: crypto.randomBytes(4).toString('hex'), naam: 'Astrale', seizoen: 'AW', jaar: 2026, actief: true, at: nu() }],
        artikelen: [
          { id: crypto.randomBytes(4).toString('hex'), sku: 'ORF-RING', naam: 'Solitaire ring', categorie: 'Ringen',
            materiaal: '18k witgoud, laboratoriumdiamant', omschrijving: 'Klassieke solitaire, onzichtbare zetting.', foto: null,
            publiekePrijs: 4200, price: 4200, drop: null, at: nu(), varianten: va('ORF-RING', ['Witgoud', 'Roségoud'], ['50', '54', '58'], 2) },
          { id: crypto.randomBytes(4).toString('hex'), sku: 'ORF-WATCH', naam: 'Automaat horloge', categorie: 'Horloges',
            materiaal: 'Titanium, saffierglas', omschrijving: 'In-house uurwerk, 72 uur gangreserve.', foto: null,
            publiekePrijs: 8900, price: 8900, drop: null, at: nu(), varianten: va('ORF-WATCH', ['Antraciet', 'Zilver'], ['39mm', '41mm'], 1) }
        ],
        klanten: {}
      },
      {
        code: 'CUIRHUIS', name: 'Le Cuir', type: 'retail', city: 'Ibiza',
        loc: { lat: 38.908, lng: 1.434, label: 'Marina Botafoch, Ibiza' }, rate: 0.10, menu: [], photos: [],
        settings: { retailDrempel: 3 }, mall: { etage: 'leer', tagline: 'Leerwaren, gelooid en gestikt op bestelling.' },
        collecties: [{ id: crypto.randomBytes(4).toString('hex'), naam: 'Voyage', seizoen: 'SS', jaar: 2026, actief: true, at: nu() }],
        artikelen: [
          { id: crypto.randomBytes(4).toString('hex'), sku: 'CUI-TAS', naam: 'Weekendtas', categorie: 'Tassen',
            materiaal: 'Plantaardig gelooid rundleer', omschrijving: 'Handgestikt, messing beslag, katoenen voering.', foto: null,
            publiekePrijs: 1650, price: 1650, drop: null, at: nu(), varianten: va('CUI-TAS', ['Cognac', 'Zwart'], ['one'], 4) },
          { id: crypto.randomBytes(4).toString('hex'), sku: 'CUI-RIEM', naam: 'Ceintuur', categorie: 'Riemen',
            materiaal: 'Volnerf kalfsleer', omschrijving: 'Omkeerbaar, geborsteld gesp.', foto: null,
            publiekePrijs: 240, price: 240, drop: null, at: nu(), varianten: va('CUI-RIEM', ['Cognac', 'Zwart'], ['85', '90', '95'], 6) }
        ],
        klanten: {}
      }
    ];
    for (const b of boutieks) if (!db.data.suppliers.find(s => s.code === b.code)) db.data.suppliers.push(b);
    // een demo-boerderij voor de etage "Van het land"
    if (!db.data.supplierTypes.boerderij)
      db.data.supplierTypes.boerderij = { label: 'Boerderij & tuinderij', icon: '🌾', caps: ['boerderij', 'location', 'pricing'] };
    if (!db.data.suppliers.find(s => s.code === 'HOEVE')) {
      db.data.suppliers.push({
        code: 'HOEVE', name: 'Hoeve del Sol', type: 'boerderij', city: 'Ibiza',
        loc: { lat: 38.98, lng: 1.43, label: 'Santa Gertrudis, Ibiza' }, rate: 0.10, menu: [], photos: [],
        mall: { etage: 'land', tagline: 'Vers van het eiland: groente, olijfolie en honing van eigen erf.' },
        boerderij: {
          type: 'gemengd', opgezet: true, percelen: [], dieren: [], taken: [], instel: {},
          producten: [
            { id: crypto.randomBytes(4).toString('hex'), naam: 'Olijfolie extra vergine', eenheid: 'fles 500 ml', prijs: 18, voorraad: 120, bron: 'oogst' },
            { id: crypto.randomBytes(4).toString('hex'), naam: 'Bloesemhoning', eenheid: 'pot 350 g', prijs: 9, voorraad: 80, bron: 'oogst' },
            { id: crypto.randomBytes(4).toString('hex'), naam: 'Groentepakket van het seizoen', eenheid: 'per pakket', prijs: 22, voorraad: 40, bron: 'oogst' }
          ]
        },
        klanten: {}
      });
    }
    save();
  }

  function isBoer(s) { return !!s && ((db.data.supplierTypes[s.type] || {}).caps || []).includes('boerderij'); }
  const farmTeKoop = s => ((s.boerderij && s.boerderij.producten) || []).filter(p => (p.prijs || 0) > 0 && (p.voorraad || 0) > 0);
  // een leverancier die het kantoor in de Mall heeft verborgen (schakelaar in de
  // boardroom); geldt voor zowel de koop-etages als de gids
  function verborgen(s) { return !!(s && s.mall && s.mall.verborgen); }

  // de gedeelde ctx voor de deelbestanden
  const ctx = {
    db, save, crypto, isRetail, nu, va, seed, isBoer, farmTeKoop, verborgen, winkelCatalogus,
    ETAGES, ETAGE_IDS, GIDS_GENRES, GENRE_PAGINA
  };
  const api = { ETAGES, seed };
  Object.assign(api, require('./catalogus')(ctx)); // vult ctx met de boutiekweergaven
  Object.assign(api, require('./etalage')(ctx));
  return { mall: api };
}

module.exports = { maakMall, MALL_ETAGES: ETAGES };
