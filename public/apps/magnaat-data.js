/* Synthetische OS-gegevens voor Magnaat Test. Zonder de vooraf geladen,
   afgeschermde sandbox maakt dit bestand bewust geen gegevens aan. */
(function () {
  'use strict';
  if (window.RTG_MAGNAAT_PROEF !== true) return;
  window.RTG_MAGNAAT_DATA = {
    personas: {
      rtg: { name: 'K. Kiss', full: 'Katja Kiss', since: 'Maart 2026', number: 'RTG · TEST · 8841', codename: 'Amberen Vos', tier: 'rtg' },
      lifestyle: { name: 'F. Johanna', full: 'Fleur Johanna', since: 'Augustus 2025', number: 'LSP · TEST · 0217', codename: 'Gouden Ibis', tier: 'lifestyle' },
      business: { name: 'R. Imran', full: 'Rahul Imran', since: 'November 2025', number: 'BSP · TEST · 1104', codename: 'Noordelijke Ster', tier: 'business' }
    },
    invoices: [
      { id: 'TEST-0158', desc: 'Ibiza, Aguamarina, 3 nachten', netto: 1740, bijdrage: 150, status: 'open', date: 'Testtermijn 28 juli 2026' },
      { id: 'TEST-0141', desc: 'Villa Bahia Ibiza, Cala Jondal, 4 nachten', netto: 2240, bijdrage: 180, status: 'open', date: 'Testtermijn 15 augustus 2026' },
      { id: 'TEST-0093', desc: 'Privéjet Schiphol - Ibiza (retour, gedeeld)', netto: 1460, bijdrage: 120, status: 'paid', date: 'Testbetaling 2 mei 2026' },
      { id: 'TEST-0871', desc: 'Jaarbijdrage lidmaatschap 2026', netto: 0, bijdrage: 480, status: 'paid', date: 'Testbetaling 4 januari 2026' }
    ],
    trip: { dest: 'Ibiza', dates: '18 - 25 juli 2026', days: 7, items: [
      { when: '18 jul', title: 'Lijnvlucht RTG-1263, Amsterdam Schiphol naar Ibiza', sub: 'Economy comfort · 2 testreizigers', status: 'paid', label: 'Bevestigd' },
      { when: '18 jul', title: 'Privétransfer luchthaven naar Aguamarina', sub: 'Testchauffeur bij aankomsthal', status: 'paid', label: 'Bevestigd' },
      { when: '18-21 jul', title: 'Aguamarina Ibiza, Sea-view suite', sub: '3 testnachten, late check-out', status: 'open', label: 'Wacht op betaling', invoiceId: 'TEST-0158' },
      { when: '19 jul', title: 'Diner, Sal de Mar', sub: 'Testreservering · 21:00 uur', status: 'req', label: 'In aanvraag' },
      { when: '20 jul', title: 'Privéboot naar Formentera', sub: 'Testgroep · 10:00 uur', status: 'paid', label: 'Bevestigd' },
      { when: '21-25 jul', title: 'Villa Bahia Ibiza, Cala Jondal', sub: '4 testnachten, eigen zwembad', status: 'open', label: 'Wacht op betaling', invoiceId: 'TEST-0141' }
    ] },
    posts: [
      { id: 1, author: 'Katja Kiss', tier: 'rtg', place: 'Ibiza', visual: 'v-ibiza', text: 'Testverhaal uit Magnaat: een gezamenlijke aankomst op Ibiza.', likes: 168, liked: false, comments: [] },
      { id: 2, author: 'Rahul Imran', tier: 'business', place: 'Ibiza', visual: 'v-ibiza', text: 'Testverhaal uit Magnaat: werken, reizen en plannen in een veilige kopie.', likes: 96, liked: false, comments: [] },
      { id: 3, author: 'Fleur Johanna', tier: 'lifestyle', place: 'Gstaad', visual: 'v-gstaad', text: 'Testverhaal uit Magnaat: een winterreis naar Gstaad.', likes: 132, liked: false, comments: [] }
    ],
    creatorLikes: 320,
    foundation: { gekoppeld: [], meldingen: [] }
  };
})();
