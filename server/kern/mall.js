/* De RTG Mall: de luxe shoppingmall in de leden-app en de enige plek waar je
   binnen RTG koopt. Een gecureerde lijst met etages (verdiepingen): het RTG
   eigen-merk (de hardware en de door het Hardwarelab gepubliceerde ontwerpen)
   plus de mode- en retailpartners. Een mode-boutique opent haar catalogus met
   ledenprijs en verlanglijst; het eigen-merk bestel je direct in de app. De
   mall stelt zich samen uit de partners; een paar demo-boutieks vullen de
   etages.

   Geen echte modemerken; RTG-huisnamen. Beeld met CSS, geen stockfoto's.
   Volgt het vaste kern-patroon maakMall(state). */

const { WINKEL, alleProducten: winkelCatalogus } = require('./winkelcatalogus');

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

  function vanafPrijs(s) {
    const prijzen = (s.artikelen || []).map(a => Math.max(0, Number(a.publiekePrijs || a.price) || 0)).filter(Boolean);
    return prijzen.length ? Math.min(...prijzen) : null;
  }
  function boutiek(s) {
    const cats = [...new Set((s.artikelen || []).map(a => a.categorie).filter(Boolean))];
    return {
      code: s.code, naam: s.name, stad: s.city || null,
      etage: (s.mall && ETAGE_IDS.includes(s.mall.etage)) ? s.mall.etage : 'mode',
      tagline: (s.mall && s.mall.tagline) || 'Een huis binnen de RTG Mall.',
      categorieen: cats.slice(0, 4), aantal: (s.artikelen || []).length, vanaf: vanafPrijs(s)
    };
  }

  /* Het RTG eigen-merk: de vaste winkelcatalogus plus de door het Hardwarelab
     gepubliceerde ontwerpen. Genormaliseerd tot producten met een eenmalige en
     een maandprijs (euro, ex btw). */
  function eigenProducten() {
    const cat = winkelCatalogus(db);
    return Object.entries(cat).map(([slug, p]) => ({
      slug,
      naam: p.naam,
      beschrijving: p.beschrijving || null,
      discipline: p.disciplineLabel || null,
      eigen: p.bron === 'hardwarelab',
      eenmalig: Math.max(0, Number(p.eenmalig) || 0),
      perMaand: Math.max(0, Number(p.perMaand) || 0),
      eenheid: p.eenheid || 'per stuk',
      kleuren: Array.isArray(p.kleuren) ? p.kleuren.slice(0, 3) : []
    }));
  }
  function eigenCatalogus() {
    const producten = eigenProducten();
    return { ok: true, naam: 'RTG Maison', producten, aantal: producten.length, valuta: 'EUR' };
  }

  function eigenBoutiek() {
    const p = eigenProducten();
    if (!p.length) return null;
    const prijzen = p.map(x => x.eenmalig).filter(Boolean);
    return {
      code: '__eigen', kind: 'eigen', naam: 'RTG Maison', stad: 'RTG', etage: 'eigen',
      tagline: 'Het eigen merk van RTG: hardware, wearables en de ontwerpen uit het Hardwarelab.',
      categorieen: [...new Set(p.map(x => x.discipline).filter(Boolean))].slice(0, 4),
      aantal: p.length, vanaf: prijzen.length ? Math.min(...prijzen) : null
    };
  }

  /* Van het land: de boerderijen en tuinderijen met producten die te koop staan
     (prijs en voorraad). Elke boerderij is een boutique; leden bestellen een
     product direct en de voorraad daalt. */
  function farmBoutiek(s) {
    const p = farmTeKoop(s);
    if (!p.length) return null;
    const prijzen = p.map(x => x.prijs).filter(Boolean);
    return {
      code: s.code, kind: 'farm', naam: s.name, stad: s.city || null, etage: 'land',
      tagline: (s.mall && s.mall.tagline) || 'Vers van het erf.',
      categorieen: [], aantal: p.length, vanaf: prijzen.length ? Math.min(...prijzen) : null
    };
  }
  function farmBoutieks() {
    return (db.data.suppliers || []).filter(s => isBoer(s) && !(s.mall && s.mall.verborgen)).map(farmBoutiek).filter(Boolean);
  }
  function farmCatalogus(code) {
    const s = (db.data.suppliers || []).find(x => x.code === String(code || '') && isBoer(x));
    if (!s) return { status: 404, error: 'Boerderij niet gevonden.' };
    return {
      ok: true, naam: s.name, stad: s.city || null,
      producten: farmTeKoop(s).map(p => ({ id: p.id, naam: p.naam, eenheid: p.eenheid, prijs: Math.max(0, Number(p.prijs) || 0), voorraad: p.voorraad })),
      valuta: 'EUR'
    };
  }
  function memberBestelFarm(data) {
    data = data || {};
    const s = (db.data.suppliers || []).find(x => x.code === String(data.code || '') && isBoer(x));
    if (!s) return { status: 404, error: 'Boerderij niet gevonden.' };
    const p = (s.boerderij.producten || []).find(x => x.id === String(data.productId || ''));
    if (!p || !((p.prijs || 0) > 0)) return { status: 400, error: 'Kies een geldig product.' };
    const naam = String(data.naam || '').replace(/[<>]/g, '').trim().slice(0, 60);
    const email = String(data.email || '').trim().toLowerCase().slice(0, 80);
    const aantal = Math.min(100, Math.max(1, Math.round(Number(data.aantal) || 1)));
    if (!naam) return { status: 400, error: 'Vul je naam in voor de levering.' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { status: 400, error: 'Vul een geldig e-mailadres in.' };
    if ((p.voorraad || 0) < aantal) return { status: 409, error: 'Niet genoeg voorraad. Nog ' + (p.voorraad || 0) + ' beschikbaar.' };
    p.voorraad -= aantal;
    if (!Array.isArray(db.data.winkelBestellingen)) db.data.winkelBestellingen = [];
    const entry = {
      id: crypto.randomBytes(4).toString('hex'),
      product: p.id, productNaam: p.naam, aantal,
      prijs: { stuk: Math.max(0, Number(p.prijs) || 0), totaal: Math.round((p.prijs || 0) * aantal * 100) / 100, valuta: 'EUR' },
      leverancier: s.code, leverancierNaam: s.name,
      contactName: naam, email, kanaal: 'lid', status: 'nieuw', at: nu()
    };
    db.data.winkelBestellingen.unshift(entry);
    db.data.winkelBestellingen = db.data.winkelBestellingen.slice(0, 500);
    save();
    return { ok: true, bestelling: { id: entry.id, product: entry.productNaam, aantal, prijs: entry.prijs, restVoorraad: p.voorraad } };
  }

  // een leverancier die het kantoor in de Mall heeft verborgen (schakelaar in de
  // boardroom); geldt voor zowel de koop-etages als de gids
  function verborgen(s) { return !!(s && s.mall && s.mall.verborgen); }

  /* De gids van alle leveranciers, per genre. Elk genre wijst naar de pagina waar
     je die partner boekt of reserveert; genres zonder eigen pagina landen op de
     leden-app. Verborgen partners en partners zonder compleet type slaan we over. */
  function gidsen() {
    const types = db.data.supplierTypes || {};
    const alle = (db.data.suppliers || []).filter(s => s && !verborgen(s));
    const genres = [];
    for (const g of GIDS_GENRES) {
      const def = types[g];
      if (!def) continue;
      const leden = alle.filter(s => s.type === g).map(s => ({
        code: s.code, naam: s.name, stad: s.city || null,
        tagline: (s.mall && s.mall.tagline) || null
      }));
      if (!leden.length) continue;
      genres.push({
        type: g, label: def.label || g, icon: def.icon || '•',
        pagina: GENRE_PAGINA[g] || '/apps/app.html',
        boekbaar: !!GENRE_PAGINA[g], leveranciers: leden, aantal: leden.length
      });
    }
    return { ok: true, genres, aantal: genres.reduce((n, x) => n + x.aantal, 0) };
  }

  /* Boardroom-beheer: het kantoor ziet elke mall-partner en kan hem verbergen of
     zijn etage, tagline en actie bijstellen. Alleen de gastvrije genres (de gids)
     plus de retail-etages en de boerderijen; het eigen-merk beheert RTG zelf. */
  function beheerLijst() {
    const types = db.data.supplierTypes || {};
    const inGids = new Set(GIDS_GENRES);
    return (db.data.suppliers || [])
      .filter(s => s && (inGids.has(s.type) || isRetail(s) || isBoer(s)))
      .map(s => ({
        code: s.code, naam: s.name, stad: s.city || null, type: s.type,
        typeLabel: (types[s.type] || {}).label || s.type,
        etage: (s.mall && s.mall.etage) || (isBoer(s) ? 'land' : (isRetail(s) ? 'mode' : null)),
        tagline: (s.mall && s.mall.tagline) || '',
        deal: (s.mall && s.mall.deal) || '',
        verborgen: verborgen(s),
        koopetage: isRetail(s) || isBoer(s),
        pagina: GENRE_PAGINA[s.type] || '/apps/app.html'
      }));
  }
  function beheer() {
    seed();
    return { ok: true, etages: ETAGES.filter(e => ETAGE_IDS.includes(e.id)), leveranciers: beheerLijst() };
  }
  function beheerZet(code, patch) {
    patch = patch || {};
    const s = (db.data.suppliers || []).find(x => x.code === String(code || ''));
    if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
    if (!s.mall) s.mall = {};
    if (typeof patch.verborgen === 'boolean') s.mall.verborgen = patch.verborgen;
    if (typeof patch.etage === 'string' && ETAGE_IDS.includes(patch.etage)) s.mall.etage = patch.etage;
    if (typeof patch.tagline === 'string') s.mall.tagline = patch.tagline.replace(/[<>]/g, '').trim().slice(0, 140);
    if (typeof patch.deal === 'string') s.mall.deal = patch.deal.replace(/[<>]/g, '').trim().slice(0, 120);
    save();
    return { ok: true, leverancier: beheerLijst().find(x => x.code === s.code) };
  }

  function overzicht() {
    seed();
    const winkels = (db.data.suppliers || []).filter(s => isRetail(s) && !verborgen(s)).map(boutiek);
    const farms = farmBoutieks();
    const etages = ETAGES.map(e => {
      let boutieks = winkels.filter(b => b.etage === e.id);
      if (e.id === 'eigen') { const eb = eigenBoutiek(); boutieks = eb ? [eb] : []; }
      if (e.id === 'land') boutieks = farms;
      return { ...e, boutieks };
    }).filter(e => e.boutieks.length);
    return {
      ok: true,
      etages,
      gids: gidsen().genres,
      totaalBoutieks: winkels.length + farms.length + (eigenBoutiek() ? 1 : 0),
      valuta: 'EUR',
      opmerking: 'De enige plek waar je bij RTG koopt. Ledenprijzen in de boutique; het eigen-merk en de boerderij bestel je direct. Prijzen in euro, exclusief eventuele lokale btw.'
    };
  }

  /* Een lid bestelt een eigen-merk-product rechtstreeks in de app. De
     bestelling landt bij het kantoor (winkelBestellingen, kanaal "lid"); de
     prijs wordt vastgelegd zoals die op dat moment gold. */
  function memberBestel(data) {
    data = data || {};
    const cat = winkelCatalogus(db);
    const product = cat[String(data.slug || data.product || '')];
    if (!product) return { status: 400, error: 'Kies een geldig product.' };
    const naam = String(data.naam || '').replace(/[<>]/g, '').trim().slice(0, 60);
    const email = String(data.email || '').trim().toLowerCase().slice(0, 80);
    const note = String(data.note || '').replace(/[<>]/g, '').trim().slice(0, 500);
    const aantal = Math.min(50, Math.max(1, Math.round(Number(data.aantal) || 1)));
    if (!naam) return { status: 400, error: 'Vul je naam in voor de levering.' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { status: 400, error: 'Vul een geldig e-mailadres in.' };
    if (!Array.isArray(db.data.winkelBestellingen)) db.data.winkelBestellingen = [];
    if (db.data.winkelBestellingen.some(o => o.status === 'nieuw' && o.kanaal === 'lid' && o.email === email && o.product === String(data.slug || data.product)))
      return { status: 409, error: 'Deze bestelling staat al open. We nemen contact met je op.' };
    const entry = {
      id: crypto.randomBytes(4).toString('hex'),
      product: String(data.slug || data.product), productNaam: product.naam, aantal,
      prijs: { eenmalig: product.eenmalig, perMaand: product.perMaand, valuta: 'EUR', exBtw: true },
      contactName: naam, email, note, kanaal: 'lid',
      akkoord: { prijs: true, at: nu() }, status: 'nieuw', at: nu()
    };
    db.data.winkelBestellingen.unshift(entry);
    db.data.winkelBestellingen = db.data.winkelBestellingen.slice(0, 500);
    save();
    return { ok: true, bestelling: { id: entry.id, product: entry.productNaam, aantal, prijs: entry.prijs } };
  }

  return { mall: { ETAGES, overzicht, seed, eigenCatalogus, memberBestel, farmCatalogus, memberBestelFarm, gidsen, beheer, beheerZet } };
}

module.exports = { maakMall, MALL_ETAGES: ETAGES };
