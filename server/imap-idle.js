/* IMAP: WACHTEN OP NIEUWE POST (IDLE, RFC 2177).

   Afgesplitst van ./imap.js op zijn eigen onderwerp, en niet alleen om de
   tienkilobyte-grens: dit is de enige laag in de hele adapter die uit ZICHZELF
   iets naar de client stuurt. Al het andere is vraag-en-antwoord. Dat verschil
   verdient een eigen bestand, want alles wat hier fout kan gaan is van een
   andere soort -- een lus die blijft draaien, een schrijfactie naar een socket
   die niet meer bestaat.

   IDLE ZONDER DUWLAAG, en dat staat er eerlijk bij. RTMAIL heeft geen
   gebeurtenisbus waarop deze laag kan wachten, dus we kijken zelf: zolang de
   client stil hangt wordt de open map elke paar seconden opnieuw geteld, en
   groeit hij, dan gaat er een `* n EXISTS` naartoe. Voor de CLIENT is dat het
   echte IDLE -- die hoeft niet meer te pollen en ziet nieuwe post binnen een
   paar seconden. Voor ONS is het een lus, en dat is geen detail om te
   verzwijgen: bij honderden stille clients knijpt het hier eerst, en dan hoort
   er een bus onder te komen in plaats van een kortere tussentijd.

   ALLEEN MELDEN DAT ER MEER IS. Een map die krimpt (post verplaatst of gewist)
   levert geen mededeling op: daarvoor bestaat EXPUNGE, en een `* n EXISTS` met
   een LAGER getal is voor een client een leugen over de nummering die hij op dat
   moment gebruikt.

   STOPPEN HOORT OP DRIE MOMENTEN, en niet op een: bij DONE, bij LOGOUT, en als
   de verbinding wegvalt. Die laatste is de enige die je vergeet, want de andere
   twee komen van de client zelf -- en dan blijft er een timer draaien op een
   socket die niet meer bestaat. ./imap-server.js roept daarvoor sluit() aan op
   'close' en op 'error'. */
'use strict';

const IDLE_MS = 4000;

module.exports = ({ ms } = {}) => {
  const tussentijd = ms || IDLE_MS;

  /* Een wacht per sessie. `tel()` geeft het huidige aantal berichten in de open
     map (de sessie herlaadt daarvoor zelf), `zeg()` schrijft een regel. */
  function maak({ tel, zeg }) {
    let lopend = null;   // { merk, timer }

    return {
      get lopend() { return !!lopend; },
      get merk() { return lopend ? lopend.merk : null; },
      start(merk, beginAantal) {
        if (lopend) return false;
        let vorig = beginAantal;
        const timer = setInterval(() => {
          try {
            const nu = tel();
            if (nu > vorig) { zeg('* ' + nu + ' EXISTS'); zeg('* ' + (nu - vorig) + ' RECENT'); }
            vorig = nu;
          } catch (e) { /* een tik die mislukt mag de verbinding niet slopen */ }
        }, tussentijd);
        // een stille client houdt het proces niet in de lucht
        if (timer.unref) timer.unref();
        lopend = { merk, timer };
        return true;
      },
      stop() {
        if (lopend && lopend.timer) clearInterval(lopend.timer);
        lopend = null;
      }
    };
  }

  return { maak, IDLE_MS: tussentijd };
};
