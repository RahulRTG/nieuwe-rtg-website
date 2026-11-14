/* De aanvraag-eigenaar bewaart een betaalpoging vóór de async geldbeweging.
   Bij onbekende afloop blijft die poging staan. Een retry gebruikt dezelfde
   beweging; wijzigen/afzeggen wacht tot de betaling aantoonbaar is afgerond. */
'use strict';

const { leesPrijsgrond } = require('./reisbureau-prijsgrond');

module.exports = ({ opslag, save, bewerkCollectie, nu }) => {
  async function schrijf(ref, werk) {
    if (typeof bewerkCollectie === 'function') {
      return bewerkCollectie({ reisAanvragen: 'lijst' }, data => {
        const a = data.reisAanvragen.find(x => !x.keten && x.ref === ref);
        return a ? werk(a) : { status: 404, error: 'Aanvraag niet gevonden.' };
      });
    }
    // Losse moduleproeven gebruiken dezelfde kopie/commit-grens als de opslag.
    const oud = opslag.aanvragen(), kopie = JSON.parse(JSON.stringify(oud));
    const a = kopie.find(x => !x.keten && x.ref === ref);
    if (!a) return { status: 404, error: 'Aanvraag niet gevonden.' };
    const r = werk(a);
    if (r.error || JSON.stringify(oud) === JSON.stringify(kopie)) return r;
    opslag.zetAanvragen(kopie);
    try { save(); } catch (e) { opslag.zetAanvragen(oud); throw e; }
    return r;
  }

  function reserveerInning(ref, { key, codenaam }) {
    return schrijf(ref, a => {
      if (a.customerKey !== key) return { status: 404, error: 'Aanvraag niet gevonden.' };
      if (a.betaald) return { ok: true, alBetaald: true, betaling: a.betaald };
      if (a.status !== 'bevestigd') return { status: 409, error: 'Deze reis is nog niet bevestigd door een reisadviseur.' };
      const g = leesPrijsgrond(a);
      if (!g.ok) return { status: 409, error: 'Deze reis heeft geen geldige vastgelegde prijsgrond.', hoe: g.waarom };
      const vorige = a.inning;
      if (vorige && (vorige.prijsHash !== g.hash || vorige.personen !== g.personen ||
          vorige.centen !== g.centen || vorige.van !== codenaam))
        return { status: 409, error: 'Een eerdere betaalpoging heeft andere gegevens. Eerst moet de geldbeweging worden hersteld.' };
      a.inning = { stand: 'bezig', prijsHash: g.hash, personen: g.personen,
        centen: g.centen, van: codenaam, at: vorige ? vorige.at : nu() };
      return { ok: true, herstel: !!vorige, titel: a.titel, grond: g, inning: { ...a.inning } };
    });
  }

  function stopInning(ref) {
    return schrijf(ref, a => {
      if (a.betaald || !a.inning) return { ok: true };
      delete a.inning;
      return { ok: true };
    });
  }

  function markeerBetaald(ref, betaling) {
    return schrijf(ref, a => {
      if (a.betaald) {
        const b = a.betaald;
        if (b.boeking === betaling.boeking && b.centen === betaling.centen &&
            b.valuta === betaling.valuta && b.van === betaling.van)
          return { ok: true, alBetaald: true, betaald: b };
        return { status: 409, error: 'Deze reis heeft een andere betaling.', betaald: b };
      }
      const i = a.inning;
      if (!i || i.stand !== 'bezig' || i.centen !== betaling.centen || i.van !== betaling.van ||
          a.status !== 'bevestigd' || a.personen !== i.personen)
        return { status: 409, error: 'De aanvraag is tijdens de betaling veranderd. De geldbeweging vereist herstel.' };
      a.betaald = { ...betaling };
      a.inning = { ...i, stand: 'afgerond' };
      return { ok: true, betaald: a.betaald };
    });
  }

  return { reserveerInning, stopInning, markeerBetaald, bewerkAanvraag: schrijf };
};
