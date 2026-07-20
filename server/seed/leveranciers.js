/* Startdata, deel "leveranciers": de leverancier-typen (caps per type) en de
   voorbeeldzaken met hun demo-inlogcodes, kamers, menu's, deuren en minibars,
   plus de lege orders/ritten/prijsvoorstellen. Afgesplitst uit seed.js; puur
   data. */
module.exports = {
  /* ---------- leveranciers ----------
     De leverancier-app is één app die zich aanpast aan het type. Elk type
     heeft eigen mogelijkheden (caps) die de app-schermen bepalen. Leveranciers
     gebruiken de app gratis in ruil voor de beste dynamische prijs aan RTG. */
  supplierTypes: {
    hotel:      { label: 'Hotel',        icon: '🏨', caps: ['bookings', 'location', 'pricing'] },
    apartment:  { label: 'Appartement',  icon: '🏡', caps: ['bookings', 'doors', 'location', 'pricing'] },
    taxi:       { label: 'Taxi',         icon: '🚘', caps: ['rides', 'location', 'pricing'] },
    jet:        { label: 'Privéjet',     icon: '✈️', caps: ['rides', 'location', 'pricing'] },
    restaurant: { label: 'Restaurant',   icon: '🍽️', caps: ['menu', 'orders', 'reservations', 'tickets', 'location', 'pricing'] },
    bar:        { label: 'Bar',          icon: '🍸', caps: ['menu', 'orders', 'tickets', 'location', 'pricing'] },
    club:       { label: 'Club',         icon: '🎧', caps: ['menu', 'orders', 'tickets', 'location', 'pricing'] },
    zorg:       { label: 'Zorg & welzijn', icon: '🌿', caps: ['care', 'location', 'pricing'] }
  },

  /* Voorbeeldleveranciers (demo-inlogcodes). rate = de dynamische prijs die
     de leverancier aan RTG-leden biedt (intern, nooit aan de klant getoond).
     RTG rekent 0% commissie: de partner houdt 100% van elke boeking. */
  suppliers: [
    {
      code: 'HOSHI', name: 'Aguamarina Ibiza', type: 'hotel', city: 'Ibiza',
      loc: { lat: 38.984, lng: 1.537, label: 'Santa Eularia, Ibiza' }, rate: 0.12,
      menu: [],
      rooms: [
        { id: 'r1', name: 'Sea-view suite', desc: '55 m², zeezicht, eigen terras', price: 780, available: true },
        { id: 'r2', name: 'Garden kamer', desc: '40 m², tuinzicht, loungehoek', price: 520, available: true },
        { id: 'r3', name: 'Cliff suite', desc: '70 m², twee terrassen, butler-service', price: 940, available: false }
      ],
      minibar: [
        { id: 'mb1', name: 'Mineraalwater', price: 6 },
        { id: 'mb2', name: 'Verse jus', price: 8 },
        { id: 'mb3', name: 'Cola', price: 7 },
        { id: 'mb4', name: 'Cava (mini)', price: 14 },
        { id: 'mb5', name: 'Chocolade', price: 9 }
      ]
    },
    {
      code: 'KIKUNOI', name: 'Sal de Mar', type: 'restaurant', city: 'Ibiza',
      loc: { lat: 38.918, lng: 1.451, label: 'Marina Botafoch, Ibiza' }, rate: 0.15,
      menu: [
        { id: 'm1', cat: 'Voorgerechten', name: 'Gazpacho de sandia', desc: 'Koude tomaten-watermeloensoep met basilicum.', price: 16, allergens: [] },
        { id: 'm2', cat: 'Voorgerechten', name: 'Pulpo a la brasa', desc: 'Gegrilde octopus, aardappelcreme, pimenton.', price: 28, allergens: ['vis'] },
        { id: 'm3', cat: 'Hoofdgerechten', name: 'Ibicenca lamsrack', desc: 'Van het eiland, kruidenkorst, seizoensgroenten.', price: 42, allergens: [] },
        { id: 'm4', cat: 'Zoet', name: 'Flao, Ibizaanse kaastaart', desc: 'Met munt en honing, huisrecept.', price: 14, allergens: ['gluten', 'melk', 'ei'] },
        { id: 'm5', cat: 'Dranken', name: 'Cava brut, per glas', desc: 'Huisselectie, koud geserveerd.', price: 12, allergens: [], station: 'bar' }
      ]
    },
    {
      code: 'SAKURA', name: 'Villa Bahia Ibiza', type: 'apartment', city: 'Ibiza',
      loc: { lat: 38.876, lng: 1.325, label: 'Cala Jondal, Ibiza' }, rate: 0.12,
      menu: [],
      rooms: [
        { id: 'a1', name: 'Casa Mar, zeezijde', desc: '65 m², eigen entree, plunge pool', price: 430, available: true },
        { id: 'a2', name: 'Casa Jardin, tuinzijde', desc: '90 m², twee slaapkamers, terras', price: 560, available: true }
      ],
      doors: [
        { id: 'd1', name: 'Voordeur (oprit)', locked: true },
        { id: 'd2', name: 'Casa Mar', locked: true },
        { id: 'd3', name: 'Casa Jardin', locked: true },
        { id: 'd4', name: 'Poolhouse', locked: true }
      ],
      minibar: [
        { id: 'mb1', name: 'Mineraalwater', price: 4 },
        { id: 'mb2', name: 'Craft bier Ibiza', price: 9 },
        { id: 'mb3', name: 'Cava (mini)', price: 12 },
        { id: 'mb4', name: 'Olijven & amandelen', price: 6 }
      ]
    },
    {
      code: 'PONTO', name: 'Sunset Ibiza', type: 'bar', city: 'Ibiza',
      loc: { lat: 38.981, lng: 1.294, label: 'Sant Antoni, Ibiza' }, rate: 0.18,
      menu: [
        { id: 'b1', cat: 'Signatuur', name: 'Hierbas Sunset', desc: 'Ibizaanse kruidenlikeur, citroen, bruisend.', price: 16, allergens: [] },
        { id: 'b2', cat: 'Signatuur', name: 'Sangria blanca', desc: 'Cava, perzik, munt.', price: 15, allergens: [] },
        { id: 'b3', cat: 'Alcoholvrij', name: 'Virgin Colada (0%)', desc: 'Kokos, ananas, geen alcohol.', price: 12, allergens: [] },
        { id: 'b4', cat: 'Hapjes', name: 'Patatas bravas', desc: 'Met pittige saus en aioli.', price: 8, allergens: ['ei'] }
      ]
    },
    {
      code: 'MKKX', name: 'Ibiza Executive Cars', type: 'taxi', city: 'Ibiza',
      loc: { lat: 38.873, lng: 1.373, label: 'Aeroport dEivissa' }, rate: 0.20,
      menu: []
    },
    {
      code: 'JETAG', name: 'Aria Private Aviation', type: 'jet', city: 'Amsterdam', country: 'NL',
      loc: { lat: 52.308, lng: 4.764, label: 'Schiphol Business Aviation' }, rate: 0.10,
      menu: []
    },
    {
      code: 'ZENITH', name: 'Zenith Spa & Wellness', type: 'zorg', city: 'Ibiza',
      loc: { lat: 38.916, lng: 1.448, label: 'Talamanca, Ibiza' }, rate: 0.15,
      menu: []
    },
    {
      code: 'CLARA', name: 'Kliniek Clara Ibiza', type: 'zorg', city: 'Ibiza',
      loc: { lat: 38.907, lng: 1.432, label: 'Vila, Ibiza' }, rate: 0.12,
      menu: []
    }
  ],

  /* Bestellingen (restaurant/bar/club) en ritten (taxi/jet) tussen klant en
     leverancier; live gedeeld via SSE, zichtbaar in de backoffice (db.json). */
  orders: [],
  rides: [],
  supplierPrices: []  // dynamische prijsvoorstellen aan RTG (backoffice)
};
