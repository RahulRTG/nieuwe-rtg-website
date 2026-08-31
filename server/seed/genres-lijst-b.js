/* HET GENRE-REGISTER, deel data (tweede helft: overheid tot en met sport).

   De uitleg over WAAROM dit register bestaat, wat `status` betekent en waarom
   er maar een lijst mag zijn, staat in ./genres-lijst.js -- daar wordt deze
   helft ook weer aan de andere geplakt. Hier staat alleen data.

   AFGESPLITST OMDAT EEN PRODUCTBESTAND ONDER DE 10 KB HOORT (keuringsregel 13).
   De snede loopt langs een sectiegrens en niet op de byte: hier begint wat een overheid regelt en wat een vak vraagt. */
'use strict';

module.exports = {
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
  fitnessclub: { label: 'Sport & fitnessclub', icon: '\u{1F3CB}', industry: 'sports', caps: ['fitclub', 'location', 'pricing'], status: 'open' },
  /* De RTFoundation zelf, als houder van haar wallet. Status 'huis': er is er
     precies een en hij wordt aangemaakt (kern/rtfwallet.js), niet aangevraagd
     en niet aangesloten. Geen caps -- dit is geen zaak met een werkvloer maar
     een positie waar geld kan landen. */
  rtfoundation: { label: 'RTFoundation', icon: 'hart', industry: 'nonprofit', caps: [], status: 'huis' }
};
