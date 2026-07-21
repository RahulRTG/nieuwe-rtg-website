/* De vaste inrichting van de RTG Home Kit: de kamers, de standaard-
   apparaten van een nieuwe woning (id's blijven stabiel) en de
   demo-scenemotor. Pure data; de logica woont in ../homekit.js. */

const KAMERS = ['Woonkamer', 'Keuken', 'Slaapkamer', 'Badkamer', 'Werkkamer', 'Hal', 'Terras'];

// de standaard-inrichting van een nieuwe woning (id's blijven stabiel)
const BASIS = [
  { id: 'lamp-woon', kamer: 'Woonkamer', naam: 'Plafondlamp', soort: 'lamp', icon: '💡', stand: { aan: false, dim: 80 } },
  { id: 'lamp-sfeer', kamer: 'Woonkamer', naam: 'Sfeerlampen', soort: 'lamp', icon: '🕯️', stand: { aan: false, dim: 40 } },
  { id: 'tv-woon', kamer: 'Woonkamer', naam: 'Televisie', soort: 'tv', icon: '📺', stand: { aan: false } },
  { id: 'speaker-woon', kamer: 'Woonkamer', naam: 'Speakers', soort: 'audio', icon: '🔊', stand: { aan: false, volume: 30 } },
  { id: 'gordijn-woon', kamer: 'Woonkamer', naam: 'Gordijnen', soort: 'gordijn', icon: '🪟', stand: { open: true } },
  { id: 'thermostaat', kamer: 'Woonkamer', naam: 'Thermostaat', soort: 'klimaat', icon: '🌡️', stand: { aan: true, temp: 20 } },
  { id: 'lamp-keuken', kamer: 'Keuken', naam: 'Keukenlamp', soort: 'lamp', icon: '💡', stand: { aan: false, dim: 100 } },
  { id: 'koffie', kamer: 'Keuken', naam: 'Koffiezetter', soort: 'stekker', icon: '☕', stand: { aan: false } },
  { id: 'vaatwasser', kamer: 'Keuken', naam: 'Vaatwasser', soort: 'stekker', icon: '🫧', stand: { aan: false } },
  { id: 'lamp-slaap', kamer: 'Slaapkamer', naam: 'Bedlampjes', soort: 'lamp', icon: '🛏️', stand: { aan: false, dim: 30 } },
  { id: 'gordijn-slaap', kamer: 'Slaapkamer', naam: 'Gordijnen', soort: 'gordijn', icon: '🪟', stand: { open: true } },
  { id: 'wekker', kamer: 'Slaapkamer', naam: 'Wekkerlicht', soort: 'lamp', icon: '⏰', stand: { aan: false, dim: 50 } },
  { id: 'lamp-bad', kamer: 'Badkamer', naam: 'Spiegellamp', soort: 'lamp', icon: '🪞', stand: { aan: false, dim: 100 } },
  { id: 'vloer-bad', kamer: 'Badkamer', naam: 'Vloerverwarming', soort: 'klimaat', icon: '🦶', stand: { aan: false, temp: 22 } },
  { id: 'lamp-werk', kamer: 'Werkkamer', naam: 'Bureaulamp', soort: 'lamp', icon: '💡', stand: { aan: false, dim: 90 } },
  { id: 'monitor', kamer: 'Werkkamer', naam: 'Beeldschermen', soort: 'stekker', icon: '🖥️', stand: { aan: false } },
  { id: 'slot-voordeur', kamer: 'Hal', naam: 'Voordeurslot', soort: 'slot', icon: '🔒', stand: { opSlot: true } },
  { id: 'lamp-hal', kamer: 'Hal', naam: 'Hallamp', soort: 'lamp', icon: '💡', stand: { aan: false, dim: 60 } },
  { id: 'lamp-terras', kamer: 'Terras', naam: 'Terrasverlichting', soort: 'lamp', icon: '🌿', stand: { aan: false, dim: 50 } },
  { id: 'laadpaal', kamer: 'Terras', naam: 'Laadpaal', soort: 'stekker', icon: '🔌', stand: { aan: true } }
];

// de demo-scenemotor: herkenbare wensen krijgen een doordacht voorstel
const DEMO_SCENES = [
  { als: /film|serie|bios/i, naam: 'Filmavond', uitleg: 'Licht gedimd, tv en speakers aan, gordijnen dicht en de verwarming behaaglijk.',
    standen: { 'lamp-woon': { aan: false }, 'lamp-sfeer': { aan: true, dim: 20 }, 'tv-woon': { aan: true }, 'speaker-woon': { aan: true, volume: 45 }, 'gordijn-woon': { open: false }, 'thermostaat': { aan: true, temp: 21 } } },
  { als: /slaap|nacht|welterusten|bed/i, naam: 'Welterusten', uitleg: 'Alles beneden uit, bedlampjes zacht aan, gordijnen dicht en de verwarming een graad lager.',
    standen: { 'lamp-woon': { aan: false }, 'lamp-sfeer': { aan: false }, 'tv-woon': { aan: false }, 'speaker-woon': { aan: false }, 'lamp-keuken': { aan: false }, 'lamp-hal': { aan: false }, 'lamp-terras': { aan: false }, 'lamp-slaap': { aan: true, dim: 20 }, 'gordijn-slaap': { open: false }, 'thermostaat': { aan: true, temp: 18 } } },
  { als: /ochtend|opstaan|wakker|goedemorgen/i, naam: 'Rustige ochtend', uitleg: 'Wekkerlicht en keuken aan, koffie gezet, gordijnen open en de badkamervloer warm.',
    standen: { 'wekker': { aan: true, dim: 60 }, 'gordijn-slaap': { open: true }, 'gordijn-woon': { open: true }, 'lamp-keuken': { aan: true, dim: 100 }, 'koffie': { aan: true }, 'vloer-bad': { aan: true, temp: 23 }, 'thermostaat': { aan: true, temp: 20 } } },
  { als: /werk|focus|concentr|thuiswerken/i, naam: 'Aan het werk', uitleg: 'Werkkamer helder verlicht, beeldschermen aan en de rest van het huis rustig.',
    standen: { 'lamp-werk': { aan: true, dim: 100 }, 'monitor': { aan: true }, 'speaker-woon': { aan: false }, 'tv-woon': { aan: false }, 'thermostaat': { aan: true, temp: 20 } } },
  { als: /weg|vertrek|uit huis|vakantie/i, naam: 'Iedereen weg', uitleg: 'Alle lampen en apparaten uit en de verwarming zuinig. Het slot doet u zelf; dat hoort zo.',
    standen: { 'lamp-woon': { aan: false }, 'lamp-sfeer': { aan: false }, 'lamp-keuken': { aan: false }, 'lamp-slaap': { aan: false }, 'lamp-bad': { aan: false }, 'lamp-werk': { aan: false }, 'lamp-hal': { aan: false }, 'lamp-terras': { aan: false }, 'tv-woon': { aan: false }, 'speaker-woon': { aan: false }, 'koffie': { aan: false }, 'monitor': { aan: false }, 'thermostaat': { aan: true, temp: 16 } } },
  { als: /romant|diner|date|kaars/i, naam: 'Romantisch diner', uitleg: 'Zachte sfeerverlichting, rustige muziek en de gordijnen dicht.',
    standen: { 'lamp-woon': { aan: false }, 'lamp-sfeer': { aan: true, dim: 15 }, 'lamp-keuken': { aan: true, dim: 40 }, 'speaker-woon': { aan: true, volume: 25 }, 'gordijn-woon': { open: false }, 'thermostaat': { aan: true, temp: 21 } } }
];

module.exports = { KAMERS, BASIS, DEMO_SCENES };
