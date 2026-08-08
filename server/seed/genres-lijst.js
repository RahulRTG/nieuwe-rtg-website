/* HET GENRE-REGISTER, deel data: de 73 bedrijfssoorten met hun sector en caps.
   Pure data; de mechaniek (zetRegister, zetGenre, genresVan) staat in ./genres.js
   en de uitleg waarom dit register bestaat ook. Afgesplitst omdat een
   productbestand niet over de 12 KB hoort (keuringsregel), net als deel9-zaken.js
   en deel10-zaken.js dat doen.

   Emoji staan als \u{...}: keuringsregel 3b verbiedt emoji-tekens in server/. */
module.exports = {

  // Verblijf
  hotel: { label: 'Hotel', icon: 'hotel', industry: 'hospitality', caps: ['bookings', 'location', 'pricing'] },
  apartment: { label: 'Appartement', icon: 'maison', industry: 'hospitality', caps: ['bookings', 'doors', 'location', 'pricing'] },
  villa: { label: 'Villa\'s & fincas', icon: '\u{1F334}', industry: 'hospitality', caps: ['bookings', 'doors', 'location', 'pricing'] },
  wintersport: { label: 'Wintersport & seizoensresort', icon: '\u{26F7}', industry: 'hospitality', caps: ['alpine', 'location', 'pricing'] },

  // Horeca & nachtleven
  restaurant: { label: 'Restaurant', icon: 'horeca', industry: 'horeca', caps: ['menu', 'orders', 'reservations', 'tickets', 'location', 'pricing'] },
  bar: { label: 'Bar', icon: 'bar', industry: 'horeca', caps: ['menu', 'orders', 'tickets', 'location', 'pricing'] },
  club: { label: 'Club', icon: 'muziek', industry: 'horeca', caps: ['menu', 'orders', 'tickets', 'location', 'pricing'] },
  beachclub: { label: 'Beachclub', icon: '\u{1F3D6}', industry: 'horeca', caps: ['menu', 'orders', 'reservations', 'tickets', 'location', 'pricing'] },
  koffie: { label: 'Koffie & patisserie', icon: 'bar', industry: 'horeca', caps: ['menu', 'orders', 'location', 'pricing'] },
  chef: { label: 'Privéchef & catering', icon: '\u{1F468}\u{200D}\u{1F373}', industry: 'horeca', caps: ['services', 'location', 'pricing'] },

  // Vervoer
  taxi: { label: 'Taxi', icon: 'auto', industry: 'mobility', caps: ['rides', 'location', 'pricing'] },
  verhuur: { label: 'Autoverhuur', icon: 'sleutel', industry: 'mobility', caps: ['huur', 'location', 'pricing'] },
  tweewielers: { label: 'Tweewielers & quads', icon: '\u{1F6F5}', industry: 'mobility', caps: ['huur', 'location', 'pricing'] },
  vervoer: { label: 'Vervoer & transfers', icon: 'auto', industry: 'mobility', caps: ['rides', 'location', 'pricing'] },
  ov: { label: 'Openbaar vervoer', icon: 'ov', industry: 'mobility', caps: ['ov', 'location', 'pricing'] },
  vracht: { label: 'Vracht & expeditie', icon: '\u{1F6A2}', industry: 'mobility', caps: ['vracht', 'location', 'pricing'] },

  // Luchtvaart
  jet: { label: 'Privéjet', icon: 'vluchten', industry: 'aviation', caps: ['rides', 'location', 'pricing'] },
  helikopter: { label: 'Helikopter transfers', icon: 'vluchten', industry: 'aviation', caps: ['rides', 'fleet', 'location', 'pricing'] },
  luchthaven: { label: 'Luchthaven', icon: 'vluchten', industry: 'aviation', caps: ['luchthaven'] },

  // Maritiem
  charter: { label: 'Boten & jachten', icon: 'boot', industry: 'maritime', caps: ['charter', 'location', 'pricing'] },
  marina: { label: 'Marina & jachthaven', icon: '\u{2693}', industry: 'maritime', caps: ['marina', 'location', 'pricing'] },

  // Automotive
  autogarage: { label: 'Autogarage & werkplaats', icon: 'auto', industry: 'automotive', caps: ['services', 'location', 'pricing'] },

  // Retail
  retail: { label: 'Mode & retail', icon: 'mode', industry: 'retail', caps: ['retail', 'location', 'pricing'] },
  modehuis: { label: 'Modehuis & atelier', icon: 'winkel', industry: 'retail', caps: ['retail', 'services', 'location', 'pricing'] },
  juwelier: { label: 'Juwelier & horloges', icon: '\u{1F48E}', industry: 'retail', caps: ['retail', 'services', 'location', 'pricing'] },

  // Groothandel
  groothandel: { label: 'Groothandel & markt', icon: 'logistiek', industry: 'wholesale', caps: ['groothandel', 'bezorgen', 'location', 'pricing'] },

  // Agrarisch
  boerderij: { label: 'Boerderij & landbouw', icon: 'oogst', industry: 'agriculture', caps: ['boerderij', 'location', 'pricing'] },

  // Zorg
  zorg: { label: 'Zorg & welzijn', icon: 'zorg', industry: 'healthcare', caps: ['care', 'location', 'pricing'] },
  care: { label: 'Zorg aan huis', icon: 'zorg', industry: 'healthcare', caps: ['services', 'location', 'pricing'] },
  ziekenhuis: { label: 'Ziekenhuis', icon: '\u{1F3E5}', industry: 'healthcare', caps: ['location'] },
  huisarts: { label: 'Huisarts', icon: '\u{1FA7A}', industry: 'healthcare', caps: ['location'] },
  specialist: { label: 'Medisch specialist', icon: '\u{1FAC0}', industry: 'healthcare', caps: ['location'] },
  tandarts: { label: 'Tandartspraktijk', icon: 'zorg', industry: 'healthcare', caps: ['services', 'location', 'pricing'] },

  // Farmacie
  apotheek: { label: 'Apotheek', icon: '\u{1F48A}', industry: 'pharmacy', caps: ['location'] },

  // Dierenzorg
  dierenarts: { label: 'Dierenartspraktijk', icon: 'zorg', industry: 'veterinary', caps: ['services', 'location', 'pricing'] },
  petcare: { label: 'Petcare & pension', icon: '\u{1F43E}', industry: 'veterinary', caps: ['petcare', 'location', 'pricing'] },

  // Beauty & wellness
  beautysalon: { label: 'Beauty-salon & barbier', icon: '\u{2702}', industry: 'beauty', caps: ['beauty', 'location', 'pricing'] },
  beautymedical: { label: 'Beauty medical', icon: '\u{2728}', industry: 'beauty', caps: ['location'] },
  wellness: { label: 'Wellness & spa', icon: '\u{1F9D6}', industry: 'beauty', caps: ['services', 'bookings', 'location', 'pricing'] },

  // Kinderopvang
  kinderopvang: { label: 'Kinderopvang & nanny', icon: '\u{1F9F8}', industry: 'childcare', caps: ['opvang', 'location', 'pricing'] },

  // Onderwijs
  rijschool: { label: 'Rijschool', icon: 'auto', industry: 'education', caps: ['services', 'location', 'pricing'] },

  // Overheid
  gemeente: { label: 'Gemeente & overheid', icon: 'gebouw', industry: 'government', caps: ['gemeente', 'location'] },
  rijk: { label: 'Rijksoverheid', icon: 'gebouw', industry: 'government', caps: ['rijk'] },

  // Veiligheid & hulpdiensten
  politie: { label: 'Politie', icon: '\u{1F694}', industry: 'safety', caps: ['location'] },
  brandweer: { label: 'Brandweer', icon: '\u{1F692}', industry: 'safety', caps: ['location'] },
  ambulance: { label: 'Ambulance', icon: '\u{1F691}', industry: 'safety', caps: ['location'] },
  marechaussee: { label: 'Marechaussee', icon: 'schild', industry: 'safety', caps: ['marechaussee'] },
  defensie: { label: 'Defensie', icon: '\u{1F396}\u{FE0F}', industry: 'safety', caps: ['location'], besloten: true },
  specials: { label: 'Special Forces', icon: '\u{1F985}', industry: 'safety', caps: ['location'], besloten: true },
  beveiliging: { label: 'Beveiliging & security', icon: 'schild', industry: 'safety', caps: ['beveiliging', 'location', 'pricing'] },

  // Bouw & vakwerk
  bouw: { label: 'Bouw & installatie', icon: 'werk', industry: 'construction', caps: ['services', 'location', 'pricing'] },
  vakwerk: { label: 'Vakwerk & klussen', icon: 'werk', industry: 'construction', caps: ['services', 'location', 'pricing'] },
  schoonmaak: { label: 'Schoonmaak & huishouden', icon: 'werk', industry: 'construction', caps: ['services', 'location', 'pricing'] },
  hovenier: { label: 'Hovenier & tuinen', icon: 'oogst', industry: 'construction', caps: ['services', 'location', 'pricing'] },
  wasserij: { label: 'Wasserij & stomerij', icon: 'werk', industry: 'construction', caps: ['services', 'location', 'pricing'] },
  verhuizer: { label: 'Verhuisservice', icon: 'logistiek', industry: 'construction', caps: ['services', 'location', 'pricing'] },

  // Vastgoed
  vastgoed: { label: 'Vastgoed & makelaar', icon: 'gebouw', industry: 'realestate', caps: ['vastgoed', 'location', 'pricing'] },

  // Facility
  kantoorgebouw: { label: 'Kantoorgebouw (RTG Enterprise)', icon: '\u{1F3E2}', industry: 'facility', caps: ['gebouw', 'location', 'pricing'] },

  // Verzekeren
  verzekeringen: { label: 'Verzekeringen (advies)', icon: '\u{1F6E1}', industry: 'insurance', caps: ['polis', 'location', 'pricing'] },

  // Zakelijke dienstverlening
  professioneel: { label: 'Professionele diensten', icon: '\u{2696}', industry: 'professional', caps: ['advies', 'location', 'pricing'] },
  zzp: { label: 'Zelfstandig professional', icon: 'werk', industry: 'professional', caps: ['services', 'location', 'pricing'] },

  // Technologie
  ithulp: { label: 'IT-hulp aan huis', icon: 'werk', industry: 'technology', caps: ['services', 'location', 'pricing'] },

  // Media
  journalistiek: { label: 'Journalistiek', icon: 'nieuws', industry: 'media', caps: ['redactie', 'location', 'pricing'] },
  creator: { label: 'Content creator', icon: 'camera', industry: 'media', caps: ['creator', 'location', 'pricing'] },
  fotograaf: { label: 'Fotografie & film', icon: 'camera', industry: 'media', caps: ['services', 'location', 'pricing'] },

  // Events & cultuur
  events: { label: 'Events & festivals', icon: '\u{1F3AA}', industry: 'events', caps: ['tickets', 'rides', 'location', 'pricing'] },
  activiteit: { label: 'Activiteiten & musea', icon: 'ticket', industry: 'events', caps: ['tickets', 'rides', 'location', 'pricing'] },
  activiteiten: { label: 'Activiteiten & excursies', icon: 'tickets', industry: 'events', caps: ['tickets', 'location', 'pricing'] },
  galerie: { label: 'Kunst & galerie', icon: '\u{1F5BC}', industry: 'events', caps: ['tickets', 'retail', 'location', 'pricing'] },
  weddingplanner: { label: 'Weddings & prive-events', icon: '\u{1F492}', industry: 'events', caps: ['weddings', 'location', 'pricing'] },

  // Sport
  sportclub: { label: 'Sportclub', icon: 'sport', industry: 'sports', caps: ['sportclub'] },
  golfclub: { label: 'Golf & countryclub', icon: '\u{26F3}', industry: 'sports', caps: ['golf', 'location', 'pricing'] },
  fitnessclub: { label: 'Sport & fitnessclub', icon: '\u{1F3CB}', industry: 'sports', caps: ['fitclub', 'location', 'pricing'] }
};
