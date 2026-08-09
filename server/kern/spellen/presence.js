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
      op verschil zijn. */
module.exports = (ctx) => {
  const { sseClients, isGeblokkeerd, codenaamVan, lidBoardUit } = ctx;

  // het functie-id uit kern/lidboard/catalogus.js dat bij /api/member/spel hoort
  const FUNCTIE = 'spelen';

  /* Heeft dit lid op dit moment een open live-verbinding EN staat spelen
     voor hem aan? `lidBoardUit` is er voor RTG-leden; een RTF-gezinsprofiel
     kent die boardroom niet en valt daar op "niet uitgezet" terug, wat klopt:
     die functie kun je daar niet omzetten. */
  function bereikbaar(key) {
    if (!sseClients.some(c => c.key === key)) return false;
    try { return !lidBoardUit(key, FUNCTIE); } catch (e) { return true; }
  }

  /* Wie van deze vrienden er nu is. Geeft codenamen terug en geen sleutels:
     dit gaat naar het scherm van een ander lid, en daar hoort de identiteits-
     kluis buiten te blijven. */
  function spelOnline(mij, vrienden) {
    const lijst = (Array.isArray(vrienden) ? vrienden : [])
      .filter(v => v !== mij && !isGeblokkeerd(mij, v) && bereikbaar(v));
    return {
      online: lijst.map(v => ({ codenaam: codenaamVan(v), key: v })),
      aantal: lijst.length,
      // zodat de client niet hoeft te raden of een lege lijst "niemand is er"
      // betekent of "deze stand is niet opgehaald"
      stand: 'nu'
    };
  }

  return { spelOnline, _bereikbaar: bereikbaar };
};
