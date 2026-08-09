/* RTG Wereld -- INZICHT. Twee vermogens: `inzicht.bereik` (hoe doet mijn eigen
   werk het) en `inzicht.bedrijf` (wat is er te zien van een onderneming).

   WAT DIT BEWUST NIET IS, en dat bepaalt de hele vorm. Bij andere platformen is
   "inzicht" het gereedschap dat je aan het posten houdt: een grafiek die omhoog
   moet, een percentage tegenover vorige week, een melding als het tegenvalt.
   Dat is precies het verslavende patroon dat CLAUDE.md verbiedt.

   Daarom drie regels, en ze zijn hieronder afgedwongen en niet alleen beloofd:

   1. GEEN VERGELIJKING MET JEZELF OVER TIJD. Geen "40% meer dan vorige week",
      geen reeks per dag. Je ziet wat er IS: hoeveel je plaatste, wat het aan
      reacties opleverde, en welke stukken het meest zijn gelezen. Wie wil weten
      of het beter gaat, kijkt naar zijn werk en niet naar een curve.
   2. GEEN RANGLIJST. Nooit "je staat op plek 12 van de makers". Een ranglijst
      maakt van andermans werk je maatstaf, en dat is een lus.
   3. GEEN MELDINGEN. Deze module krijgt `notify` niet eens binnen, dus hij KAN
      je niet porren. Dat is geen belofte maar een eigenschap van de bedrading.

   En net als de feed en het profiel: dit is een LEESLAAG. Er wordt niets
   bijgehouden, geen tellers, geen eigen tabel. Alles wordt op het moment zelf
   uit de bronnen gerekend die de post toch al bezitten (LAT-regel 4). */
'use strict';

module.exports = ({ db, codenaamVan }) => {
  const tijd = x => new Date(x || 0).getTime() || 0;

  /* ------------------------------------------------------- mijn bereik ---

     Over de drie bronnen waar een lid zelf plaatst: De Salon, Pulse en het
     zakelijke prikbord. Per bron wat er staat en wat het deed; daarnaast de
     stukken die het meest zijn gelezen, zodat je ziet WAT aansloeg in plaats
     van alleen DAT er iets aansloeg. */
  function bereik(key) {
    const codenaam = codenaamVan(key);

    const salon = (db.data.posts || [])
      .filter(p => p.authorKey === key && !p.archief);
    const pulse = (((db.data.pulse || {}).posts) || [])
      .filter(p => p.key === key && !p.weg);
    const zakelijk = (((db.data.zakelijk || {}).posts) || [])
      .filter(p => p.key === key);

    const tel = (posts, likes, reacties) => ({
      posts: posts.length,
      likes: posts.reduce((n, p) => n + likes(p), 0),
      reacties: posts.reduce((n, p) => n + reacties(p), 0)
    });

    const bronnen = {
      salon: tel(salon, p => (p.baseLikes || 0) + Object.keys(p.likedBy || {}).length,
        p => (p.comments || []).length),
      pulse: tel(pulse, p => Object.keys(p.likes || {}).length, p => (p.reacties || []).length),
      zakelijk: tel(zakelijk, p => (p.likes || []).length, p => (p.reacties || []).length)
    };

    /* De best gelezen stukken. `waardering` is likes + reacties bij elkaar en
       niet een verzonnen score met gewichten: een getal dat niemand kan
       navertellen is geen inzicht maar een orakel. */
    const stukken = [
      ...salon.map(p => ({ bron: 'salon', id: p.id, tekst: p.text, at: p.at,
        waardering: (p.baseLikes || 0) + Object.keys(p.likedBy || {}).length + (p.comments || []).length })),
      ...pulse.map(p => ({ bron: 'pulse', id: p.id, tekst: p.tekst, at: p.at,
        waardering: Object.keys(p.likes || {}).length + (p.reacties || []).length })),
      ...zakelijk.map(p => ({ bron: 'zakelijk', id: p.id, tekst: p.tekst, at: p.at,
        waardering: (p.likes || []).length + (p.reacties || []).length }))
    ].sort((a, b) => (b.waardering - a.waardering) || (tijd(b.at) - tijd(a.at)));

    const totaal = Object.values(bronnen).reduce((s, b) => ({
      posts: s.posts + b.posts, likes: s.likes + b.likes, reacties: s.reacties + b.reacties
    }), { posts: 0, likes: 0, reacties: 0 });

    return {
      codenaam, totaal, bronnen,
      best: stukken.slice(0, 5).map(s => ({
        bron: s.bron, tekst: String(s.tekst || '').slice(0, 160),
        at: s.at, waardering: s.waardering, open: 'rtg://' + s.bron + '/' + s.id
      })),
      /* De eerlijke voetnoot, en hij hoort in het ANTWOORD en niet alleen in
         een schermtekst: wat hier staat gaat over reacties, niet over hoeveel
         mensen iets zagen. Vertoningen tellen we niet, want daarvoor zou elke
         feed-opvraag per post moeten worden vastgelegd -- dat is precies de
         soort administratie die dit huis niet wil aanleggen. */
      voetnoot: 'Dit telt reacties en waarderingen, geen vertoningen: RTG houdt niet bij wie wat heeft gezien.'
    };
  }

  /* ------------------------------------------------------ bedrijfsbeeld ---

     Wat er van een onderneming te zien is, uit wat RTG al WEET omdat het er
     gebeurt: de zaak zelf, zijn open vacatures en de kansen die hij op het
     kansenbord zette. Geen ingekochte bedrijfsdata, geen geschatte omzet, geen
     "beslissers" -- dat laatste is bij andere aanbieders een eufemisme voor een
     lijst mensen die nooit om contact hebben gevraagd. */
  function bedrijf(zoekterm, openVacatures) {
    const q = String(zoekterm || '').trim().toLowerCase();
    if (!q) return { error: 'Welke onderneming?' };

    const zaken = (db.data.suppliers || [])
      .filter(s => String(s.name || '').toLowerCase().includes(q))
      .slice(0, 10);
    if (!zaken.length) return { treffers: [] };

    const vacatures = typeof openVacatures === 'function' ? (openVacatures() || []) : [];
    const kansen = ((db.data.zakelijk || {}).kansen) || [];

    return {
      treffers: zaken.map(s => {
        const eigen = vacatures.filter(v => v.supplierCode === s.code);
        return {
          naam: s.name, code: s.code, genre: s.genre || null, plaats: s.city || null,
          vacatures: eigen.length,
          functies: [...new Set(eigen.map(v => v.functie || v.title).filter(Boolean))].slice(0, 8),
          kansen: kansen.filter(k => k.supplierCode === s.code && !k.gesloten).length,
          /* Wat we NIET weten hoort er ook te staan, anders leest een lege
             regel als een nul (LAT-regel 5). */
          onbekend: ['omzet', 'personeelsomvang', 'groei']
        };
      })
    };
  }

  return { bereik, bedrijf };
};
