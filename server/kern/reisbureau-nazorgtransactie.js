/* De controle op een lopende inning en de nazorgmutatie delen hetzelfde
   aanvraag-slot. Ook een ander proces kan dus niet op een oud beeld afzeggen.
   Meldingen, dossierwerk en visum-I/O volgen pas na een geslaagde commit. */
'use strict';

const maakNazorg = require('./reisbureau-nazorg');

module.exports = ({ bewerkAanvraag, nazorg, nu, dossier, visum, meldLid }) => {
  async function doe(naam, ref, args) {
    const effecten = [];
    const r = await bewerkAanvraag(ref, a => {
      // De reeds betaalde refundroute blijft bij de geld-eigenaar. Hij kan
      // geen lopende inning voorbij: betaald wordt pas na die inning gezet.
      if (naam === 'zegAf' && a.betaald) return { betaaldeAfzegging: true };
      const lokaal = maakNazorg({ rij: () => [a], save: () => {}, nu,
        dossier: dossier ? { weghalen: (...v) => effecten.push(() => dossier.weghalen(...v)) } : null,
        visum: () => null,
        meldLid: (...v) => effecten.push(() => meldLid(...v)),
        terugboeken: () => ({ status: 409, error: 'De betaalstand veranderde; herhaal de afzegging.' }) });
      const uit = lokaal[naam](...args);
      if (uit.ok && naam === 'zegAf') effecten.push(async () => {
        const vt = visum && visum();
        if (vt) await vt.bijAnnulering(a.customerKey, a.ref);
      });
      return uit;
    });
    if (r.betaaldeAfzegging) return nazorg.zegAf(...args);
    if (r.ok) for (const effect of effecten) await effect();
    return r;
  }
  return {
    vraagWijziging: (key, ref, wens) => doe('vraagWijziging', ref, [key, ref, wens]),
    besluitWijziging: (ref, besluit, door, bericht) => doe('besluitWijziging', ref, [ref, besluit, door, bericht]),
    zegAf: invoer => doe('zegAf', invoer.ref, [invoer]),
    markeerThuis: invoer => doe('markeerThuis', invoer.ref, [invoer])
  };
};
