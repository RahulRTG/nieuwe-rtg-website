/* PARTNERAFREKENING OVER STRIPE CONNECT: de RECONCILIATIE. Uit ./melding.js
   gehaald (keuringsregel 13): melding en veeg BEWEGEN een stand, dit KIJKT
   alleen -- Stripe naast wat RTG vastlegde, en ieder verschil wordt een
   bevinding en nooit een correctie (zie de kop van ./melding.js). */
'use strict';

module.exports = ({ opslag, stripe, PAYOUT_STATUS }) => {
  /* De reconciliatie: per afrekening wat Stripe zegt naast wat RTG vastlegde,
     en of ieder vereist effect precies een keer in het effectjournaal staat. */
  return async function reconciliatie() {
    const voor = opslag.bevindingen().length;
    let gecontroleerd = 0;
    const effecten = opslag.effecten();
    const S = require('./sleutel');
    const heeft = (rec, soort) => !!effecten[S.economisch(rec.id, soort)];
    for (const rec of opslag.alle()) {
      gecontroleerd += 1;
      const b = (soort, extra) => opslag.bevinding(Object.assign({ soort, afrekening: rec.id, bron: 'reconciliatie' }, extra || {}));
      if (stripe && rec.transferId) {
        try {
          const t = await stripe.transfers.retrieve(rec.transferId);
          if (!t || t.amount !== rec.centen || String(t.currency).toLowerCase() !== rec.valuta || t.destination !== rec.account)
            b('transfer-wijkt-af', { gezien: t ? { amount: t.amount, currency: t.currency, destination: t.destination } : null });
          if (t && (t.reversed === true || Number(t.amount_reversed) >= rec.centen) && rec.stand !== 'teruggedraaid')
            b('stand-wijkt-af', { stripe: 'teruggedraaid', rtg: rec.stand });
        } catch (e) { b('niet-op-te-halen', { wat: 'transfer', fout: String(e.message || e).slice(0, 120) }); }
      }
      if (stripe && rec.payoutId) {
        try {
          const p = await stripe.payouts.retrieve(rec.payoutId, { stripeAccount: rec.account });
          const doel = p && PAYOUT_STATUS[p.status];
          if (!p || p.amount !== rec.centen) b('payout-wijkt-af', { gezien: p ? { amount: p.amount } : null });
          else if (doel && doel !== rec.stand && rec.stand !== 'teruggedraaid') b('stand-wijkt-af', { stripe: doel, rtg: rec.stand });
        } catch (e) { b('niet-op-te-halen', { wat: 'payout', fout: String(e.message || e).slice(0, 120) }); }
      }
      // het grootboek: welk effect hoort bij deze stand, en staat het er
      if (rec.stand !== 'mislukt' || rec.transferId) {
        if (!heeft(rec, 'reservering')) b('effect-ontbreekt', { effect: 'reservering' });
      }
      if (rec.stand === 'betaald' && !heeft(rec, 'afgerekend')) b('effect-ontbreekt', { effect: 'afgerekend' });
      if (rec.stand === 'teruggedraaid' && heeft(rec, 'reservering') && !heeft(rec, 'teruggeboekt')) b('effect-ontbreekt', { effect: 'teruggeboekt' });
      if ((rec.stand === 'mislukt' || rec.stand === 'geannuleerd') && !rec.transferId && heeft(rec, 'reservering') && !heeft(rec, 'teruggeboekt'))
        b('effect-ontbreekt', { effect: 'teruggeboekt' });
      if (heeft(rec, 'afgerekend') && !['betaald', 'teruggedraaid'].includes(rec.stand)) b('effect-zonder-stand', { effect: 'afgerekend' });
    }
    const nieuw = opslag.bevindingen().slice(voor);
    await opslag.vast();
    return { gecontroleerd, nieuweBevindingen: nieuw, sluit: nieuw.length === 0 };
  };
};
