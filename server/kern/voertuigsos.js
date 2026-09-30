/* De SOS van een huurauto en van een charter: vergeet verlopen posities
   (NAVIGATIE.md N18).

   Beide schrijven hun noodsignaal in `sos` op de boeking (routes/member/
   voertuigen/huur.js en charter.js), met lat/lng als de huurder of gast die
   meestuurde, en de zaak sluit hem met `ok: { door, at }` (routes/supplier/
   verhuur/rit.js en charter/reis.js). Het lid kan zo'n SOS niet zelf intrekken
   en er is geen proef -- dus hier geldt alleen de termijn: open blijft staan,
   90 dagen na afhandelen gaat de plek eraf. De melding zelf blijft: dat er een
   SOS was en wie hem afhandelde, hoort bij de huurgeschiedenis.

   Losse module en geen regel in de routebestanden, omdat die tegen de 10 KB
   aan zitten en de bewaarveger hem via opzet/start.js krijgt ingespoten. */
'use strict';

const { veeg } = require('./sospositie');
const SOORTEN = { huur: 1, charter: 1 };

function vergeetVoertuigSos(boekingen, nu) {
  let n = 0;
  for (const b of boekingen || []) {
    if (!b || !SOORTEN[b.kind] || !Array.isArray(b.sos) || !b.sos.length) continue;
    n += veeg(b.sos, { velden: ['lat', 'lng'], dicht: s => s.ok && s.ok.at, nu });
  }
  return n;
}

module.exports = { vergeetVoertuigSos };
