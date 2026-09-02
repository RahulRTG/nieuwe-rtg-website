/* ============================================================================
   MIJN RTG, blok 1: WAT EEN LID VAN ZIJN EIGEN SESSIES ZIET.

   Dit is de PROJECTIE en niet de opslag. ./sessieregister.js bezit de collectie
   en schrijft erin; dit bestand leest hem en maakt er de rij van die een scherm
   toont. De naad loopt daar met opzet: alles wat hier staat gaat over WAT er te
   zien is, en niets erover of het mag of blijft.

   Waarom het een eigen bestand is: het register kwam boven de tien kilobyte uit
   (regel 13 van scripts/check.js) en de goedkope uitweg was hem op de lijst met
   uitzonderingen zetten. Een lijstprojectie is geen opslag, dus die knip was er
   toch al een die het huis wilde -- niet een die de meter wilde.

   De regel die hier boven alles staat: een sessie draagt geen namen. De code
   van een toestel of een zaak reist mee, de naam wordt door de route opgezocht
   bij de bron die hem bezit. Wat er in een sessiecontext mag staan houdt
   ./sessiecontext.js bij, en die weigert de rest met de reden erbij.
   ========================================================================== */
'use strict';

const ctx = require('./sessiecontext');
const { standVan } = require('./vertrouwen');
const klok = require('../../lib/klok');

/* `bak` is de levende kaart van het register en geen kopie: dit bestand krijgt
   de functie en niet het object, zodat het altijd de huidige stand leest. */
function maakSessielijst({ bak, ttlMs }) {
  /* De sessies van een lid, met per sessie de STAND per veld -- niet een cijfer.
     Dit is wat een sessielijst hoort te lezen: elk veld met zijn graad, zodat
     een scherm "toestelbinding: bewezen" naast "vertrouwen: vermoed, 3 uur oud"
     kan zetten in plaats van alles even zeker te laten lijken. */
  function vanLid(lidKey, nu = klok.nu()) {
    const uit = [];
    for (const [sid, rij] of Object.entries(bak())) {
      if (!lidKey || rij.lidKey !== lidKey) continue;
      if (nu - new Date(rij.gezienOp || 0).getTime() > ttlMs) continue;
      /* De SOORT naast de STAND. Zonder dit moet een scherm de soort raden uit de
         graad ("bewezen dus een passkey"), en dat is precies zo lang waar tot er
         een derde manier van inloggen bij komt. De soort is geen persoonsgegeven
         en geen bewijs -- hij zegt WAT het was, de graad zegt hoe zeker. */
      const st = ctx.stand(rij.context, nu);
      uit.push({ sid, geopendOp: rij.geopendOp, gezienOp: rij.gezienOp,
        soort: (rij.context.authenticator && rij.context.authenticator.type) || null,
        /* De toestelId reist mee, de toestelNAAM niet: die woont in het
           toestelregister en wordt door de route erbij gezocht. Zou hij hier
           staan, dan had de sessie hem moeten dragen -- en dat is precies wat
           de verbodenlijst tegenhoudt. */
        toestelId: (rij.context.toestel && rij.context.toestel.toestelId) || null,
        /* Dezelfde knip als bij het toestel: de CODE reist mee, de naam niet.
           De naam van een zaak wordt door de route opgezocht bij de bron die
           hem bezit; een sessie draagt geen namen. */
        contextSoort: (rij.context.context && rij.context.context.contextSoort) || null,
        contextId: (rij.context.context && rij.context.context.contextId) || null,
        stand: st,
        /* DE VERTROUWENSSTAND WORDT HIER BEREKEND EN NERGENS BEWAARD. Hij leest
           de stand-per-veld die er net boven uit komt, dus hij kan nooit iets
           zien wat het scherm niet ziet -- en hij kan niet verouderen, want hij
           bestaat alleen op het moment dat iemand hem vraagt. */
        vertrouwen: standVan(st, (rij.context.authenticator && rij.context.authenticator.type) || null) });
    }
    return uit.sort((a, b) => new Date(b.gezienOp) - new Date(a.gezienOp));
  }

  return { vanLid };
}

module.exports = { maakSessielijst };
