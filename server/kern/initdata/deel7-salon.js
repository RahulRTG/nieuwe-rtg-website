/* Boot-datalaag, deel 7/7 (salon): een aaneengesloten blok
   db.data-standaarden/demo-seed uit initRealtime. Afgesplitst uit server.js; de
   context levert db, save en de seed-helpers. Draait in vaste volgorde via ./index. */
module.exports = (ctx) => {
  const { db, save, crypto, sessions, tokenHash, ensureSupplierDefaults, webpush, DEMO, PERSONAS, GIDS_SEED_TIERS } = ctx;
  const SALON_BIO = {
    restaurant: 'Fijn dineren met verse, seizoensgebonden gerechten. Reserveer via De Salon.',
    bar: 'Cocktails en sunset-sessies aan het water. Volg ons voor de line-up.',
    hotel: 'Boutiquehotel met zeezicht, spa en persoonlijke service.',
    apartment: 'Stijlvolle appartementen en villa’s met slimme deuren en privacy.',
    taxi: 'Comfortabel privevervoer over het eiland, dag en nacht.',
    jet: 'Privejets op maat, van transfer tot dagtrip, wereldwijd.',
    helikopter: 'Scenic vluchten en snelle transfers per helikopter.',
    zzp: 'Zelfstandig vakmanschap op afspraak, met oog voor detail.',
    activiteit: 'Tours, cruises en experiences om het eiland te beleven.',
    verhuur: 'Auto’s huren zonder verrassingen: vaste prijs en eerlijke staat.',
    charter: 'Boten en jachten charteren, met of zonder schipper, veilig op zee.',
    vastgoed: 'Exclusief vastgoed, discreet aangeboden aan RTG-leden.',
    retail: 'Mode en accessoires uit onze nieuwste collecties.',
    groothandel: 'Groothandel en versmarkt: aan horeca, leden en collega-groothandels, met AI-bijbestellen.',
    beachclub: 'Ligbedden aan zee, keuken en bar aan uw bed. Reserveer uw plek via De Salon.',
    koffie: 'Koffie, patisserie en taarten op bestelling; voorbestellen via de app.',
    chef: 'Privéchef en catering aan huis, op de villa of aan boord.',
    villa: 'Luxe villa’s en fincas met personeel, keyless toegang en conciërge.',
    tweewielers: 'Scooters, motoren en quads: eerlijke staat, vaste prijs, SOS onderweg.',
    events: 'Events en festivals: tickets, VIP-decks en de crew die alles regelt.',
    wellness: 'Wellness en spa: behandelingen op afspraak, in de cabine of op uw suite.',
    juwelier: 'Juwelen en horloges, privé-afspraken en ontwerp op maat.',
    galerie: 'Hedendaagse kunst: exposities, vernissages en stille verkoop.',
    politie: 'Hulpdienst op het RTG-net: meldkamer en eenheden. Geen 112-vervanging.',
    brandweer: 'Hulpdienst op het RTG-net: meldkamer en bluseenheden. Geen 112-vervanging.',
    ambulance: 'Hulpdienst op het RTG-net: meldkamer en overdracht. Geen 112-vervanging.',
    ziekenhuis: 'Zorgpartner op het RTG-net: beddenbord en opnames.',
    huisarts: 'Zorgpartner op het RTG-net: consulten en verwijzingen.',
    specials: 'Besloten eenheid; uitsluitend inzet via een bijstandsverzoek van de politie.',
    apotheek: 'Zorgpartner op het RTG-net: recepten klaarzetten en uitreiken.',
    specialist: 'Zorgpartner op het RTG-net: verwijzingen en specialistische consulten.',
    beautymedical: 'Beauty medical op afspraak; behandelen doen we nooit zonder intake.',
    defensie: 'Defensie-organisatie op het RTG-net: logistiek, paraatheid en onderhoud. Geen wapensysteem.'
  };
  const salonFotoVoor = (s) => {
    const t = db.data.supplierTypes[s.type] || {};
    const kleur = ['#1b3a5b', '#5b2540', '#3a5b2e', '#5b4a1b', '#2e4a5b', '#4a2e5b'][(s.code.charCodeAt(0) + s.code.length) % 6];
    const letters = s.name.replace(/[^A-Za-z ]/g, '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'RTG';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="' + kleur + '"/>' +
      '<text x="160" y="118" font-family="Georgia,serif" font-size="64" fill="#ffffff" text-anchor="middle" opacity="0.92">' + letters + '</text>' +
      '<text x="160" y="160" font-family="Arial,sans-serif" font-size="16" fill="#ffffff" text-anchor="middle" opacity="0.7">' + (t.label || '') + '</text></svg>';
    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  };
  for (const s of db.data.suppliers) {
    if (!s.salon) s.salon = { bio: '', foto: null, volgers: [], sinds: new Date().toISOString() };
    if (!s.salon.bio) s.salon.bio = SALON_BIO[s.type] || 'RTG-partner. Volg ons op De Salon voor aanbod en folders.';
    if (!s.salon.foto && !(s.photos && s.photos.length)) s.salon.foto = salonFotoVoor(s);
  }

  /* Livegang-schoonmaak: in productie (zonder RTG_DEMO) horen de demozaken
     niet in de catalogus, ook niet als de database ooit als demo begon. De
     lijst dekt alle geseede partners; echte partners (via de aanvraag met
     Business Pass) blijven onaangeroerd. */
  if (!DEMO) {
    const DEMO_ZAKEN = ['KIKUNOI', 'PONTO', 'HOSHI', 'SAKURA', 'MKKX', 'JETAG', 'IBIZAIR',
      'AYAKA', 'KAITO', 'ESVEDRA', 'MACE', 'ISLAREN', 'IBIZALIV', 'MAISON', 'MERCABIZA',
      'AZUL', 'AEGIS', 'CANFERRER', 'LUMINA',
      'VORA', 'BRISA', 'FUEGO', 'LUNARA', 'MOTOISLA', 'FESTA', 'SERENA', 'ORODOR', 'LIENZO',
      'GUARDIA', 'BOMBERS', 'URGENCIA', 'CANMISSES', 'CONSULTA', 'FALCO',
      'FARMACIA', 'CARDIO', 'ESTETICA', 'GARNIZOEN'];
    const voor = db.data.suppliers.length;
    db.data.suppliers = db.data.suppliers.filter(s => !DEMO_ZAKEN.includes(s.code));
    // en de bijbehorende voorbeeldposts uit De Salon (de zes geseede verhalen)
    db.data.posts = (db.data.posts || []).filter(p => !(typeof p.id === 'number' && p.id >= 1 && p.id <= 6));
    if (db.data.suppliers.length !== voor) save();
  }
};
