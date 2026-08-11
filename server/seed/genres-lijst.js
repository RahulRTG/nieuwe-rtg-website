/* HET GENRE-REGISTER, deel data: de 73 bedrijfssoorten met hun sector, caps en
   toegangsstand. Pure data; de mechaniek (zetRegister, zetGenre, genresVan,
   genreToegang) staat in ./genres.js en de uitleg waarom dit register bestaat
   ook. Afgesplitst omdat een productbestand niet over de 12 KB hoort
   (keuringsregel), net als deel9-zaken.js en deel10-zaken.js dat doen.

   DE `status` IS DE ENIGE WAARHEID OVER WIE DIT GENRE MAG AANVRAGEN. De vijf
   standen staan met hun betekenis in ./genres.js (TOEGANG); wie er een
   toevoegt doet dat daar, want genreToegang() moet hem kennen. De vlag
   `besloten: true` op defensie en special forces is hierin opgegaan als status
   'uitnodiging'. Waarom dit veld er is -- en wat de tweede lijst kostte die het
   vervangt -- staat in CONCERN.md.

   Emoji staan als \u{...}: keuringsregel 3b verbiedt emoji-tekens in server/. */
module.exports = {

  // Verblijf
  hotel: { label: 'Hotel', icon: 'hotel', industry: 'hospitality', caps: ['bookings', 'location', 'pricing'], status: 'open' },
  apartment: { label: 'Appartement', icon: 'maison', industry: 'hospitality', caps: ['bookings', 'doors', 'location', 'pricing'], status: 'open' },
  villa: { label: 'Villa\'s & fincas', icon: '\u{1F334}', industry: 'hospitality', caps: ['bookings', 'doors', 'location', 'pricing'], status: 'open' },
  wintersport: { label: 'Wintersport & seizoensresort', icon: '\u{26F7}', industry: 'hospitality', caps: ['alpine', 'location', 'pricing'], status: 'open' },

  // Horeca & nachtleven
  restaurant: { label: 'Restaurant', icon: 'horeca', industry: 'horeca', caps: ['menu', 'orders', 'reservations', 'tickets', 'location', 'pricing'], status: 'open' },
  bar: { label: 'Bar', icon: 'bar', industry: 'horeca', caps: ['menu', 'orders', 'tickets', 'location', 'pricing'], status: 'open' },
  club: { label: 'Club', icon: 'muziek', industry: 'horeca', caps: ['menu', 'orders', 'tickets', 'location', 'pricing'], status: 'open' },
  beachclub: { label: 'Beachclub', icon: '\u{1F3D6}', industry: 'horeca', caps: ['menu', 'orders', 'reservations', 'tickets', 'location', 'pricing'], status: 'open' },
  koffie: { label: 'Koffie & patisserie', icon: 'bar', industry: 'horeca', caps: ['menu', 'orders', 'location', 'pricing'], status: 'open' },
  chef: { label: 'Privéchef & catering', icon: '\u{1F468}\u{200D}\u{1F373}', industry: 'horeca', caps: ['services', 'location', 'pricing'], status: 'open' },

  // Vervoer
  taxi: { label: 'Taxi', icon: 'auto', industry: 'mobility', caps: ['rides', 'location', 'pricing'], status: 'open' },
  verhuur: { label: 'Autoverhuur', icon: 'sleutel', industry: 'mobility', caps: ['huur', 'location', 'pricing'], status: 'open' },
  tweewielers: { label: 'Tweewielers & quads', icon: '\u{1F6F5}', industry: 'mobility', caps: ['huur', 'location', 'pricing'], status: 'open' },
  vervoer: { label: 'Vervoer & transfers', icon: 'auto', industry: 'mobility', caps: ['rides', 'location', 'pricing'], status: 'open' },
  ov: { label: 'Openbaar vervoer', icon: 'ov', industry: 'mobility', caps: ['ov', 'location', 'pricing'], status: 'intern' },
  vracht: { label: 'Vracht & expeditie', icon: '\u{1F6A2}', industry: 'mobility', caps: ['vracht', 'location', 'pricing'], status: 'open' },

  // Luchtvaart
  jet: { label: 'Privéjet', icon: 'vluchten', industry: 'aviation', caps: ['rides', 'location', 'pricing'], status: 'open' },
  helikopter: { label: 'Helikopter transfers', icon: 'vluchten', industry: 'aviation', caps: ['rides', 'fleet', 'location', 'pricing'], status: 'open' },
  luchthaven: { label: 'Luchthaven', icon: 'vluchten', industry: 'aviation', caps: ['luchthaven'], status: 'intern' },

  // Maritiem
  charter: { label: 'Boten & jachten', icon: 'boot', industry: 'maritime', caps: ['charter', 'location', 'pricing'], status: 'open' },
  marina: { label: 'Marina & jachthaven', icon: '\u{2693}', industry: 'maritime', caps: ['marina', 'location', 'pricing'], status: 'open' },

  // Automotive
  autogarage: { label: 'Autogarage & werkplaats', icon: 'auto', industry: 'automotive', caps: ['services', 'location', 'pricing'], status: 'open' },

  // Retail
  retail: { label: 'Mode & retail', icon: 'mode', industry: 'retail', caps: ['retail', 'location', 'pricing'], status: 'open' },
  modehuis: { label: 'Modehuis & atelier', icon: 'winkel', industry: 'retail', caps: ['retail', 'services', 'location', 'pricing'], status: 'open' },
  juwelier: { label: 'Juwelier & horloges', icon: '\u{1F48E}', industry: 'retail', caps: ['retail', 'services', 'location', 'pricing'], status: 'open' },

  // Groothandel
  groothandel: { label: 'Groothandel & markt', icon: 'logistiek', industry: 'wholesale', caps: ['groothandel', 'bezorgen', 'location', 'pricing'], status: 'open' },

  // Agrarisch
  boerderij: { label: 'Boerderij & landbouw', icon: 'oogst', industry: 'agriculture', caps: ['boerderij', 'location', 'pricing'], status: 'open' },

  // Zorg
  zorg: { label: 'Zorg & welzijn', icon: 'zorg', industry: 'healthcare', caps: ['care', 'location', 'pricing'], status: 'open' },
  care: { label: 'Zorg aan huis', icon: 'zorg', industry: 'healthcare', caps: ['services', 'location', 'pricing'], status: 'open' },
  ziekenhuis: { label: 'Ziekenhuis', icon: '\u{1F3E5}', industry: 'healthcare', caps: ['location'], status: 'bewijs' },
  huisarts: { label: 'Huisarts', icon: '\u{1FA7A}', industry: 'healthcare', caps: ['location'], status: 'bewijs' },
  specialist: { label: 'Medisch specialist', icon: '\u{1FAC0}', industry: 'healthcare', caps: ['location'], status: 'bewijs' },
  tandarts: { label: 'Tandartspraktijk', icon: 'zorg', industry: 'healthcare', caps: ['services', 'location', 'pricing'], status: 'open' },

  // Farmacie
  apotheek: { label: 'Apotheek', icon: '\u{1F48A}', industry: 'pharmacy', caps: ['location'], status: 'bewijs' },

  // Dierenzorg
  dierenarts: { label: 'Dierenartspraktijk', icon: 'zorg', industry: 'veterinary', caps: ['services', 'location', 'pricing'], status: 'open' },
  petcare: { label: 'Petcare & pension', icon: '\u{1F43E}', industry: 'veterinary', caps: ['petcare', 'location', 'pricing'], status: 'open' },

  // Beauty & wellness
  beautysalon: { label: 'Beauty-salon & barbier', icon: '\u{2702}', industry: 'beauty', caps: ['beauty', 'location', 'pricing'], status: 'open' },
  beautymedical: { label: 'Beauty medical', icon: '\u{2728}', industry: 'beauty', caps: ['location'], status: 'bewijs' },
  wellness: { label: 'Wellness & spa', icon: '\u{1F9D6}', industry: 'beauty', caps: ['services', 'bookings', 'location', 'pricing'], status: 'open' },

  // Kinderopvang
  kinderopvang: { label: 'Kinderopvang & nanny', icon: '\u{1F9F8}', industry: 'childcare', caps: ['opvang', 'location', 'pricing'], status: 'bewijs' },

  // Onderwijs
  rijschool: { label: 'Rijschool', icon: 'auto', industry: 'education', caps: ['services', 'location', 'pricing'], status: 'open' },

  // Overheid
  gemeente: { label: 'Gemeente & overheid', icon: 'gebouw', industry: 'government', caps: ['gemeente', 'location'], status: 'intern' },
  rijk: { label: 'Rijksoverheid', icon: 'gebouw', industry: 'government', caps: ['rijk'], status: 'intern' },

  // Veiligheid & hulpdiensten
  politie: { label: 'Politie', icon: '\u{1F694}', industry: 'safety', caps: ['location'], status: 'intern' },
  brandweer: { label: 'Brandweer', icon: '\u{1F692}', industry: 'safety', caps: ['location'], status: 'intern' },
  ambulance: { label: 'Ambulance', icon: '\u{1F691}', industry: 'safety', caps: ['location'], status: 'intern' },
  marechaussee: { label: 'Marechaussee', icon: 'schild', industry: 'safety', caps: ['marechaussee'], status: 'intern' },
  defensie: { label: 'Defensie', icon: '\u{1F396}\u{FE0F}', industry: 'safety', caps: ['location'], status: 'uitnodiging' },
  specials: { label: 'Special Forces', icon: '\u{1F985}', industry: 'safety', caps: ['location'], status: 'uitnodiging' },
  beveiliging: { label: 'Beveiliging & security', icon: 'schild', industry: 'safety', caps: ['beveiliging', 'location', 'pricing'], status: 'bewijs' },

  // Bouw & vakwerk
  bouw: { label: 'Bouw & installatie', icon: 'werk', industry: 'construction', caps: ['services', 'location', 'pricing'], status: 'open' },
  vakwerk: { label: 'Vakwerk & klussen', icon: 'werk', industry: 'construction', caps: ['services', 'location', 'pricing'], status: 'open' },
  schoonmaak: { label: 'Schoonmaak & huishouden', icon: 'werk', industry: 'construction', caps: ['services', 'location', 'pricing'], status: 'open' },
  hovenier: { label: 'Hovenier & tuinen', icon: 'oogst', industry: 'construction', caps: ['services', 'location', 'pricing'], status: 'open' },
  wasserij: { label: 'Wasserij & stomerij', icon: 'werk', industry: 'construction', caps: ['services', 'location', 'pricing'], status: 'open' },
  verhuizer: { label: 'Verhuisservice', icon: 'logistiek', industry: 'construction', caps: ['services', 'location', 'pricing'], status: 'open' },

  // Vastgoed
  vastgoed: { label: 'Vastgoed & makelaar', icon: 'gebouw', industry: 'realestate', caps: ['vastgoed', 'location', 'pricing'], status: 'open' },

  // Facility
  kantoorgebouw: { label: 'Kantoorgebouw (RTG Enterprise)', icon: '\u{1F3E2}', industry: 'facility', caps: ['gebouw', 'location', 'pricing'], status: 'open' },

  // Verzekeren
  verzekeringen: { label: 'Verzekeringen (advies)', icon: '\u{1F6E1}', industry: 'insurance', caps: ['polis', 'location', 'pricing'], status: 'bewijs' },

  // Zakelijke dienstverlening
  professioneel: { label: 'Professionele diensten', icon: '\u{2696}', industry: 'professional', caps: ['advies', 'location', 'pricing'], status: 'open' },
  zzp: { label: 'Zelfstandig professional', icon: 'werk', industry: 'professional', caps: ['services', 'location', 'pricing'], status: 'open' },

  // Technologie
  ithulp: { label: 'IT-hulp aan huis', icon: 'werk', industry: 'technology', caps: ['services', 'location', 'pricing'], status: 'open' },

  // Media
  journalistiek: { label: 'Journalistiek', icon: 'nieuws', industry: 'media', caps: ['redactie', 'location', 'pricing'], status: 'open' },
  creator: { label: 'Content creator', icon: 'camera', industry: 'media', caps: ['creator', 'location', 'pricing'], status: 'open' },
  fotograaf: { label: 'Fotografie & film', icon: 'camera', industry: 'media', caps: ['services', 'location', 'pricing'], status: 'open' },

  // Events & cultuur
  events: { label: 'Events & festivals', icon: '\u{1F3AA}', industry: 'events', caps: ['tickets', 'rides', 'location', 'pricing'], status: 'open' },
  activiteit: { label: 'Activiteiten & musea', icon: 'ticket', industry: 'events', caps: ['tickets', 'rides', 'location', 'pricing'], status: 'open' },
  activiteiten: { label: 'Activiteiten & excursies', icon: 'tickets', industry: 'events', caps: ['tickets', 'location', 'pricing'], status: 'open' },
  galerie: { label: 'Kunst & galerie', icon: '\u{1F5BC}', industry: 'events', caps: ['tickets', 'retail', 'location', 'pricing'], status: 'open' },
  weddingplanner: { label: 'Weddings & prive-events', icon: '\u{1F492}', industry: 'events', caps: ['weddings', 'location', 'pricing'], status: 'open' },

  // Sport
  sportclub: { label: 'Sportclub', icon: 'sport', industry: 'sports', caps: ['sportclub'], status: 'open' },
  golfclub: { label: 'Golf & countryclub', icon: '\u{26F3}', industry: 'sports', caps: ['golf', 'location', 'pricing'], status: 'open' },
  fitnessclub: { label: 'Sport & fitnessclub', icon: '\u{1F3CB}', industry: 'sports', caps: ['fitclub', 'location', 'pricing'], status: 'open' }
};
