/* Startdata, deel "leden": de demo-ledenkant -- creator-tellingen, de
   wederkerigheidscontacten, de facturen en reis van het hoofdaccount, en de
   voorbeeldposts in De Salon (met reacties). Afgesplitst uit seed.js; puur data,
   wordt in seed/index.js samengevoegd tot de volledige startset. */
module.exports = {
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

  dms: []
};
