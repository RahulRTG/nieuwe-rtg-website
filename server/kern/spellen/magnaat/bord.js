/* Spelmotor "magnaat", data (kern/spellen): het bord zelf - de 40 velden in de
   RTG-wereld, de kans/kas-kaarten en de huurfactor per aantal huizen. Pure,
   statische data zonder context; de motor (index.js) rekent ermee. Afgesplitst
   uit magnaat.js zodat de motor dun blijft. */
const M_GROEP_HUIZEN = [1, 5, 12, 35, 70, 120]; // huurfactor bij 0..5 huizen (5 = hotel)
const M_VELDEN = [
  { t: 'start', n: 'Start' },
  { t: 'straat', n: 'Strandtent Ibiza', p: 60, g: 0 }, { t: 'kas', n: 'Kas' }, { t: 'straat', n: 'Beachclub Blanca', p: 60, g: 0 },
  { t: 'belasting', n: 'Toeristenbelasting', p: 200 }, { t: 'station', n: 'RTG Transfers', p: 200 },
  { t: 'straat', n: 'Tapasbar Sol', p: 100, g: 1 }, { t: 'kans', n: 'Kans' }, { t: 'straat', n: 'Bodega Mar', p: 100, g: 1 }, { t: 'straat', n: 'Chiringuito Luz', p: 120, g: 1 },
  { t: 'cel', n: 'Op bezoek / de cel' },
  { t: 'straat', n: 'Salon Amsterdam', p: 140, g: 2 }, { t: 'nut', n: 'RTG Energie', p: 150 }, { t: 'straat', n: 'Grachtenatelier', p: 140, g: 2 }, { t: 'straat', n: 'Modehuis Noord', p: 160, g: 2 },
  { t: 'station', n: 'RTG Jets', p: 200 },
  { t: 'straat', n: 'Bistro Milaan', p: 180, g: 3 }, { t: 'kas', n: 'Kas' }, { t: 'straat', n: 'Galleria Moda', p: 180, g: 3 }, { t: 'straat', n: 'Teatro Aperto', p: 200, g: 3 },
  { t: 'vrij', n: 'Vrij parkeren' },
  { t: 'straat', n: 'Rooftop Barcelona', p: 220, g: 4 }, { t: 'kans', n: 'Kans' }, { t: 'straat', n: 'Casa del Arte', p: 220, g: 4 }, { t: 'straat', n: 'Mercado Central', p: 240, g: 4 },
  { t: 'station', n: 'RTG Yachts', p: 200 },
  { t: 'straat', n: 'Spa Kyoto', p: 260, g: 5 }, { t: 'straat', n: 'Theehuis Zen', p: 260, g: 5 }, { t: 'nut', n: 'RTG Water', p: 150 }, { t: 'straat', n: 'Ryokan Sakura', p: 280, g: 5 },
  { t: 'naarcel', n: 'Ga naar de cel' },
  { t: 'straat', n: 'Club Saint-Tropez', p: 300, g: 6 }, { t: 'straat', n: 'Vignoble Azur', p: 300, g: 6 }, { t: 'kas', n: 'Kas' }, { t: 'straat', n: 'Palais Riviera', p: 320, g: 6 },
  { t: 'station', n: 'RTG Rail', p: 200 },
  { t: 'kans', n: 'Kans' }, { t: 'straat', n: 'Penthouse Dubai', p: 350, g: 7 }, { t: 'belasting', n: 'Weeldebelasting', p: 100 }, { t: 'straat', n: 'Marina Skyline', p: 400, g: 7 }
];
const M_KAARTEN = [
  { tekst: 'De Salon deelt je post: ontvang 50.', geld: 50 },
  { tekst: 'Dividend van RTG Jets: ontvang 100.', geld: 100 },
  { tekst: 'Fooienpot van je beachclub: ontvang 25.', geld: 25 },
  { tekst: 'Achterstallig onderhoud: betaal 75.', geld: -75 },
  { tekst: 'Parkeerboete op de boulevard: betaal 40.', geld: -40 },
  { tekst: 'Je wint de RTG-quiz: ontvang 150.', geld: 150 },
  { tekst: 'Ga direct naar Start en ontvang 200.', naar: 0 },
  { tekst: 'Storm op zee: je jacht moet de haven in. Betaal 60.', geld: -60 },
  { tekst: 'Ga direct naar de cel, zonder langs Start te komen.', cel: true },
  { tekst: 'Iedereen proost op jou: elke speler betaalt je 20.', vanIeder: 20 }
];

module.exports = { M_GROEP_HUIZEN, M_VELDEN, M_KAARTEN };
