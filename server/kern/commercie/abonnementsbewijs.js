/* Geldbewijs voor de verrekenplanner. Geen nieuwe betaalstand of opslag;
   zowel directe cash als een doorgeschoven credit eindigt bij deze bron. */
'use strict';
const { STATUS, definitiefBetaald } = require('../betaalwaarheid/staten');
const { principalVoorSession } = require('../economie/principal');
const geld = n => Number.isSafeInteger(n) && n >= 0;
const id = v => typeof v === 'string' && v.length > 0 && v.trim() === v;
const datum = v => typeof v === 'string' && v.length === 24 && Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v ? Date.parse(v) : null;
function account(v) {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 && String(n) === String(v) ? String(n) : null;
}
const aliases = w => [...new Set([w.providerId, w.providerPaymentId].filter(Boolean))].map(x => w.provider + ':' + x);
function betaling(f, eigenaar, bron, tijd, gezien) {
  const redenen = [], ids = []; let betaald = 0n, terug = 0n;
  for (const b of f.betaalBewijzen) {
    const w = b && bron[b.id], ctx = w && w.context, dubbel = b && gezien.betalingen.has(b.id);
    if (b && id(b.id)) gezien.betalingen.add(b.id);
    if (!b || !id(b.id) || dubbel || !geld(b.centen) || b.centen === 0 || !w || w.id !== b.id ||
        !geld(w.centen) || w.centen !== b.centen || w.actor !== principalVoorSession({ account: { id: eigenaar } }) ||
        w.soort !== 'factuur' || w.bronRef !== f.id || w.valuta !== f.abonnement.valuta || !ctx || ctx.own !== true ||
        ctx.invoiceId !== f.id || account(ctx.accountId) !== eigenaar || !definitiefBetaald(w.status) ||
        ctx.contractId != null && ctx.contractId !== f.abonnement.contractId ||
        datum(w.afgehandeldAt) === null || datum(w.afgehandeldAt) > tijd || !id(w.provider) || !id(w.providerId)) {
      redenen.push('betaalbewijs is dubbel, onbevestigd of hoort niet bij deze factuur en eigenaar.'); continue;
    }
    if (!geld(w.terugbetaaldCenten) || w.terugbetaaldCenten > w.centen ||
        w.status === STATUS.TERUGBETALING_WACHT ||
        (w.terugbetaalOpdrachten != null && !Array.isArray(w.terugbetaalOpdrachten)) ||
        (w.terugbetaalOpdrachten || []).some(r => !r || r.status !== 'BEVESTIGD') ||
        (w.status === STATUS.TERUGBETAALD && w.terugbetaaldCenten !== w.centen) ||
        (w.status === STATUS.GEDEELTELIJK_TERUGBETAALD && !(w.terugbetaaldCenten > 0 && w.terugbetaaldCenten < w.centen)) ||
        (w.status === STATUS.BEVESTIGD && w.terugbetaaldCenten !== 0)) {
      redenen.push('terugbetaling is nog onderweg, onduidelijk of inconsistent.'); continue;
    }
    const a = aliases(w);
    if (a.some(x => gezien.providers.has(x))) {
      redenen.push('dezelfde providerbetaling staat onder meerdere bewijsidentiteiten.'); continue;
    }
    a.forEach(x => gezien.providers.add(x));
    betaald += BigInt(b.centen); terug += BigInt(w.terugbetaaldCenten); ids.push(w.id);
  }
  if (f.status !== 'paid' || betaald !== BigInt(f.abonnement.brutoCenten))
    redenen.push('de oorspronkelijke factuur is niet volledig en exact betaald.');
  return { ok: redenen.length === 0, redenen, betaald, terug, ids };
}
const regelSleutel = r => r?.soort === 'resttegoed'
  ? id(r.creditId) ? 'credit:' + r.creditId : null
  : id(r?.factuurId) ? 'factuur:' + r.factuurId : null;
module.exports = { geld, id, datum, account, aliases, betaling, regelSleutel };
