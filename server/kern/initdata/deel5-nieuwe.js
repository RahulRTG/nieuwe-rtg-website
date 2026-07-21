/* Boot-datalaag, deel 5/7 (nieuwe): een aaneengesloten blok
   db.data-standaarden/demo-seed uit initRealtime. Afgesplitst uit server.js; de
   context levert db, save en de seed-helpers. Draait in vaste volgorde via ./index. */
module.exports = (ctx) => {
  const { db, save, crypto, sessions, tokenHash, ensureSupplierDefaults, webpush, DEMO, PERSONAS, GIDS_SEED_TIERS } = ctx;
  /* ---- de negen nieuwe sectoren: elke sector een eigen app-ingang op
     dezelfde motor. De types wijzen naar bestaande vermogens (caps), zodat
     kassa, personeel, facturen, contracten, borden en AI overal meteen
     werken; per sector een demopartner om mee te spelen. ---- */
  const NIEUWE_TYPES = {
    beachclub:   { label: 'Beachclub', icon: '\u{1F3D6}️', caps: ['menu', 'orders', 'reservations', 'tickets', 'location', 'pricing'] },
    koffie:      { label: 'Koffie & patisserie', icon: '☕', caps: ['menu', 'orders', 'location', 'pricing'] },
    chef:        { label: 'Privéchef & catering', icon: '\u{1F468}‍\u{1F373}', caps: ['services', 'location', 'pricing'] },
    villa:       { label: "Villa's & fincas", icon: '\u{1F334}', caps: ['bookings', 'doors', 'location', 'pricing'] },
    tweewielers: { label: 'Tweewielers & quads', icon: '\u{1F6F5}', caps: ['huur', 'location', 'pricing'] },
    events:      { label: 'Events & festivals', icon: '\u{1F3AA}', caps: ['tickets', 'rides', 'location', 'pricing'] },
    wellness:    { label: 'Wellness & spa', icon: '\u{1F9D6}', caps: ['services', 'bookings', 'location', 'pricing'] },
    juwelier:    { label: 'Juwelier & horloges', icon: '\u{1F48E}', caps: ['retail', 'services', 'location', 'pricing'] },
    galerie:     { label: 'Kunst & galerie', icon: '\u{1F5BC}️', caps: ['tickets', 'retail', 'location', 'pricing'] },
    vracht:      { label: 'Vracht & expeditie', icon: '\u{1F6A2}', caps: ['vracht', 'location', 'pricing'] }
  };
  for (const [t, def] of Object.entries(NIEUWE_TYPES)) if (!db.data.supplierTypes[t]) db.data.supplierTypes[t] = def;
  const NIEUWE_PARTNERS = [
    { code: 'VORA', name: 'Vora Beach Club', type: 'beachclub', city: 'Ibiza',
      loc: { lat: 38.995, lng: 1.535, label: 'Cala Nova, Ibiza' }, rate: 0.16, photos: [],
      menu: [
        { id: 'v1', cat: 'Bowls', name: 'Tuna poke bowl', desc: 'Verse tonijn, sushirijst, avocado.', price: 24, allergens: ['vis', 'soja'] },
        { id: 'v2', cat: 'Dranken', name: 'Cava rose, fles', desc: 'Gekoeld aan uw bed geserveerd.', price: 58, allergens: [], station: 'bar' },
        { id: 'v3', cat: 'Snacks', name: 'Nachos del mar', desc: 'Voor bij het bed, om te delen.', price: 14, allergens: ['melk'] }
      ] },
    { code: 'BRISA', name: 'Cafe Brisa', type: 'koffie', city: 'Ibiza',
      loc: { lat: 38.908, lng: 1.432, label: 'Vara de Rey, Ibiza-stad' }, rate: 0.15, photos: [],
      menu: [
        { id: 'k1', cat: 'Koffie', name: 'Flat white', desc: 'Dubbele shot, huisgebrande bonen.', price: 4.5, allergens: ['melk'], station: 'bar' },
        { id: 'k2', cat: 'Patisserie', name: 'Ensaimada', desc: 'Vers uit de eigen oven.', price: 5, allergens: ['gluten', 'ei'] },
        { id: 'k3', cat: 'Patisserie', name: 'Taart van de dag', desc: 'Vraag naar de smaak; hele taarten op bestelling.', price: 6.5, allergens: ['gluten', 'melk', 'ei'] }
      ] },
    { code: 'FUEGO', name: 'Chef Fuego', type: 'chef', city: 'Ibiza', vak: 'Privéchef & catering',
      loc: { lat: 38.92, lng: 1.44, label: 'heel het eiland, op locatie' }, rate: 0.1, menu: [], photos: [],
      services: [
        { id: 's1', name: 'Privédiner op de villa, 4 gangen', desc: 'Chef en bediening aan huis; menu op maat, boodschappen inbegrepen.', price: 145, duurMin: 240, soort: 'dienst' },
        { id: 's2', name: 'Catering aan boord, per gast', desc: 'Koude en warme catering voor charters en jets.', price: 65, soort: 'product' },
        { id: 's3', name: 'Paella-workshop, groep', desc: 'Twee uur samen koken en daarna samen eten.', price: 480, duurMin: 120, soort: 'dienst' }
      ] },
    { code: 'LUNARA', name: 'Casa Lunara', type: 'villa', city: 'Ibiza',
      loc: { lat: 38.887, lng: 1.29, label: 'Es Cubells, Ibiza' }, rate: 0.12, menu: [], photos: [],
      rooms: [
        { id: 'w1', name: 'Villa Lunara, 6 gasten', desc: 'Eigen chef-keuken, infinity pool, drie suites', price: 1450, available: true },
        { id: 'w2', name: 'Finca Vella, 8 gasten', desc: 'Historische finca met wijngaard en gastenverblijf', price: 1850, available: true }
      ],
      doors: [
        { id: 'd1', name: 'Poort (oprit)', locked: true },
        { id: 'd2', name: 'Villa Lunara', locked: true },
        { id: 'd3', name: 'Finca Vella', locked: true }
      ] },
    { code: 'MOTOISLA', name: 'Moto Isla', type: 'tweewielers', city: 'Ibiza',
      loc: { lat: 38.906, lng: 1.42, label: 'Ibiza-stad, ringweg' }, rate: 0.12, menu: [], photos: [],
      autos: [
        { id: 'm1', name: 'Vespa Primavera 125', plate: 'IB-88-VP', dagprijs: 35, actief: true,
          categorie: 'Scooter', transmissie: 'automaat', brandstof: 'benzine', stoelen: 2, deuren: 0,
          airco: false, bagage: 1, kmPerDag: 0, meerKm: 0, borg: 150, minLeeftijd: 18, icoon: '\u{1F6F5}' },
        { id: 'm2', name: 'Yamaha MT-07', plate: 'IB-70-MT', dagprijs: 79, actief: true,
          categorie: 'Motor (A2)', transmissie: 'handgeschakeld', brandstof: 'benzine', stoelen: 2, deuren: 0,
          airco: false, bagage: 1, kmPerDag: 250, meerKm: 0.2, borg: 500, minLeeftijd: 21, icoon: '\u{1F3CD}️' },
        { id: 'm3', name: 'CFMOTO CForce quad', plate: 'IB-44-QD', dagprijs: 95, actief: true,
          categorie: 'Quad', transmissie: 'automaat', brandstof: 'benzine', stoelen: 2, deuren: 0,
          airco: false, bagage: 1, kmPerDag: 150, meerKm: 0.3, borg: 600, minLeeftijd: 21, icoon: '\u{1F69C}' }
      ] },
    { code: 'FESTA', name: 'Festa Ibiza Events', type: 'events', city: 'Ibiza',
      loc: { lat: 38.955, lng: 1.23, label: 'Cala Comte, Ibiza' }, rate: 0.14, menu: [], photos: [],
      activiteiten: [
        { id: 'e1', name: 'Sunset Sessions, dagticket', desc: 'Live acts op het strand, van middag tot middernacht.', prijs: 65, capaciteit: 400, duur: 'hele dag', tijden: ['14:00'] },
        { id: 'e2', name: 'VIP-deck met host', desc: 'Eigen deck, host en fles-service voor uw groep.', prijs: 240, capaciteit: 40, duur: 'hele avond', tijden: ['18:00'] }
      ] },
    { code: 'SERENA', name: 'Serena Spa', type: 'wellness', city: 'Ibiza',
      loc: { lat: 38.98, lng: 1.53, label: 'Santa Eularia, Ibiza' }, rate: 0.12, menu: [], photos: [],
      services: [
        { id: 'w1', name: 'Deep tissue massage, 60 min', desc: 'In een van onze cabines of op uw suite.', price: 95, duurMin: 60, soort: 'dienst' },
        { id: 'w2', name: 'Spa-dag voor twee', desc: 'Hammam, sauna, behandeling en lunch.', price: 260, duurMin: 300, soort: 'dienst' },
        { id: 'w3', name: 'Gua sha thuisset', desc: 'Onze eigen lijn, geleverd op de kamer.', price: 45, soort: 'product' }
      ],
      rooms: [
        { id: 'c1', name: 'Cabine Mar', desc: 'Behandelcabine met zeezicht', price: 0, available: true },
        { id: 'c2', name: 'Cabine Bosc', desc: 'Behandelcabine aan de tuin', price: 0, available: true }
      ] },
    { code: 'ORODOR', name: "Casa d'Oro", type: 'juwelier', city: 'Ibiza',
      loc: { lat: 38.909, lng: 1.435, label: 'Dalt Vila, Ibiza' }, rate: 0.1, menu: [], photos: [],
      services: [
        { id: 'j1', name: 'Privé-afspraak in de salon', desc: 'Een uur met onze meester-juwelier, op afspraak.', price: 0, duurMin: 60, soort: 'dienst' },
        { id: 'j2', name: 'Taxatie met certificaat', desc: 'Voor verzekering of verkoop, klaar terwijl u wacht.', price: 85, duurMin: 45, soort: 'dienst' },
        { id: 'j3', name: 'Ontwerp op maat, aanbetaling', desc: 'Eigen ontwerp, gesmeed in ons atelier.', price: 500, soort: 'product' }
      ] },
    { code: 'LIENZO', name: 'Galeria Lienzo', type: 'galerie', city: 'Ibiza',
      loc: { lat: 38.907, lng: 1.434, label: 'Dalt Vila, Ibiza' }, rate: 0.1, menu: [], photos: [],
      activiteiten: [
        { id: 'g1', name: 'Expositie-entree', desc: 'Hedendaagse eilandkunst, wisselende collectie.', prijs: 10, capaciteit: 60, duur: 'vrij bezoek', tijden: ['11:00', '14:00', '17:00'] },
        { id: 'g2', name: 'Vernissage met de kunstenaar', desc: 'Besloten avond, cava en rondleiding.', prijs: 35, capaciteit: 30, duur: '2 uur', tijden: ['19:00'] }
      ] },
    { code: 'TERRAMAR', name: 'TerraMar Cargo', type: 'vracht', city: 'Ibiza',
      loc: { lat: 38.912, lng: 1.448, label: 'Haven van Ibiza' }, rate: 0.08, menu: [], photos: [] }
  ];
  for (const p of NIEUWE_PARTNERS) if (!db.data.suppliers.find(s => s.code === p.code)) { db.data.suppliers.push(p); ensureSupplierDefaults(p); }
};
