/* DE OMKEERPOORT -- boven de omkeerbaarheidsgrens en niet omkeerbaar: meteen nee.

   AFGESPLITST VAN ./klaarzet.js (10 KB-regel), op dezelfde naad als ./gevolgpoort.js:
   een poort die de hele handeling kan stoppen is een ander onderwerp dan het klaarzetten.

   Eigenaarsbesluit 2B-aangepast (11 oktober 2026). Zonder deze poort zette de baan het
   voornemen klaar, vroeg een tweede mens om met zijn passkey te tekenen, en kwam de
   weigering pas daarna -- een ticket en een ceremonie voor een uitkomst die vooraf
   vaststond. Het getal komt uit kern/commercie/besluit.js, de omkeerbaarheid uit
   kern/commercie/geldomkeer.js en de grendel uit kern/commercie/risicouitzondering.js:
   er ontstaat geen tweede regel. Staat de uitzonderingsprocedure open, dan gaat het wel
   door naar het besluit, dat dan de risicogoedkeuring eist. */
'use strict';

const geldomkeer = require('../../commercie/geldomkeer');
const risico = require('../../commercie/risicouitzondering');
const { BELEID } = require('../../commercie/besluit');

function omkeerpoort(o, grendel) {
  const omkeer = geldomkeer.voor(o.handeling);
  /* Het totaal uit de STAPPEN, zoals het voornemen het rekent -- een opgegeven totaal
     dat lager is of ontbreekt, mag deze vroege weigering niet ontlopen. */
  const uitStappen = (Array.isArray(o.stappen) ? o.stappen : []).reduce((n, x) => n + (Number(x && x.centen) || 0), 0);
  const totaal = Math.max(uitStappen, Number(o.totaalCenten) || 0);
  const g = risico.stand(grendel);
  if (totaal < BELEID.omkeerbaarBovenCenten || omkeer.omkeerbaar || g.open) return { omkeer, nee: null };
  return { omkeer, nee: { status: 403, onomkeerbaar: omkeer,
    error: 'Vanaf ' + (BELEID.omkeerbaarBovenCenten / 100).toFixed(0) + ' euro gaat een geldhandeling alleen door als zij ' +
      'terug te draaien is, en deze is dat niet: ' + omkeer.reden + ' ' + g.reden +
      ' Er is niets klaargezet en er beweegt geen geld.' } };
}

module.exports = { omkeerpoort };
