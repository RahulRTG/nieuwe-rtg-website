/* DE LAATSTE HANDELINGEN VOOR DE DEUR OPENGAAT.

   Twee dingen die allebei bij de START horen en niet bij het luisteren, en die
   allebei VOOR app.listen moeten gebeuren: de callback van listen vuurt pas een
   tik later, en in dat gaatje kan er al een verzoek binnen zijn.

   Ze staan hier los omdat opzet/luister.js anders over de waarschuwingsband van
   de keuring gaat, en omdat de knip langs een echte grens loopt: daar gaat het
   over waar de server op gaat staan, hier over wat er af moet zijn voordat dat
   mag. */
'use strict';

module.exports = function startslot({ accounts, log }) {
  /* HET SEEDVENSTER DICHT, VOOR DE DEUR OPENGAAT. Wat het venster is en waarom
     het mag bestaan staat bij hashPasswordSync in accounts/kluis.js; hier staat
     alleen waarom het JUIST HIER dichtgaat. Vanaf listen is elk wachtwoord dat
     erbij komt van een echte gebruiker. En met opzet voor app.listen en niet in
     de callback erna: die vuurt pas een tik later, en in dat gaatje kan een
     verzoek al binnen zijn. Het getal erbij, anders is niet te zien of de
     besparing er nog is (LAT-regel 10). */
  if (accounts && typeof accounts.sluitSeedvenster === 'function') {
    const seedvenster = accounts.sluitSeedvenster();
    if (seedvenster.stondOpen) {
      log.info('[demoseed] seedvenster dicht', { woorden: seedvenster.woorden, hergebruikt: seedvenster.hergebruikt });
    }
  }

  /* WAT DE BRONKAS DEZE START HEEFT UITGESPAARD. Zonder dit getal is niet te
     zien of hij nog raak is: een sleutel die per ongeluk elke start verandert
     geeft een kas die nooit iets teruggeeft en wel elke keer betaald wordt --
     precies de vorm waar LAT-regel 10 voor waarschuwt. Alleen loggen als er iets
     te melden is, zodat een normale start stil blijft. */
  try {
    const kas = require('../lib/bronkas');
    const t = kas.tellers;
    if (t.raak || t.mis || t.fout) {
      log.info('[bronkas] ' + t.raak + ' uit de kas, ' + t.mis + ' vers gerekend'
        + (t.fout ? ', ' + t.fout + ' onbruikbaar' : '')
        + (t.bespaardMs ? ' (' + t.bespaardMs + ' ms gerekend)' : ''));
    }
  } catch (e) { /* de kas is een versnelling, geen voorwaarde om te luisteren */ }

};
