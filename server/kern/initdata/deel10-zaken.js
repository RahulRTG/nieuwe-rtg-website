/* Boot-datalaag, deel 10: een demozaak voor de genres die nog leeg waren.

   De aanmeldingen-kern kent 31 genres waarin een bedrijf zich kan aanmelden
   (kern/aanmeldingen/bedrijf.js). Voor zes daarvan stond nergens een partner, en
   een leeg genre is geen kleinigheid: het is een hoek waar geen enkele controle
   komt. Het proefpubliek (test/gezelschap.js) loopt langs elk genre waar een
   partner staat, dus wat leeg blijft wordt door niets aangeraakt -- als daar iets
   stuk is, merkt niemand het.

   De caps komen NIET uit een lijstje maar uit wat een zaak werkelijk heeft
   (kern/werkvormen.js: capsVan). Daarom heeft elke zaak hier echte inhoud: een
   menukaart, een vloot, een collectie of diensten. Anders staat de zaak er wel,
   maar kan haar app niets.

   Pure data; deel10-genres.js zaait ze en zet de types. */
module.exports = [
  { code: 'SOMBRA', name: 'Club Sombra', type: 'club', city: 'Ibiza',
    loc: { lat: 38.906, lng: 1.437, label: 'Marina Botafoch, Ibiza-stad' }, rate: 0.15, photos: [],
    menu: [
      { id: 'c1', cat: 'Dranken', name: 'Champagne, fles', desc: 'Aan tafel geserveerd.', price: 180, allergens: [], station: 'bar' },
      { id: 'c2', cat: 'Dranken', name: 'Gin-tonic', desc: 'Met de gin van het huis.', price: 16, allergens: [], station: 'bar' },
      { id: 'c3', cat: 'Snacks', name: 'Olijven en amandelen', desc: 'Voor bij de tafel.', price: 9, allergens: ['noten'] }
    ],
    activiteiten: [
      { id: 'a1', name: 'Nacht op de bovenverdieping', desc: 'Eigen tafel, eigen ingang, tot sluit.',
        prijs: 95, tijden: ['23:00'], capaciteit: 40 }
    ] },

  { code: 'IVORA', name: 'Atelier Ivora', type: 'modehuis', city: 'Ibiza',
    loc: { lat: 38.909, lng: 1.434, label: 'Dalt Vila, Ibiza-stad' }, rate: 0.14, photos: [],
    collecties: [
      { id: 'm1', naam: 'Linnen, zomer', stuks: 24, desc: 'Ongebleekt linnen, op maat vermaakt.' },
      { id: 'm2', naam: 'Avond', stuks: 9, desc: 'Kleine oplage; alles op afspraak gepast.' }
    ],
    services: [
      { id: 'ms1', name: 'Stylingafspraak', desc: 'Een uur in het atelier, met de maker zelf.',
        price: 0, duurMin: 60, soort: 'dienst' },
      { id: 'ms2', name: 'Vermaken op maat', desc: 'Wat u koopt zit ook echt.', price: 45, duurMin: 30, soort: 'dienst' }
    ] },

  { code: 'ISLATR', name: 'Isla Transfers', type: 'vervoer', city: 'Ibiza',
    loc: { lat: 38.873, lng: 1.373, label: 'Luchthaven Ibiza' }, rate: 0.13, photos: [], menu: [],
    fleet: [
      { id: 'f1', naam: 'Sedan', plaatsen: 3, kenteken: 'IB-100-A' },
      { id: 'f2', naam: 'Van', plaatsen: 7, kenteken: 'IB-200-B' }
    ] },

  { code: 'CUIDADO', name: 'Cuidado Casa', type: 'care', city: 'Ibiza',
    loc: { lat: 38.912, lng: 1.44, label: 'aan huis, heel het eiland' }, rate: 0.1, photos: [], menu: [],
    services: [
      { id: 'z1', name: 'Zorg aan huis, ochtend', desc: 'Vaste verzorgende, vast tijdvak.',
        price: 65, duurMin: 90, soort: 'dienst' },
      { id: 'z2', name: 'Gezelschap en boodschappen', desc: 'Een middag mee op pad.',
        price: 40, duurMin: 120, soort: 'dienst' }
    ] },

  { code: 'RUTA', name: 'Ruta Blanca', type: 'activiteiten', city: 'Ibiza',
    loc: { lat: 38.98, lng: 1.3, label: 'Sant Antoni, Ibiza' }, rate: 0.12, photos: [], menu: [],
    activiteiten: [
      { id: 'r1', name: 'Wandeling bij zonsopgang', desc: 'Drie uur, kleine groep, met ontbijt.',
        prijs: 55, tijden: ['06:30'], capaciteit: 12 },
      { id: 'r2', name: 'Zeegrotten per kajak', desc: 'Halve dag, inclusief uitrusting.',
        prijs: 80, tijden: ['09:00', '14:00'], capaciteit: 8 }
    ] },

  { code: 'VAKISLA', name: 'Vakwerk Isla', type: 'vakwerk', city: 'Ibiza',
    loc: { lat: 38.95, lng: 1.43, label: 'aan huis, heel het eiland' }, rate: 0.11, photos: [], menu: [],
    services: [
      { id: 'v1', name: 'Timmerwerk op maat', desc: 'Kast, deur of terras; eerst kijken, dan een prijs.',
        price: 75, duurMin: 60, soort: 'dienst' },
      { id: 'v2', name: 'Klus van een halve dag', desc: 'Vier uur, materiaal apart.',
        price: 260, duurMin: 240, soort: 'dienst' }
    ] }
];
