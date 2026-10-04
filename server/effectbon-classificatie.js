'use strict';

const staatlog = require('./staatlog');
const effectcollecties = require('./kern/isolatie/effectcollecties');

/* Eén indeling voor zowel de aangewezen proxycollecties als de oude
   voor/na-meting. Zo kunnen die twee observatiepaden niet anders gaan spreken. */
function classificeerEffectcollecties({ voor, na, waargenomen }) {
  const namen = waargenomen == null
    ? Object.keys(staatlog.verschil(voor, na) || {})
    : [...waargenomen];
  const klassen = new Set(), refs = [];
  let zonderIndeling = 0;
  for (const naam of namen.sort()) {
    const rij = effectcollecties.effectVan(naam);
    if (rij) { klassen.add(rij.effect); refs.push(naam); }
    else zonderIndeling++;
  }
  return { klassen: [...klassen].sort(), refs: refs.sort(), zonderIndeling };
}

module.exports = { classificeerEffectcollecties };
