/* Alleen bestaande actorredactie, gevolgd door gewone API-eindregels.
   Herbouw de verwachte basis: een geldig zegel alleen bewijst geen geldige wijziging. */
'use strict';
const { commandHash } = require('./spoorketen');
const API_MAX = 5000;
const json = v => JSON.stringify(v);
module.exports = function valideerWissing(b, v, naam, extra, conflict) {
  const bl = Array.isArray(b.commandJournaal) ? b.commandJournaal : [];
  const vl = Array.isArray(v.commandJournaal) ? v.commandJournaal : [];
  const laatste = vl[vl.length - 1], afkap = Math.max(0, bl.length + 1 + extra - API_MAX);
  const herschreven = vl.slice(0, -1), oud = bl.slice(afkap);
  if (!laatste || laatste.actor !== 'systeem' || laatste.actie !== 'wissing in het spoor' ||
      laatste.uitslag !== 'gedaan' || herschreven.length !== oud.length)
    conflict(naam + ' is geen aantoonbare AVG-wissing.');
  const ruw = laatste.na && laatste.na.regelsGewist;
  const gemeld = typeof ruw === 'string' && /^[1-9]\d*$/.test(ruw) ? Number(ruw) : ruw;
  const kop = bl.length ? bl[bl.length - 1].zegel : null;
  if (!Number.isSafeInteger(gemeld) || gemeld < 1 || !laatste.voor || laatste.voor.kopVoorWissing !== kop)
    conflict(naam + ' verantwoordt de AVG-wissing niet volledig.');
  const verschillen = oud.filter((r, i) => r && herschreven[i] && r.actor !== herschreven[i].actor);
  const kandidaten = new Set((verschillen.length ? verschillen : bl.slice(0, afkap)).map(r => r && r.actor));
  for (const actor of kandidaten) {
    if (typeof actor !== 'string' || !actor || actor === 'gewist' ||
        bl.filter(r => r && r.actor === actor).length !== gemeld) continue;
    let vorig = bl.length ? bl[0].vorig : null;
    const verwacht = bl.map(r => {
      const { zegel, ...kern } = r;
      const nieuw = { ...kern, actor: r.actor === actor ? 'gewist' : r.actor, vorig };
      const uit = { ...nieuw, zegel: commandHash(nieuw) };
      vorig = uit.zegel;
      return uit;
    });
    if (laatste.vorig === vorig && json(verwacht.slice(afkap)) === json(herschreven)) return;
  }
  conflict(naam + ' wijkt af van volledige actorredactie met behoud van het ketenanker.');
};
