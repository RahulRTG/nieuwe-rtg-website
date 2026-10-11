/* Het verbond: de toetsen op INVOER en de weigering op STAND. Puur, zonder
   opslag; los van index.js zodat de regel over wat een mens mag invullen en
   wanneer een verbond dicht is op een plek staat. */
'use strict';

const { keur } = require('../veilig');
const R = require('./regels');

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/* Ontsmetten doet de gedeelde helper (kern/util.js): geen < en >, afknippen,
   en een object of lijst wordt leeg. Hier wordt eerst getrimd, zodat een spatie
   voor een datum het laatste teken niet wegknipt. */
const U = require('../util');
const schoon = (t, max) => U.schoon(typeof t === 'string' ? t.trim() : t, max);

function toetsDatums(van, tot) {
  for (const [naam, d] of [['begindatum', van], ['einddatum', tot]]) {
    if (d && (!DATUM.test(d) || Number.isNaN(Date.parse(d))))
      return { status: 400, error: 'De ' + naam + ' klopt niet; gebruik een datum als 2026-11-01.' };
  }
  if (van && tot && tot < van) return { status: 400, error: 'De einddatum ligt voor de begindatum.' };
  return null;
}

function toetsDoel(doel) {
  if (!doel) return { status: 400, error: 'Waarvoor sluiten jullie dit verbond? Schrijf het doel in een of twee zinnen.' };
  const k = keur(doel);
  if (!k.ok) return { status: 400, error: k.reden };
  return null;
}

/* Een opgezegd of verlopen verbond neemt niets nieuws meer aan. 409, met de
   reden: het verzoek klopt, de stand laat het niet toe. */
function dicht(v, nu) {
  const st = R.standVan(v, nu);
  if (st === 'opgezegd') return { status: 409, error: 'Dit verbond is opgezegd op ' + v.opzegging.at.slice(0, 10) +
    ' ("' + v.opzegging.reden + '"). Wat er is afgesproken blijft leesbaar, maar er verandert niets meer aan.' };
  if (st === 'verlopen') return { status: 409, error: 'Dit verbond is verlopen op ' + v.tot +
    '. Wat er is afgesproken blijft leesbaar; sluit een nieuw verbond als jullie verder willen.' };
  return null;
}

module.exports = { schoon, toetsDatums, toetsDoel, dicht, keur };
