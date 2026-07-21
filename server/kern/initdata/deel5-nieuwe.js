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
    vracht:      { label: 'Vracht & expeditie', icon: '\u{1F6A2}', caps: ['vracht', 'location', 'pricing'] },
    kantoorgebouw: { label: 'Kantoorgebouw (Zuidas)', icon: '\u{1F3E2}', caps: ['gebouw', 'location', 'pricing'] },
    golfclub:    { label: 'Golf & countryclub', icon: '\u{26F3}', caps: ['golf', 'location', 'pricing'] },
    fitnessclub: { label: 'Sport & fitnessclub', icon: '\u{1F3CB}️', caps: ['fitclub', 'location', 'pricing'] },
    beautysalon: { label: 'Beauty-salon & barbier', icon: '\u{2702}️', caps: ['beauty', 'location', 'pricing'] },
    petcare:     { label: 'Petcare & pension', icon: '\u{1F43E}', caps: ['petcare', 'location', 'pricing'] },
    kinderopvang: { label: 'Kinderopvang & nanny', icon: '\u{1F9F8}', caps: ['opvang', 'location', 'pricing'] },
    marina:      { label: 'Marina & jachthaven', icon: '\u{2693}', caps: ['marina', 'location', 'pricing'] },
    weddingplanner: { label: 'Weddings & prive-events', icon: '\u{1F492}', caps: ['weddings', 'location', 'pricing'] },
    professioneel: { label: 'Professionele diensten', icon: '\u{2696}️', caps: ['advies', 'location', 'pricing'] },
    verzekeringen: { label: 'Verzekeringen (advies)', icon: '\u{1F6E1}️', caps: ['polis', 'location', 'pricing'] },
    wintersport: { label: 'Wintersport & seizoensresort', icon: '\u{26F7}️', caps: ['alpine', 'location', 'pricing'] }
  };
  for (const [t, def] of Object.entries(NIEUWE_TYPES)) if (!db.data.supplierTypes[t]) db.data.supplierTypes[t] = def;
  const NIEUWE_PARTNERS = require('./deel5-partners');
  for (const p of NIEUWE_PARTNERS) if (!db.data.suppliers.find(s => s.code === p.code)) { db.data.suppliers.push(p); ensureSupplierDefaults(p); }
};
