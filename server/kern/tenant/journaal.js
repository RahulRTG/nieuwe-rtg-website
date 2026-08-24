/* Eén regel in het journaal van een werkruimte, in de vorm die
   bedrijf/rollen.js schrijft.

   Waarom een eigen bestandje voor zes regels: er zijn nu drie schrijvers
   (de rollenlaag zelf, de identiteitsbrug en de levensloop) en dat worden er
   meer. Elke schrijver die zijn eigen regel samenstelt, levert een journaal op
   waarin de auditor twee soorten regels leest -- en dan is de eerste vraag bij
   een incident niet wat er gebeurde, maar welke vorm hij voor zich heeft.

   `wie` is met opzet een BRON en geen mens ('identiteitsprovider',
   'levensloop'): wat een machine deed, hoort niet op naam van een medewerker te
   staan. Wie het WEL op naam deed, geeft die naam mee in `door` en die komt in
   de reden terecht. */
'use strict';

const crypto = require('crypto');

const MAX = 20000;

function schrijf(w, wie, wat, waarover, reden) {
  if (!w) return;
  w.journaal = w.journaal || [];
  w.journaal.unshift({
    id: crypto.randomBytes(4).toString('hex'),
    wie: wie || 'systeem', wieId: null,
    wat, waarover: waarover || null, reden: reden || null,
    at: new Date().toISOString()
  });
  if (w.journaal.length > MAX) w.journaal = w.journaal.slice(0, MAX);
}

module.exports = { schrijf, MAX };
