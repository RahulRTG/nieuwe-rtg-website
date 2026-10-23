'use strict';
/* Meerdere algemene auditlagen schrijven na hetzelfde antwoord. Verzamel hun
   synchrone finish-werk zodat SQLite de regels in één transactie kan zetten.
   Het antwoord is dan al verstuurd; iedere schrijver blijft best-effort.

   Het hangt aan ./antwoord-einde.js en niet zelf aan `finish`: daar woont de
   regel dat een antwoord precies een fysieke listener krijgt. Deze laag voegt
   alleen de bundel toe -- een taak in die rij voor alle schrijvers samen. */
const { naAntwoord } = require('./antwoord-einde');
const { losVanVerzoek } = require('./losvanverzoek');
const SLOT = Symbol('rtg.antwoordspoor');

module.exports = function antwoordspoor(res, schrijf, bundel) {
  let doos = res[SLOT];
  if (!doos) {
    doos = res[SLOT] = { schrijvers: [], bundel };
    naAntwoord(res, () => {
      const werk = () => {
        for (const fn of doos.schrijvers) { try { fn(); } catch (e) {} }
      };
      /* Dit is bewuste naverwerking NADAT het antwoord fysiek klaar is. De
         schrijvers hebben alle actor- en verzoekgegevens al in hun closure;
         de AsyncLocalStorage-context van het afgeronde verzoek mag hier niet
         blijven hangen. Anders telt de effectmeter deze auditopslag terecht
         als een late domeinschrijfactie van een al gesloten verzoek. */
      try { return losVanVerzoek(() => typeof doos.bundel === 'function' ? doos.bundel(werk) : werk()); }
      catch (e) { return undefined; }
    });
  }
  doos.schrijvers.push(schrijf);
};
