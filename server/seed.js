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
      { higher: 'Rahul Imran', rtg: 'Katja Kiss' }
    ],

    invoices: [
      { id: 'RTG-2026-0158', desc: 'Ibiza, Aguamarina, 3 nachten', netto: 1740, bijdrage: 0, status: 'paid', date: 'Betaald aan de partner op 12 juli 2026' },
      { id: 'RTG-2026-0141', desc: 'Villa Bahia Ibiza, Cala Jondal, 4 nachten', netto: 2240, bijdrage: 0, status: 'paid', date: 'Betaald aan de partner op 3 juli 2026' },
      { id: 'RTG-2026-0093', desc: 'Privejet Schiphol - Ibiza (retour, gedeeld)', netto: 1460, bijdrage: 0, status: 'paid', date: 'Betaald aan de partner op 2 mei 2026' },
      { id: 'RTG-2026-0207', desc: 'Maandbijdrage lidmaatschap juli 2026', netto: 0, bijdrage: 78.65, status: 'open', date: 'Vervalt 1 augustus 2026' }
    ],

    trip: {
      dest: 'Ibiza',
      dates: '18 - 25 juli 2026',
      days: 7,
      items: [
        { when: '18 jul', title: 'KLM KL1263, Amsterdam Schiphol → Ibiza', sub: 'Economy comfort, 2 personen · de rest van de groep vloog privé', status: 'paid', label: 'Bevestigd' },
        { when: '18 jul', title: 'Privétransfer luchthaven → Aguamarina', sub: 'Chauffeur wacht bij aankomsthal, naambord RTG', status: 'paid', label: 'Bevestigd' },
        { when: '18-21 jul', title: 'Aguamarina Ibiza, Sea-view suite', sub: '3 nachten, ontbijt, late check-out', status: 'open', label: 'Wacht op betaling', invoiceId: 'RTG-2026-0158' },
        { when: '19 jul', title: 'Diner, Sal de Mar', sub: 'Chef-menu · tafel 21:00 uur', status: 'req', label: 'In aanvraag' },
        { when: '20 jul', title: 'Privéboot naar Formentera', sub: 'Met de hele groep · 10:00 uur', status: 'paid', label: 'Bevestigd' },
        { when: '21-25 jul', title: 'Villa Bahia Ibiza, Cala Jondal', sub: '4 nachten, eigen zwembad', status: 'open', label: 'Wacht op betaling', invoiceId: 'RTG-2026-0141' }
      ]
    },

    posts: [
      {
        id: 1, author: 'Katja Kiss', tier: 'rtg', place: 'Ibiza', visual: 'v-ibiza',
        text: 'Met de hele vriendengroep neergestreken: de helft in het hotel aan zee, wij met z\'n vieren in de villa boven Cala Jondal. Rahul kwam met de privéjet vanaf Schiphol, wij pakten gewoon de ochtendvlucht, en toch checken we samen in. Dit is reizen zonder gedoe.',
        baseLikes: 168, likedBy: {}, reward: 7, featured: true,
        comments: [
          { who: 'Timothy de Groot', tier: 'rtg', text: '22, tussen twee tentamens door even bijkomen, precies wat ik nodig had.', lang: 'nl' },
          { who: 'Thomas Gefferie', tier: 'rtg', text: 'Snackbar dicht, telefoon uit, ik ben even niemands baas.', lang: 'nl' },
          { who: 'Anwar Ravi', tier: 'rtg', text: 'De strandtent hier kan nog wat leren van ons, maar de zonsondergang niet.', lang: 'nl' }
        ]
      },
      {
        id: 2, author: 'Rahul Imran', tier: 'business', place: 'Ibiza', visual: 'v-ibiza',
        text: 'Ochtend: twee calls vanaf het terras. Middag: boot naar Formentera met de groep. De Business Pass plant mijn dag strakker dan welke assistent ook, en de jet stond klaar op Schiphol Business Aviation.',
        baseLikes: 96, likedBy: {}, reward: 4,
        comments: [
          { who: 'Katja Kiss', tier: 'rtg', text: 'En vanavond koken we samen in de villa, jij snijdt.', lang: 'nl' }
        ]
      },
      {
        id: 3, author: 'Fleur Johanna', tier: 'lifestyle', place: 'Gstaad', visual: 'v-gstaad',
        text: 'Wij oude rotten trekken de bergen in terwijl de jeugd op Ibiza ligt. Chalet in Gstaad, open haard, en morgen een privélift de piste op. Op je 69e mag dat.',
        baseLikes: 132, likedBy: {}, reward: 6, featured: true,
        comments: [
          { who: 'Marieke Hooi', tier: 'lifestyle', text: 'Als schooldirectrice tel ik de dagen af tot de vakantie; deze is het waard.', lang: 'nl' },
          { who: 'William Draak', tier: 'business', text: 'Vanuit Monaco groeten wij Gstaad. De boekhouding klopt, de rosé ook.', lang: 'nl' }
        ]
      },
      {
        id: 4, author: 'Dani da Cruz Carvalho', tier: 'business', place: 'Monaco', visual: 'v-monaco',
        text: 'Na mijn voetbaljaren dacht ik alles gezien te hebben in Monaco, maar aankomen op codenaam en toch als vanouds ontvangen worden, dat is nieuw. Eerst de jachthaven, dan het casino.',
        baseLikes: 214, likedBy: {}, reward: 8, featured: true,
        comments: [
          { who: 'Feroz Mohammed', tier: 'business', text: 'Wij zitten in Dubai, andere warmte, dezelfde club. Tot in september.', lang: 'nl' }
        ]
      },
      {
        id: 5, author: 'Feroz Mohammed', tier: 'business', place: 'Dubai', visual: 'v-dubai',
        text: 'Een week Dubai met vrienden: de een in de wolkenkrabber-suite, de ander in een strandappartement aan de Palm. Ik werk voor de Nederlandse staat, maar deze dagen tel ik even niet mee.',
        baseLikes: 78, likedBy: {}, reward: 3,
        comments: [
          { who: 'Priya Venkatesan', tier: 'lifestyle', text: 'Als arts weet ik: rust is ook zorg. Deze zonsondergang is op doktersvoorschrift.', lang: 'nl' },
          { who: 'Marlon Vega', tier: 'business', text: 'En als jullie advocaat zeg ik: de contracten kunnen wachten tot maandag.', lang: 'nl' }
        ]
      },
      {
        id: 6, author: 'Summer Jolanda Vissen', tier: 'rtg', place: 'Ibiza', visual: 'v-ibiza',
        text: 'Een ring gesmeed voor de tweeling van Ashley, hier op het terras afgemaakt. Goudsmid zijn op vakantie, omdat het niet als werk voelt tussen deze mensen. 30% van mijn bijdrage ging bovendien naar de RTFoundation.',
        baseLikes: 149, likedBy: {}, reward: 5, featured: true,
        comments: [
          { who: 'Ashley Jamie Broek', tier: 'rtg', text: 'Twee kleine mannetjes thuis bij oma, ik hier even mama-af. Dank Summer.', lang: 'nl' },
          { who: 'Leorita Ha', tier: 'rtg', text: 'Shoot afgezegd, vriendinnen gekozen. Beste besluit van het jaar.', lang: 'nl' },
          { who: 'Sindi Mok', tier: 'rtg', text: 'Model zijn is 90% wachten; hier wacht ik met een cocktail.', lang: 'nl' }
        ]
      }
    ],

    dms: [],

    /* ---------- partnerkanaal (boeken zonder pas) ----------
       Niet-leden boeken via een partnerlink (boeken.html?via=CODE).
       Prijs = nettoprijs + service; de service wordt gedeeld tussen
       de partner (share van de service) en RTG. */
    partnerService: 0, // RTG rekent niets over boekingen; leden boeken tegen nettoprijs
    /* share = het deel van de service voor de partner, INTERN, wordt nooit
       aan de klant getoond. Bedrijfspartners kunnen een personeelskanaal
       hebben: eigen code, lager servicetarief (arbeidsvoorwaarde). */
    partners: [
      { code: 'NOVA',  name: 'Nova van Dijk',          type: 'influencer', handle: '@novatravels · 380k volgers', share: 0.40 },
      { code: 'ATLAS', name: 'Atlas Executive Travel', type: 'bedrijf',    handle: 'zakelijk reisbureau, Amsterdam', share: 0.35 }
    ],
    partnerTrips: [
      {
        id: 'ibiza-jetset', dest: 'Ibiza', visual: 'v-ibiza',
        title: 'Ibiza, jetset-week', dates: '7 dagen · zomer 2026', netto: 2200,
        desc: 'Vanaf Schiphol naar het eiland: deels hotel aan zee, deels een villa met eigen zwembad, boot naar Formentera en diners bij de beste adressen.',
        includes: ['Vlucht of privéjet vanaf Schiphol', 'Aguamarina Ibiza, 3 nachten', 'Villa Bahia Ibiza, 4 nachten', 'Privéboot & transfers']
      },
      {
        id: 'gstaad-alpien', dest: 'Gstaad', visual: 'v-gstaad',
        title: 'Gstaad, alpien weekend', dates: '4 dagen · doorlopend', netto: 1680,
        desc: 'Een chalet met open haard, privélift de piste op en diners in de bergen, hetzelfde adres waar onze leden over posten in De Salon.',
        includes: ['Vlucht & transfers', 'Chalet, 3 nachten', 'Skipas & privélift', 'Diner in de bergen']
      },
      {
        id: 'monaco-glamour', dest: 'Monaco', visual: 'v-monaco',
        title: 'Monaco, haven & glamour', dates: '4 dagen · doorlopend', netto: 1950,
        desc: 'Suite met zicht op de jachthaven, een avond in het casino en een tafel langs het circuit, ingekocht zoals wij dat voor leden doen.',
        includes: ['Vlucht & privétransfers', 'Suite met havenzicht, 3 nachten', 'Avond in het casino', 'Tafel langs het circuit']
      }
    ],
    bookings: [],

    /* ---------- leveranciers ----------
       De leverancier-app is één app die zich aanpast aan het type. Elk type
       heeft eigen mogelijkheden (caps) die de app-schermen bepalen. Leveranciers
       gebruiken de app gratis in ruil voor de beste dynamische prijs aan RTG. */
    supplierTypes: {
      hotel:      { label: 'Hotel',        icon: '🏨', caps: ['bookings', 'location', 'pricing'] },
      apartment:  { label: 'Appartement',  icon: '🏡', caps: ['bookings', 'doors', 'location', 'pricing'] },
      taxi:       { label: 'Taxi',         icon: '🚘', caps: ['rides', 'location', 'pricing'] },
      jet:        { label: 'Privéjet',     icon: '✈️', caps: ['rides', 'location', 'pricing'] },
      restaurant: { label: 'Restaurant',   icon: '🍽️', caps: ['menu', 'orders', 'reservations', 'location', 'pricing'] },
      bar:        { label: 'Bar',          icon: '🍸', caps: ['menu', 'orders', 'location', 'pricing'] },
      club:       { label: 'Club',         icon: '🎧', caps: ['menu', 'orders', 'location', 'pricing'] }
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
      }
    ],

    /* Bestellingen (restaurant/bar/club) en ritten (taxi/jet) tussen klant en
       leverancier; live gedeeld via SSE, zichtbaar in de backoffice (db.json). */
    orders: [],
    rides: [],
    supplierPrices: []  // dynamische prijsvoorstellen aan RTG (backoffice)
  };
};
