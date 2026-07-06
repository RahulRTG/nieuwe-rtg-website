/* Startdata voor de RTG-portaal-backend. Wordt bij de eerste start
   naar server/data/db.json geschreven; verwijder dat bestand om te resetten. */

module.exports = function seed() {
  return {
    creatorCredit: { rtg: 86, lifestyle: 142, business: 64 },

    invoices: [
      { id: 'RTG-2026-0158', desc: 'Kyoto — Hoshinoya, 4 nachten', netto: 2840, bijdrage: 190, status: 'open', date: 'Vervalt 28 juli 2026' },
      { id: 'RTG-2026-0141', desc: 'KLM Amsterdam – Osaka, business class (2 pers.)', netto: 3120, bijdrage: 210, status: 'open', date: 'Vervalt 15 augustus 2026' },
      { id: 'RTG-2026-0093', desc: 'Lissabon — Palácio weekend, incl. transfers', netto: 1460, bijdrage: 120, status: 'paid', date: 'Betaald op 2 mei 2026' },
      { id: 'RTG-2025-0871', desc: 'Jaarbijdrage lidmaatschap 2026', netto: 0, bijdrage: 480, status: 'paid', date: 'Betaald op 4 januari 2026' }
    ],

    trip: {
      dest: 'Kyoto',
      dates: '12 – 19 oktober 2026',
      days: 98,
      items: [
        { when: '12 okt', title: 'KLM KL867 — Amsterdam → Osaka Kansai', sub: 'Business class, 2 personen · stoelen 2A/2C', status: 'paid', label: 'Bevestigd' },
        { when: '12 okt', title: 'Privétransfer Kansai → Hoshinoya Kyoto', sub: 'Chauffeur wacht bij aankomsthal, naambord RTG', status: 'paid', label: 'Bevestigd' },
        { when: '12–16 okt', title: 'Hoshinoya Kyoto — Riverside suite', sub: '4 nachten, ontbijt op de kamer, late check-out', status: 'open', label: 'Wacht op betaling', invoiceId: 'RTG-2026-0158' },
        { when: '14 okt', title: 'Privé-theeceremonie, Gion', sub: 'Met vertaler · 2 personen · 15:00 uur', status: 'paid', label: 'Bevestigd' },
        { when: '15 okt', title: 'Diner — Kikunoi Honten (3★)', sub: 'Kaiseki-menu · tafel 19:30 uur', status: 'req', label: 'In aanvraag' },
        { when: '16–19 okt', title: 'Ryokan Tawaraya — traditionele kamer', sub: '3 nachten, kaiseki-halfpension', status: 'open', label: 'Wacht op betaling', invoiceId: 'RTG-2026-0141' }
      ]
    },

    posts: [
      {
        id: 1, author: 'Isabelle van Rhijn', tier: 'lifestyle', place: 'Kyoto', visual: 'v-kyoto',
        text: 'De theeceremonie die mijn concierge regelde — geen toeristen, geen haast. Dit is waarom ik niet meer zelf boek.',
        baseLikes: 124, likedBy: {}, reward: 6,
        comments: [{ who: 'Alexander de Vries', tier: 'business', text: 'Staat genoteerd voor november. Dank.' }]
      },
      {
        id: 2, author: 'Alexander de Vries', tier: 'business', place: 'Zürich', visual: 'v-zurich',
        text: 'Ochtendvlucht, twee vergaderingen, om 18:00 aan het meer. De Business Pass plant de dag strakker dan mijn assistent ooit deed.',
        baseLikes: 89, likedBy: {}, reward: 4,
        comments: []
      },
      {
        id: 3, author: 'Sophie Janssen', tier: 'rtg', place: 'Lissabon', visual: 'v-lissabon',
        text: 'Voor de prijs van een gewoon hotel een palácio, via één WhatsApp-bericht. Nettoprijzen zijn geen marketing, ze bestaan echt.',
        baseLikes: 203, likedBy: {}, reward: 8,
        comments: [{ who: 'Nadia Karim', tier: 'rtg', text: 'Welk palácio was dit? Sta op het punt te boeken!' }]
      },
      {
        id: 4, author: 'Marcus Bergwerff', tier: 'business', place: 'Singapore', visual: 'v-singapore',
        text: 'Layover van 9 uur omgezet in een middag Raffles + spa. De AI stelde het voor, mijn concierge bevestigde binnen 10 minuten.',
        baseLikes: 57, likedBy: {}, reward: 2,
        comments: []
      },
      {
        id: 5, author: 'Nadia Karim', tier: 'rtg', place: 'Marrakech', visual: 'v-marrakech',
        text: 'Riad tegen inkoopprijs, en 30% van mijn bijdrage ging naar de RTFoundation. Reizen dat iets teruggeeft — dat deel vertel ik iedereen.',
        baseLikes: 141, likedBy: {}, reward: 5,
        comments: []
      }
    ],

    dms: []
  };
};
