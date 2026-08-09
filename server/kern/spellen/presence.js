/* Spellen (deelmodule): wie van je vrienden er NU is.

   Geen opslag. Beide werelden schrijven hun open live-verbinding in dezelfde
   `sseClients`-lijst -- de RTG-app via `/api/stream` (server.js), de RTF-app
   via `/api/rtf/social/stream` (routes/social/gezinnen/toezicht.js) -- allebei
   met de sleutel van het lid erin, en allebei halen ze hem er bij `req.on
   ('close')` weer uit. "Wie is er nu" is dus een AFGELEIDE van wat er op dit
   moment openstaat, geen tabel die we zelf moeten bijhouden en die achter kan
   gaan lopen.

   Vier regels, en drie ervan zijn er om iets te voorkomen:

   1. ALLEEN JE VRIENDEN, en alleen deze kant op. Je krijgt de stand van de
      kring die je zelf hebt bevestigd; er bestaat geen lijst van "wie is er
      allemaal online". Beschermde tieners zijn onvindbaar via de codenaam-
      zoeker, en hun aanwezigheid reikt daarom nooit verder dan contacten die
      ze zelf hebben geaccepteerd.

   2. BINAIR, GEEN "LAATST GEZIEN". Een tijdstempel zou opslag vragen die we nu
      niet hebben, en het is het patroon dat CLAUDE.md verbiedt: "hij was drie
      minuten geleden nog online en antwoordt niet" zet druk op iemand die
      gewoon iets anders doet. Er is aan of niet aan, en verder niets.

   3. GEBLOKKEERD IS WEG, aan allebei de kanten. Wie jij hebt geblokkeerd zie je
      niet, en wie jou heeft geblokkeerd ziet jou niet -- `isGeblokkeerd` kijkt
      naar beide richtingen, en anders zou "online" een achterdeur zijn om toch
      te zien of iemand er is.

   4. WIE SPELEN HEEFT UITGEZET IS OFFLINE. Dit is geen nettigheid maar
      correctheid. Een lid dat in zijn boardroom de functie "spelen" uitzet
      krijgt op /api/member/spel een 403, maar houdt wel een open stream vanuit
      elke andere app. Zonder deze controle zou de lobby hem als beschikbaar
      tonen en nodig je iemand uit die dat verzoek gegarandeerd niet kan
      aannemen. Daarom leest deze laag dezelfde `lidBoardUit` als de poort die
      dat verzoek zou weigeren -- een tweede, eigen oordeel zou juist de kans
      op verschil zijn.

   5. ONZICHTBAAR IS ONZICHTBAAR. Wie zichzelf op onzichtbaar heeft gezet komt
      in niemands stand, ook niet bij een vriend of klasgenoot. Die knop staat
      naast het uitzetten van de hele functie, want "ik speel wel maar hoef
      niet gezien te worden" is iets anders dan "ik speel niet". Hij werkt maar
      EEN kant op: je bent niet te zien en je ziet anderen nog wel. Wie wil
      zien zou anders moeten betalen met zichtbaarheid, en dat is de ruil die
      hier niet hoort. */
module.exports = (ctx) => {
  const { sseClients, isGeblokkeerd, codenaamVan, lidBoardUit, S, save } = ctx;

  /* ---------- onzichtbaar spelen: de eigen opt-out ----------
     Hij staat HIER en niet in de spellenhub, want het is dezelfde vraag als
     hierboven: wie is er te zien. De functie "spelen" uitzetten werkt ook, maar
     dat is grover -- dan kun je helemaal niet meer spelen. Dit is de smalle
     knop: je speelt gewoon, maar niemand ziet dat je er bent.

     Waarom niet in de boardroom: klasgenoten zijn RTF-gezinsprofielen en die
     hebben geen boardroom. Een opt-out die alleen voor RTG-leden bestaat zou
     precies de groep overslaan waarvoor aanwezigheid het gevoeligst is.

     Onzichtbaar is EEN kant op: je bent niet te zien en je ziet anderen nog
     wel. Iemand blinderen omdat hij niet gezien wil worden is een ruil, en dat
     is precies de druk die hier niet hoort. Wie wil zien moet niet hoeven
     betalen met zichtbaarheid. */
  /* Zonder opslag bestaat de opt-out niet, en dan is er ook niemand verborgen.
     Dat is dezelfde soepelheid als bij een ontbrekende live-laag hierboven: een
     stand of een toets zonder omgeving hoort een leeg antwoord te geven en geen
     uitzondering. */
  function V() {
    if (typeof S !== 'function') return {};
    const s = S(); if (!s.verborgen) s.verborgen = {}; return s.verborgen;
  }
  const isVerborgen = (key) => !!V()[key];
  const spelZichtbaar = (mij) => ({ status: 200, zichtbaar: !isVerborgen(mij) });
  function spelZichtbaarZet(mij, aan) {
    const v = V();
    if (typeof S !== 'function') return { status: 200, ok: true, zichtbaar: true };
    // alleen "uit" bewaren we; zichtbaar is de standaard en laat geen spoor na
    if (aan === false) v[mij] = true; else delete v[mij];
    save();
    return { status: 200, ok: true, zichtbaar: !v[mij] };
  }
  const verborgen = isVerborgen;

  // het functie-id uit kern/lidboard/catalogus.js dat bij /api/member/spel hoort
  const FUNCTIE = 'spelen';

  /* Heeft dit lid op dit moment een open live-verbinding EN staat spelen
     voor hem aan? `lidBoardUit` is er voor RTG-leden; een RTF-gezinsprofiel
     kent die boardroom niet en valt daar op "niet uitgezet" terug, wat klopt:
     die functie kun je daar niet omzetten. */
  function bereikbaar(key) {
    if (verborgen(key)) return false;
    if (!sseClients.some(c => c.key === key)) return false;
    try { return !lidBoardUit(key, FUNCTIE); } catch (e) { return true; }
  }

  /* Wie van deze kring er nu is -- vrienden en, voor wie op school zit, ook
     klasgenoten. De kring komt binnen als lijst sleutels en wordt hier niet
     zelf opgehaald: welke kring je hebt is een vraag van de laag erboven, wie
     ervan te zien is de vraag van deze. Dubbele sleutels (iemand die vriend EN
     klasgenoot is) vallen weg, anders telt hij twee keer mee. */
  function spelOnline(mij, kring) {
    const lijst = [...new Set(Array.isArray(kring) ? kring : [])]
      .filter(v => v !== mij && !isGeblokkeerd(mij, v) && bereikbaar(v));
    return {
      online: lijst.map(v => ({ codenaam: codenaamVan(v), key: v })),
      aantal: lijst.length,
      // zodat de client niet hoeft te raden of een lege lijst "niemand is er"
      // betekent of "deze stand is niet opgehaald"
      stand: 'nu'
    };
  }

  return { spelOnline, spelZichtbaar, spelZichtbaarZet, isVerborgen, _bereikbaar: bereikbaar };
};
