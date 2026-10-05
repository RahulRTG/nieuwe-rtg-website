/* DE REM OP EEN CODE VAN DE TWEEDE FACTOR -- een plek voor elke deur die er een
   toetst.

   Vier deuren toetsen zo'n code: de tweede inlogstap (/api/auth/tweede),
   uitzetten (/api/mijn/tweefactor/uit), nieuwe herstelcodes
   (/api/mijn/tweefactor/codes) en de inlog van de techniekpagina
   (/api/techniek/inloggen). Ze delen DEZE emmers. Had elke deur een eigen emmer,
   dan gaf elke deur opnieuw tien gokken (RTG-V1-RELEASE C3 en de herkeuringen
   daarvan).

   Twee emmers, zoals bij de wachtwoordinlog: een per ACCOUNT (10) en een per
   BRON (50). De accountemmer hangt niet aan het bewijs: wie het wachtwoord kent,
   haalt met een nieuwe inlog een vers bewijs.

   EEN SLOT, GEEN QUARANTAINE (besluit van de eigenaar, N4, 5 oktober 2026). Wie
   hier aanklopt kent het wachtwoord al. Meldde een vol slot zich als brute force
   bij de noodrem, dan ging het adres van de LAATSTE poging een uur in
   quarantaine. Wie het wachtwoord kent, laadt dan negen gokken vooraf, en de
   eerste typefout van het lid blokkeert zijn eigen adres. Het slot meldt zich
   daarom als `tweede-stap-slot`: een waarschuwing op het veiligheidsbord, en de
   noodrem reageert alleen op `brute-force` (../../beveiliging.js).

   Een geslaagde code leegt alleen de ACCOUNTemmer, nooit die van de bron. Een
   geslaagde code bewijst iets over dat ene account en niets over het adres
   ervan: leegde hij ook de bronemmer, dan zette een aanvaller met een eigen
   account met tweede factor de limiet van 50 per adres terug wanneer hij
   wilde, en gokte hij vanaf een adres onbeperkt op de accounts van anderen
   (herkeuring van N4, 5 oktober 2026). De bronemmer loopt vanzelf af.

   Het slot zelf blijft: vijf minuten dicht, ook voor de juiste code. Tegen 10^6
   codes helpt een vertraging een aanvaller met veel adressen niet. */
'use strict';

const SOORT = 'tweede-stap-slot';

function maakTweedeStapRem({ tooManyTries, noteFailedTry, loginFails }) {
  const emmers = (id, ip) => ['tweede:doel:' + id, 'tweede:bron:' + ip];
  return {
    /* true als een emmer dicht is; dan is het 429-antwoord al gestuurd. */
    dicht(res, id, ip) {
      const [doel, bron] = emmers(id, ip);
      return tooManyTries(res, doel) || tooManyTries(res, bron);
    },
    mis(id, ip) {
      const [doel, bron] = emmers(id, ip);
      noteFailedTry(doel, ip, 10, SOORT);
      noteFailedTry(bron, ip, 50, SOORT);
    },
    gelukt(id, ip) {
      loginFails.delete(emmers(id, ip)[0]);   // alleen het account; zie de kop
    }
  };
}

module.exports = { maakTweedeStapRem, SOORT };
