/* RTG Wereld -- DE ENE FEED. Vier bronnen, één stroom, en de modus bepaalt
   welke ervan meedoen.

   WAAROM DIT LEEST EN NIET SCHRIJFT, en dat is de belangrijkste keuze hier.
   De Salon, Pulse, het zakelijke prikbord en de verhalen bestaan al, met elk
   hun eigen poort, hun eigen 9+-keuring en hun eigen opruimregels. Dit bestand
   maakt daar GEEN vijfde opslag naast: het leest de vier en zet ze naast elkaar
   op één tijdlijn. Een eigen `db.data.wereld.posts` zou de vijfde plek zijn die
   dezelfde waarheid vasthoudt (LAT-regel 4), en de eerste keer dat iemand een
   Salon-post verwijdert zou hij hier blijven staan.

   Plaatsen loopt dus ook nooit via deze module. Wie in Lifestyle plaatst,
   plaatst in De Salon; wie in Business plaatst, plaatst op het zakelijke
   prikbord. Die routes houden hun keuring, hun rem en hun eigenaarschap. De
   feed is een LEESLAAG, en dat is precies waarom hij goedkoop en veilig is.

   GEEN ALGORITME. Chronologisch, aflopend, klaar. Dat is dezelfde merkregel als
   in kern/pulse: geen "voor jou", geen oneindige trucs, je bent bij als je bij
   bent. De modus filtert, hij rangschikt niet. */
'use strict';

const rechten = require('./rechten');

/* Welke bronnen horen bij welke modus. Eén tabel; de poort en het scherm lezen
   allebei deze. Een bron met `eist` doet alleen mee als de pas dat vermogen
   heeft -- zo kan 'alles' voor een gratis pas niet stiekem zakelijke posts
   bevatten die hij in de modus zelf niet mag zien. */
const BRONNEN = {
  alles: ['salon', 'pulse', 'zakelijk', 'genootschap'],
  lifestyle: ['salon', 'pulse'],
  business: ['zakelijk'],
  genootschap: ['genootschap'],
  prive: ['verhalen']
};
const EIST = { zakelijk: 'zakelijk.feed', genootschap: 'genootschap' };

module.exports = ({ db, codenaamVan, zijnVrienden }) => {
  const tijd = x => new Date(x || 0).getTime() || 0;
  const kort = (t, n) => String(t == null ? '' : t).slice(0, n);

  /* Een item uit welke bron dan ook krijgt DEZELFDE vorm. Niet omdat het mooi
     staat, maar omdat het scherm anders vier weergaven zou moeten kennen en de
     vijfde bron een vijfde tak zou zijn. `bron` blijft wel meegaan: de kaart
     zegt waar hij vandaan komt, en `open` is de deeplink terug naar de app die
     hem bezit (kern/wereld/koppel.js). */
  const item = (bron, o) => ({
    id: bron + ':' + o.id, bron, wereld: o.wereld,
    auteur: o.auteur || 'Een lid', tekst: kort(o.tekst, 2000),
    beeld: o.beeld || [], at: o.at || null,
    likes: o.likes || 0, reacties: o.reacties || 0,
    open: 'rtg://' + bron + '/' + o.id
  });

  /* De vier lezers. Elk geeft een lijst in de gedeelde vorm terug en raakt de
     opslag van zijn eigen domein niet aan -- geen save(), geen mutatie. */
  const lezers = {
    salon: () => (db.data.posts || [])
      .filter(p => !p.archief && !p.verborgen)
      .map(p => item('salon', {
        id: p.id, wereld: 'lifestyle', auteur: p.author, tekst: p.text, at: p.at,
        beeld: Array.isArray(p.media) && p.media.length ? p.media : (p.photo ? [{ src: p.photo, alt: '' }] : []),
        likes: (p.baseLikes || 0) + Object.keys(p.likedBy || {}).length,
        reacties: (p.comments || []).length
      })),

    pulse: () => (((db.data.pulse || {}).posts) || [])
      .filter(p => !p.weg && !p.verborgen)
      .map(p => item('pulse', {
        id: p.id, wereld: 'lifestyle', auteur: p.codenaam, tekst: p.tekst, at: p.at,
        likes: Object.keys(p.likes || {}).length, reacties: (p.reacties || []).length
      })),

    zakelijk: () => (((db.data.zakelijk || {}).posts) || [])
      .map(p => item('zakelijk', {
        id: p.id, wereld: 'business',
        auteur: p.naam || p.codenaam, tekst: p.tekst, at: p.at,
        likes: (p.likes || []).length, reacties: (p.reacties || []).length
      })),

    /* Het prikbord van de genootschappen waar IK in zit. De zichtbaarheidsregel
       van dat domein is hier hard: een geheim genootschap bestaat niet voor wie
       er niet in zit, dus we lopen niet over alle genootschappen maar over de
       mijne. Wie geen lid is, krijgt een lege lijst -- geen 403, want "er is
       hier niets voor jou" is de eerlijke uitkomst. */
    genootschap: (mij) => {
      /* De vorm hier is met zorg overgenomen uit kern/genootschap/index.js en
         niet geraden: de groepen staan in `db.data.genootschap.groepen` (een
         array) en de berichten in `db.data.genootschap.prikbord[groepId]` (een
         map per groep). Dat stond hier eerst fout -- ik las het als een map van
         groepen met hun prikbord erin -- en het gaf geen enkele fout: gewoon
         altijd nul berichten. Precies de stille soort. Dat het bleef staan lag
         aan de toets: die keek of de bron MEEDEED, niet of er inhoud uitkwam.
         Nu staat er een toets die een echt prikbordbericht terugverwacht. */
      const G = db.data.genootschap || {};
      const isLid = (gr) => (gr.leden || []).some(l => (typeof l === 'string' ? l : l && l.key) === mij);
      const uit = [];
      for (const gr of (G.groepen || [])) {
        if (!isLid(gr)) continue;                    // geheim blijft geheim
        for (const b of ((G.prikbord || {})[gr.id] || [])) {
          if (b.weg) continue;
          uit.push(item('genootschap', {
            id: b.id, wereld: 'genootschap',
            auteur: (codenaamVan ? codenaamVan(b.vanKey) : '') || 'Een lid',
            tekst: b.tekst, at: b.at, reacties: (b.reacties || []).length
          }));
        }
      }
      return uit;
    },

    /* Privé: de 24-uurs verhalen van mijn vrienden en van mijzelf. Dit is de
       enige bron die niet publiek is, en hij loopt daarom langs zijnVrienden --
       dezelfde graaf die de Salon en de chat gebruiken, niet een tweede lijst. */
    verhalen: (mij) => (db.data.stories || [])
      .filter(s => s.van === mij || (zijnVrienden && zijnVrienden(mij, s.van)))
      .map(s => item('verhalen', {
        id: s.id, wereld: 'prive',
        /* codenaamVan(sleutel), NIET liveCodename: die laatste verwacht een
           SESSIE en geeft voor een kale sleutel altijd null -- waarna elke
           auteur hier stil "Een lid" heette. Gevonden doordat de genootschap-
           toets de auteursnaam echt vergelijkt in plaats van alleen te kijken
           of er iets staat. */
        auteur: (codenaamVan ? codenaamVan(s.van) : '') || 'Een lid',
        tekst: s.tekst || '', at: s.at,
        beeld: s.foto ? [{ src: '/media/' + s.foto, alt: '' }] : []
      }))
  };

  /* De feed voor deze pas in deze modus.

     De poort staat HIER en niet alleen in de route, want dit is de plek die de
     data echt aanraakt. Een tweede aanroeper (een scherm, een export, een AI)
     krijgt daarmee dezelfde grens zonder hem opnieuw te schrijven -- de grendel
     hangt aan het doel en niet aan de aanvrager (LAT-regel 7). */
  function feed({ tier, key, modus = 'alles', vanaf = 0, hoeveel = 30 }) {
    if (!rechten.modusOpen(tier, modus)) {
      return { error: 'Deze wereld hoort bij een andere pas.', modus, items: [], totaal: 0 };
    }
    const namen = (BRONNEN[modus] || []).filter(b => !EIST[b] || rechten.magVan(tier, EIST[b]));
    const alles = [];
    for (const n of namen) alles.push(...lezers[n](key));
    alles.sort((a, b) => tijd(b.at) - tijd(a.at));
    const start = Math.max(0, Number(vanaf) || 0);
    const n = Math.min(60, Math.max(1, Number(hoeveel) || 30));
    return {
      modus, bronnen: namen, totaal: alles.length,
      items: alles.slice(start, start + n),
      meer: start + n < alles.length
    };
  }

  return { feed, BRONNEN };
};
