/* Startdata voor de RTG-portaal-backend. Wordt bij de eerste start
   naar server/data/db.json geschreven; verwijder dat bestand om te resetten. */

module.exports = function seed() {
  return {
    creatorCredit: { rtg: 86, lifestyle: 142, business: 64 },
    creatorLikes: { rtg: 320, lifestyle: 680, business: 210 },

    /* Wederkerigheid: spreekt een Lifestyle-/Business-lid een RTG-lid aan
       (reactie of DM op diens post), dan mag dat RTG-lid bij die persoon
       terugpraten. Alexander sprak Sophie al aan, zie post 3. */
    contacts: [
      { higher: 'Alexander de Vries', rtg: 'Sophie Janssen' }
    ],

    invoices: [
      { id: 'RTG-2026-0158', desc: 'Kyoto, Hoshinoya, 4 nachten', netto: 2840, bijdrage: 190, status: 'open', date: 'Vervalt 28 juli 2026' },
      { id: 'RTG-2026-0141', desc: 'KLM Amsterdam - Osaka, business class (2 pers.)', netto: 3120, bijdrage: 210, status: 'open', date: 'Vervalt 15 augustus 2026' },
      { id: 'RTG-2026-0093', desc: 'Lissabon, Palácio weekend, incl. transfers', netto: 1460, bijdrage: 120, status: 'paid', date: 'Betaald op 2 mei 2026' },
      { id: 'RTG-2025-0871', desc: 'Jaarbijdrage lidmaatschap 2026', netto: 0, bijdrage: 480, status: 'paid', date: 'Betaald op 4 januari 2026' }
    ],

    trip: {
      dest: 'Kyoto',
      dates: '12 - 19 oktober 2026',
      days: 98,
      items: [
        { when: '12 okt', title: 'KLM KL867, Amsterdam → Osaka Kansai', sub: 'Business class, 2 personen · stoelen 2A/2C', status: 'paid', label: 'Bevestigd' },
        { when: '12 okt', title: 'Privétransfer Kansai → Hoshinoya Kyoto', sub: 'Chauffeur wacht bij aankomsthal, naambord RTG', status: 'paid', label: 'Bevestigd' },
        { when: '12-16 okt', title: 'Hoshinoya Kyoto, Riverside suite', sub: '4 nachten, ontbijt op de kamer, late check-out', status: 'open', label: 'Wacht op betaling', invoiceId: 'RTG-2026-0158' },
        { when: '14 okt', title: 'Privé-theeceremonie, Gion', sub: 'Met vertaler · 2 personen · 15:00 uur', status: 'paid', label: 'Bevestigd' },
        { when: '15 okt', title: 'Diner, Kikunoi Honten (3★)', sub: 'Kaiseki-menu · tafel 19:30 uur', status: 'req', label: 'In aanvraag' },
        { when: '16-19 okt', title: 'Ryokan Tawaraya, traditionele kamer', sub: '3 nachten, kaiseki-halfpension', status: 'open', label: 'Wacht op betaling', invoiceId: 'RTG-2026-0141' }
      ]
    },

    posts: [
      {
        id: 1, author: 'Isabelle van Rhijn', tier: 'lifestyle', place: 'Kyoto', visual: 'v-kyoto', image: '/campagne/kyoto-suite.jpg',
        text: 'De theeceremonie die mijn concierge regelde, geen toeristen, geen haast. Dit is waarom ik niet meer zelf boek.',
        baseLikes: 124, likedBy: {}, reward: 6, featured: true,
        comments: [{ who: 'Alexander de Vries', tier: 'business', text: 'Staat genoteerd voor november. Dank.' }]
      },
      {
        id: 2, author: 'Alexander de Vries', tier: 'business', place: 'Zürich', visual: 'v-zurich',
        text: 'Ochtendvlucht, twee vergaderingen, om 18:00 aan het meer. De Business Pass plant de dag strakker dan mijn assistent ooit deed.',
        baseLikes: 89, likedBy: {}, reward: 4,
        comments: []
      },
      {
        id: 3, author: 'Sophie Janssen', tier: 'rtg', place: 'Lissabon', visual: 'v-lissabon', image: '/campagne/palacio.jpg',
        text: 'Voor de prijs van een gewoon hotel een palácio, via één WhatsApp-bericht. Nettoprijzen zijn geen marketing, ze bestaan echt.',
        baseLikes: 203, likedBy: {}, reward: 8, featured: true,
        comments: [
          { who: 'Nadia Karim', tier: 'rtg', text: 'Welk palácio was dit? Sta op het punt te boeken!', lang: 'nl' },
          { who: 'Alexander de Vries', tier: 'business', text: 'Sophie, dit wil ik in november zien, welke wijk was dit?', lang: 'nl' },
          { who: 'James Whitfield', tier: 'business', text: 'Which district was this? I would love to go there in spring.', lang: 'en' }
        ]
      },
      {
        id: 4, author: 'Marcus Bergwerff', tier: 'business', place: 'Singapore', visual: 'v-singapore', image: '/campagne/jet.jpg',
        text: 'Layover van 9 uur omgezet in een middag Raffles + spa. De AI stelde het voor, mijn concierge bevestigde binnen 10 minuten.',
        baseLikes: 57, likedBy: {}, reward: 2, featured: true,
        comments: []
      },
      {
        id: 5, author: 'Nadia Karim', tier: 'rtg', place: 'Marrakech', visual: 'v-marrakech', image: '/campagne/riad.jpg',
        text: 'Riad tegen inkoopprijs, en 30% van mijn bijdrage ging naar de RTFoundation. Reizen dat iets teruggeeft, dat deel vertel ik iedereen.',
        baseLikes: 141, likedBy: {}, reward: 5, featured: true,
        comments: []
      },
      {
        id: 6, author: 'Nadia Karim', tier: 'rtg', place: 'Kyoto', visual: 'v-kyoto', image: '/campagne/bamboe.jpg',
        text: 'Om 07:40 stond de taxi al voor. Het bamboebos vóór de drukte — de Butler wist precies waarom.',
        baseLikes: 96, likedBy: {}, reward: 4, featured: true,
        comments: []
      },
      {
        id: 7, author: 'James Whitfield', tier: 'business', place: 'Hakone', visual: 'v-kyoto', image: '/campagne/onsen.jpg', lang: 'en',
        text: 'The onsen at dusk, maples just turning. My concierge called it "worth the detour" — an understatement.',
        baseLikes: 61, likedBy: {}, reward: 3, featured: true,
        comments: []
      }
    ],

    dms: [],

    /* ---------- partnerkanaal (boeken zonder pas) ----------
       Niet-leden boeken via een partnerlink (boeken.html?via=CODE).
       Prijs = nettoprijs + service; de service wordt gedeeld tussen
       de partner (share van de service) en RTG. */
    partnerService: 0.15,
    /* share = het deel van de service voor de partner, INTERN, wordt nooit
       aan de klant getoond. Bedrijfspartners kunnen een personeelskanaal
       hebben: eigen code, lager servicetarief (arbeidsvoorwaarde). */
    partners: [
      { code: 'NOVA',  name: 'Nova van Dijk',          type: 'influencer', handle: '@novatravels · 380k volgers', share: 0.40 },
      { code: 'ATLAS', name: 'Atlas Executive Travel', type: 'bedrijf',    handle: 'zakelijk reisbureau, Amsterdam', share: 0.35 },
      { code: 'BLOOM', name: 'Bloomingdale Bloemendaal', type: 'bedrijf',  handle: 'strandpaviljoen & events, Bloemendaal aan Zee', share: 0.35,
        staff: { code: 'BLOOM-TEAM', serviceRate: 0.08 } }
    ],
    partnerTrips: [
      {
        id: 'kyoto-herfst', dest: 'Kyoto', visual: 'v-kyoto',
        title: 'Kyoto in herfstkleur', dates: '8 dagen · oktober 2026', netto: 2400,
        desc: 'Hoshinoya aan de rivier, privé-theeceremonie in Gion en de esdoorns van Arashiyama vóór de drukte.',
        includes: ['Vlucht business class', 'Hoshinoya Kyoto, 4 nachten', 'Ryokan Tawaraya, 3 nachten', 'Privétransfers & theeceremonie']
      },
      {
        id: 'lissabon-palacio', dest: 'Lissabon', visual: 'v-lissabon',
        title: 'Palácio-weekend Lissabon', dates: '4 dagen · doorlopend', netto: 980,
        desc: 'Een palácio voor de prijs van een gewoon hotel, hetzelfde adres waar onze leden over posten in De Salon.',
        includes: ['Vlucht & transfers', 'Palácio-suite, 3 nachten', 'Ontbijt & late check-out', 'Tafelreservering fado-avond']
      },
      {
        id: 'marrakech-riad', dest: 'Marrakech', visual: 'v-marrakech',
        title: 'Riad & woestijn Marrakech', dates: '5 dagen · doorlopend', netto: 1150,
        desc: 'Een riad in de medina, hammam en een avond in de Agafay-woestijn, ingekocht zoals wij dat voor leden doen.',
        includes: ['Vlucht & privétransfers', 'Riad, 4 nachten', 'Hammam & diner in de Agafay', 'Gids door de souks']
      }
    ],
    bookings: [],

    /* ---------- leveranciers ----------
       De leverancier-app is één app die zich aanpast aan het type. Elk type
       heeft eigen mogelijkheden (caps) die de app-schermen bepalen. Leveranciers
       gebruiken de app gratis in ruil voor de beste dynamische prijs aan RTG. */
    supplierTypes: {
      hotel:      { label: 'Hotel',        icon: '🏨', caps: ['bookings', 'location', 'pricing'] },
      apartment:  { label: 'Appartement',  icon: '🏡', caps: ['bookings', 'location', 'pricing'] },
      taxi:       { label: 'Taxi',         icon: '🚘', caps: ['rides', 'location', 'pricing'] },
      jet:        { label: 'Privéjet',     icon: '✈️', caps: ['rides', 'location', 'pricing'] },
      restaurant: { label: 'Restaurant',   icon: '🍽️', caps: ['menu', 'orders', 'reservations', 'location', 'pricing', 'kitchen'] },
      bar:        { label: 'Bar',          icon: '🍸', caps: ['menu', 'orders', 'location', 'pricing', 'kitchen'] },
      club:       { label: 'Club',         icon: '🎧', caps: ['menu', 'orders', 'location', 'pricing', 'kitchen'] }
    },

    /* Voorbeeldleveranciers (demo-inlogcodes). serviceRate = de dynamische
       marge die de leverancier aan RTG biedt, intern, nooit aan de klant. */
    suppliers: [
      {
        code: 'HOSHI', name: 'Hoshinoya Kyoto', type: 'hotel', city: 'Kyoto',
        loc: { lat: 35.015, lng: 135.671, label: 'Arashiyama, Kyoto' }, rate: 0.12,
        menu: []
      },
      {
        code: 'KIKUNOI', name: 'Kikunoi Honten', type: 'restaurant', city: 'Kyoto',
        loc: { lat: 35.001, lng: 135.780, label: 'Higashiyama, Kyoto' }, rate: 0.15,
        menu: [
          { id: 'm1', cat: 'Kaiseki', name: 'Hassun, seizoensvoorgerecht', desc: 'Acht kleine gerechten die het seizoen vieren.', price: 45, allergens: ['vis', 'soja', 'sesam'] },
          { id: 'm2', cat: 'Kaiseki', name: 'Mukozuke, sashimi', desc: 'Dagverse vangst, gesneden aan tafel.', price: 60, allergens: ['vis'] },
          { id: 'm3', cat: 'Kaiseki', name: 'Wagyu-hoofdgerecht', desc: 'A5 wagyu, licht gegrild, met seizoensgroenten.', price: 120, allergens: ['soja'] },
          { id: 'm4', cat: 'Zoet', name: 'Matcha & wagashi', desc: 'Ceremoniële matcha met huisgemaakte wagashi.', price: 22, allergens: ['gluten', 'melk'] }
        ]
      },
      {
        code: 'PONTO', name: 'Bar Pontocho', type: 'bar', city: 'Kyoto',
        loc: { lat: 35.004, lng: 135.770, label: 'Pontocho-steeg, Kyoto' }, rate: 0.18,
        menu: [
          { id: 'b1', cat: 'Signatuur', name: 'Yuzu Highball', desc: 'Japanse whisky, yuzu, bruisend.', price: 16, allergens: [] },
          { id: 'b2', cat: 'Signatuur', name: 'Umeshu Sour', desc: 'Pruimenlikeur, citroen, eiwit.', price: 15, allergens: ['ei'] },
          { id: 'b3', cat: 'Alcoholvrij', name: 'Sakura Spritz (0%)', desc: 'Kersenbloesem, tonic, geen alcohol.', price: 12, allergens: [] },
          { id: 'b4', cat: 'Hapjes', name: 'Edamame & nori', desc: 'Gestoomde edamame met zeezout.', price: 8, allergens: ['soja'] }
        ]
      },
      {
        code: 'MKKX', name: 'Kyoto Executive Cars', type: 'taxi', city: 'Kyoto',
        loc: { lat: 34.986, lng: 135.759, label: 'Kyoto Station' }, rate: 0.20,
        menu: []
      },
      {
        code: 'JETAG', name: 'Aria Private Aviation', type: 'jet', city: 'Amsterdam', country: 'NL',
        loc: { lat: 52.308, lng: 4.764, label: 'Schiphol Business Aviation' }, rate: 0.10,
        menu: []
      }
    ],

    /* Bestellingen (restaurant/bar/club) en ritten (taxi/jet) tussen klant en
       leverancier; live gedeeld via SSE, zichtbaar in de backoffice (db.json). */
    orders: [],
    rides: [],
    supplierPrices: []  // dynamische prijsvoorstellen aan RTG (backoffice)
  };
};
