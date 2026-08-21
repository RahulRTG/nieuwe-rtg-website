/* HET GENRE-REGISTER, deel data (eerste helft: verblijf tot en met onderwijs).

   De uitleg over WAAROM dit register bestaat, wat `status` betekent en waarom
   er maar een lijst mag zijn, staat in ./genres-lijst.js -- daar wordt deze
   helft ook weer aan de andere geplakt. Hier staat alleen data.

   AFGESPLITST OMDAT EEN PRODUCTBESTAND ONDER DE 10 KB HOORT (keuringsregel 13).
   De snede loopt langs een sectiegrens en niet op de byte: hierboven staat wat een gast koopt, hieronder wat een overheid regelt. */
'use strict';

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

};
