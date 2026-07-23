/* Boot-datalaag, deel 3/7 (sectoren): een aaneengesloten blok
   db.data-standaarden/demo-seed uit initRealtime. Afgesplitst uit server.js; de
   context levert db, save en de seed-helpers. Draait in vaste volgorde via ./index. */
module.exports = (ctx) => {
  const { db, save, crypto, sessions, tokenHash, ensureSupplierDefaults, webpush, DEMO, PERSONAS, GIDS_SEED_TIERS } = ctx;
  if (!db.data.charterLocaties) db.data.charterLocaties = {}; // ref -> { aan, lat, lng, at } (positie op het water)
  // De Salon-verplichting voor de demo-partners wordt onderaan initRealtime gezet
  // (na alle genre-seeds), zodat elke geseede partner een compleet profiel krijgt.
  // contracten: elke zaak kan een contract (verhuur/personeel/algemeen) opstellen
  // en aan een lid of personeelslid sturen; beide partijen tekenen digitaal
  if (!db.data.contracten) db.data.contracten = [];
  // het vastgoed-genre: makelaars bieden hun aanbod aan, gericht aan gekozen
  // leden (via de Salon of prive), met biedingen, bezichtigingen en keyless
  // toegang, en snelle contracten via het contractsysteem
  if (!db.data.supplierTypes.vastgoed)
    db.data.supplierTypes.vastgoed = { label: 'Vastgoed & makelaar', icon: 'gebouw', caps: ['vastgoed', 'location', 'pricing'] };
  if (!db.data.suppliers.find(s => s.code === 'IBIZALIV')) {
    db.data.suppliers.push({
      code: 'IBIZALIV', name: 'Ibiza Living Estates', type: 'vastgoed', city: 'Ibiza',
      loc: { lat: 38.906, lng: 1.433, label: 'Vara de Rey, Ibiza' }, rate: 0.03,
      menu: [], photos: [],
      panden: [
        { id: 'p1', titel: 'Villa Can Blau, zeezicht', soort: 'villa', transactie: 'koop', prijs: 3450000,
          plaats: 'Cala Jondal, Ibiza', adres: 'Carrer de Cala Jondal 8', slaapkamers: 5, badkamers: 4, oppervlakte: 420, perceel: 1800,
          tuin: true, zwembad: true, garage: 2, energielabel: 'A', status: 'beschikbaar',
          omschrijving: 'Moderne villa met infinity pool, gastenverblijf en panoramisch zeezicht over Es Vedra.', fotos: [], keyless: true },
        { id: 'p2', titel: 'Penthouse Marina Botafoch', soort: 'appartement', transactie: 'koop', prijs: 1290000,
          plaats: 'Marina Botafoch, Ibiza', adres: 'Passeig Joan Carles I 21', slaapkamers: 3, badkamers: 2, oppervlakte: 165, perceel: 0,
          tuin: false, zwembad: true, garage: 1, energielabel: 'B', status: 'beschikbaar',
          omschrijving: 'Penthouse met dakterras, gemeenschappelijk zwembad en jachthavenzicht.', fotos: [], keyless: true },
        { id: 'p3', titel: 'Finca met olijfgaard', soort: 'woning', transactie: 'huur', prijs: 8500,
          plaats: 'Santa Gertrudis, Ibiza', adres: 'Cami de Sa Vinya 4', slaapkamers: 4, badkamers: 3, oppervlakte: 300, perceel: 12000,
          tuin: true, zwembad: true, garage: 0, energielabel: 'C', status: 'beschikbaar',
          omschrijving: 'Authentieke finca, per maand te huur, midden in het groen met eigen olijfgaard.', fotos: [], keyless: false }
      ]
    });
  }
  // --- retail/mode: modehuizen, merken en winkels ---
  if (!db.data.supplierTypes.retail)
    db.data.supplierTypes.retail = { label: 'Mode & retail', icon: 'mode', caps: ['retail', 'location', 'pricing'] };
  if (!db.data.suppliers.find(s => s.code === 'MAISON')) {
    const c1 = crypto.randomBytes(4).toString('hex'), c2 = crypto.randomBytes(4).toString('hex');
    const va = (sku, kleuren, maten, v) => { const out = []; for (const k of kleuren) for (const m of maten) out.push({ vsku: sku + '-' + k.slice(0, 3).toUpperCase() + '-' + m, kleur: k, maat: m, voorraad: v }); return out; };
    db.data.suppliers.push({
      code: 'MAISON', name: 'Maison Solène', type: 'retail', city: 'Ibiza',
      loc: { lat: 38.907, lng: 1.435, label: 'Carrer Bisbe Azara, Ibiza' }, rate: 0.10,
      menu: [], photos: [],
      settings: { retailDrempel: 3 },
      modebezorg: { aan: true, straalKm: 15, kosten: 6.5, gratisVanaf: 150, waardegrensId: 250, retourAanDeur: true },
      collecties: [
        { id: c1, naam: 'Riviera', seizoen: 'SS', jaar: 2026, actief: true, at: new Date().toISOString() },
        { id: c2, naam: 'Atelier Noir', seizoen: 'AW', jaar: 2026, actief: true, at: new Date().toISOString() }
      ],
      artikelen: [
        { id: crypto.randomBytes(4).toString('hex'), sku: 'SOL-LIN01', naam: 'Linnen overhemd', collectieId: c1, categorie: 'Overhemden',
          materiaal: '100% Europees linnen', omschrijving: 'Luchtig zomeroverhemd, mother-of-pearl knopen.', foto: null,
          publiekePrijs: 320, price: 320, drop: null, at: new Date().toISOString(),
          varianten: va('SOL-LIN01', ['Ecru', 'Zeeblauw'], ['S', 'M', 'L', 'XL'], 6) },
        { id: crypto.randomBytes(4).toString('hex'), sku: 'SOL-SLIP', naam: 'Zijden slipdress', collectieId: c1, categorie: 'Jurken',
          materiaal: 'Sandwashed zijde', omschrijving: 'Bias-cut jurk met verstelbare bandjes.', foto: null,
          publiekePrijs: 690, price: 690, drop: null, at: new Date().toISOString(),
          varianten: va('SOL-SLIP', ['Champagne', 'Onyx'], ['XS', 'S', 'M', 'L'], 4) },
        { id: crypto.randomBytes(4).toString('hex'), sku: 'SOL-TRENCH', naam: 'Atelier trenchcoat', collectieId: c2, categorie: 'Jassen',
          materiaal: 'Waterafstotend gabardine', omschrijving: 'Dubbele rij knopen, afneembare ceintuur.', foto: null,
          publiekePrijs: 1450, price: 1450, drop: { datum: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), tijd: '11:00', gereleased: false }, at: new Date().toISOString(),
          varianten: va('SOL-TRENCH', ['Camel', 'Zwart'], ['S', 'M', 'L'], 2) }
      ],
      klanten: {}
    });
  }
  if (!db.data.retailApart) db.data.retailApart = [];
  if (!Array.isArray(db.data.modeBezorg)) db.data.modeBezorg = [];   // veilige mode-bezorgingen
  // --- groothandel & markt: B2B naar horeca, boodschappen naar leden, doorverkoop ---
  if (!db.data.supplierTypes.groothandel)
    db.data.supplierTypes.groothandel = { label: 'Groothandel & markt', icon: 'logistiek', caps: ['groothandel', 'bezorgen', 'location', 'pricing'] };
  if (!Array.isArray(db.data.groothandelOrders)) db.data.groothandelOrders = [];
  if (!db.data.suppliers.find(s => s.code === 'MERCABIZA')) {
    const gp = (naam, categorie, eenheid, inkoop, cons, voorraad, minB, herkomst) => ({
      id: crypto.randomBytes(4).toString('hex'), naam, categorie, eenheid,
      inkoopPrijs: inkoop, consumentPrijs: cons, voorraad, minBestel: minB, btw: 9, herkomst: herkomst || '', allergenen: '', actief: true
    });
    db.data.suppliers.push({
      code: 'MERCABIZA', name: 'Mercabiza Groothandel', type: 'groothandel', city: 'Ibiza',
      loc: { lat: 38.906, lng: 1.421, label: "Poligono Montecristo, Ibiza" }, rate: 0.08,
      menu: [], photos: [],
      groothandel: {
        functies: {},   // wordt met de standaard (alles aan) gevuld door de kern
        producten: [
          gp('Verse tonijn (loin)', 'Vlees & vis', 'kg', 22, 32, 40, 2, 'Middellandse Zee'),
          gp('Zeebaars heel', 'Vlees & vis', 'kg', 14, 21, 30, 2, 'Spanje'),
          gp('Iberico secreto', 'Vlees & vis', 'kg', 18, 27, 25, 2, 'Spanje'),
          gp('Manchego 12 mnd', 'Zuivel', 'stuk', 9, 14, 60, 1, 'La Mancha'),
          gp('Roomboter', 'Zuivel', 'pak', 3, 4.5, 120, 4, 'NL'),
          gp('Trostomaten', 'Groente & fruit', 'kg', 2.2, 3.4, 90, 3, 'Almería'),
          gp('Citroenen', 'Groente & fruit', 'net', 1.8, 2.9, 80, 2, 'Valencia'),
          gp('Olijfolie extra vergine 5L', 'Droog & houdbaar', 'can', 28, 39, 45, 1, 'Andalusië'),
          gp('Cava brut', 'Dranken', 'fles', 6, 11, 200, 6, 'Penedès'),
          gp('Mineraalwater 1,5L', 'Dranken', 'krat', 4.5, 7, 150, 4, 'ES'),
          gp('Diepvriesfriet 2,5kg', 'Diepvries', 'zak', 4.2, 6.5, 70, 3, 'NL'),
          gp('Servetten (pak 500)', 'Non-food', 'pak', 5, 8, 100, 2, '')
        ]
      }
    });
  }
  // --- beveiliging: een commandocentrum + PDA voor topbeveiligingsteams ---
  if (!db.data.supplierTypes.beveiliging)
    db.data.supplierTypes.beveiliging = { label: 'Beveiliging & security', icon: 'schild', caps: ['beveiliging', 'location'] };
  if (!Array.isArray(db.data.bevDiensten)) db.data.bevDiensten = [];
  if (!Array.isArray(db.data.bevAanvragen)) db.data.bevAanvragen = [];
  if (!Array.isArray(db.data.bevIncidenten)) db.data.bevIncidenten = [];
  if (!Array.isArray(db.data.bevRondes)) db.data.bevRondes = [];
};
