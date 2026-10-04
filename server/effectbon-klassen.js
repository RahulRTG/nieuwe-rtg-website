/* De klassen en de collecties die in een verzoek bewogen (./effectbon.js).

   Nieuwe runtime: de db-proxy heeft de bewogen collecties tijdens de mutatie
   zelf al aangewezen (./effectmeter-collecties.js). De oude voor/na-vorm
   blijft uitsluitend als expliciete terugval voor losse toetsen en voor een
   niet-bewaakte datastore; daar geeft `verschil()` per collectie een getal of
   'gewijzigd', en welke van de twee doet hier niet toe -- de vraag is of zij
   bewoog. Beide wegen delen dezelfde indeling. */
'use strict';

const staatlog = require('./staatlog');
const effectcollecties = require('./kern/isolatie/effectcollecties');

function indeling(namen) {
  const klassen = new Set();
  const refs = [];
  let zonderIndeling = 0;
  for (const naam of namen) {
    const rij = effectcollecties.effectVan(naam);
    if (rij) { klassen.add(rij.effect); refs.push(naam); } else { zonderIndeling++; }
  }
  return { klassen: [...klassen].sort(), refs: refs.sort(), zonderIndeling };
}

function klassenVan({ voor, na, teller }) {
  const t = teller || {};
  if (t.collecties && typeof t.collecties[Symbol.iterator] === 'function') return indeling([...t.collecties]);
  return indeling(Object.keys(staatlog.verschil(voor, na) || {}));
}

module.exports = { klassenVan };
