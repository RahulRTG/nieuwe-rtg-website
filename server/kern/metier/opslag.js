/* DE OPSLAG VAN METIER -- de wortel db.data.metier en zijn takken, achter EEN
   deur.

   Twee bestanden bouwden dezelfde wortel elk op hun eigen manier: ./index.js
   (het profiel, met vijf takken) en ./bewijs.js (de naamvrijgave per
   werkgever, met twee). Dezelfde vormregel op twee plekken, en wie een derde
   tak nodig had, raadde in welke van de twee hij hoorde.

   `wortel(takken)` maakt de wortel en de GEVRAAGDE takken aan, en niets meer:
   bewijs.js vraagt nog steeds alleen naamvrij en inzagelog, precies zoals hij
   deed. Een onbekende tak wordt geweigerd.

   WAT HIER NIET STAAT: de echte naam. In db.data.metier staat alleen een
   toestemming (wie mag hem zien, tot wanneer); de naam zelf komt uit de kluis
   (server/accounts.js) op het moment van inzage -- de kop van ./bewijs.js. */
'use strict';

const TAKKEN = {
  profiel:         'per lid: kop, over, rollen, vaardigheden (./index.js)',
  aanbeveling:     'per lid: aanbevelingen van anderen (./index.js)',
  onderschrijving: 'per lid: onderschreven vaardigheden (./index.js)',
  naamvrij:        'per lid: welke werkgever de echte naam mag zien, en tot wanneer (./bewijs.js)',
  inzagelog:       'per lid: wie de naam inzag (./bewijs.js)'
};

module.exports = function maakMetierOpslag({ db }) {
  if (!db) throw new Error('kern/metier/opslag: zonder db is er niets om te bewaren');
  function wortel(takken) {
    if (!db.data.metier || typeof db.data.metier !== 'object') db.data.metier = {};
    const m = db.data.metier;
    for (const k of takken) {
      if (!TAKKEN[k]) throw new Error('kern/metier/opslag: onbekende tak "' + k + '"');
      if (!m[k] || typeof m[k] !== 'object') m[k] = {};
    }
    return m;
  }
  return { wortel, TAKKEN };
};

module.exports.TAKKEN = TAKKEN;
