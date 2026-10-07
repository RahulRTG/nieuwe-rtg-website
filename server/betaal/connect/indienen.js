/* PARTNERAFREKENING OVER STRIPE CONNECT: INDIENEN bij Stripe. Uit
   ./afrekening.js gehaald (keuringsregel 13): dat bestand neemt de AANVRAAG aan
   (kantoor, vorm, reservering), dit LAAT het geld vertrekken. De drie regels uit
   de kop van ./afrekening.js gelden hier onverkort: beide poorten bij iedere
   stap die een nieuw effect maakt, eerst vastleggen dan bellen, en geen
   grootboekkoppeling geen afrekening. */
'use strict';
const S = require('./sleutel');
const { fout } = require('./fout');

module.exports = function maakIndienen({ stripe, opslag, poort, zetStand, iso, definitief }) {
  const lopend = new Map();
  /* Indienen bij Stripe, in twee stappen, elk met zijn eigen sleutel. Per id
     een slot binnen dit proces; tussen processen beschermen de sleutels. */
  function indienen(id) {
    if (lopend.has(id)) return lopend.get(id);
    const werk = (async () => {
      const rec = opslag.haal(id);
      if (!rec) throw fout('Onbekende afrekening.', 'ONBEKEND', 404);
      if (!stripe) throw fout('Stripe Connect is niet geconfigureerd.', 'PROVIDER_NIET_BESCHIKBAAR', 503);
      if (rec.stand === 'aangevraagd') {
        poort({ actor: { soort: 'systeem' } });
        rec.pogingen += 1; rec.laatstePoging = iso(); opslag.bewaar(rec);
        await opslag.vast();                      // EERST VASTLEGGEN, DAN BELLEN (regel 2)
        let t;
        try {
          t = await stripe.transfers.create({ amount: rec.centen, currency: rec.valuta, destination: rec.account,
            transfer_group: 'rtg-' + rec.id, metadata: { afrekening: rec.id } }, { idempotencyKey: S.idemTransfer(rec.id) });
        } catch (e) {
          rec.laatsteFout = String(e && e.message || e).slice(0, 200); opslag.bewaar(rec);
          if (definitief(e)) { await zetStand(rec, 'mislukt', 'stripe-transfer', rec.laatsteFout); await opslag.vast(); return rec; }
          await opslag.vast();
          throw fout('Stripe gaf geen uitsluitsel over de transfer; de veeg probeert het met dezelfde sleutel opnieuw.', 'OPNIEUW', 503, { opnieuw: true });
        }
        if (!t || !t.id || t.amount !== rec.centen || String(t.currency).toLowerCase() !== rec.valuta || t.destination !== rec.account) {
          opslag.bevinding({ soort: 'transfer-wijkt-af', afrekening: rec.id, gezien: t ? { id: t.id, amount: t.amount, currency: t.currency, destination: t.destination } : null });
          await opslag.vast();
          throw fout('Het antwoord van Stripe op de transfer klopt niet met de aanvraag; zie de bevindingen.', 'AFWIJKING', 502);
        }
        rec.transferId = t.id; opslag.bewaar(rec);
        await zetStand(rec, 'ingediend', 'stripe-transfer');
        await opslag.vast();
      }
      if (rec.stand === 'ingediend' && !rec.payoutId) {
        poort({ actor: { soort: 'systeem' } });
        rec.pogingen += 1; rec.laatstePoging = iso(); opslag.bewaar(rec);
        await opslag.vast();
        let p;
        try {
          p = await stripe.payouts.create({ amount: rec.centen, currency: rec.valuta, metadata: { afrekening: rec.id } },
            { idempotencyKey: S.idemPayout(rec.id), stripeAccount: rec.account });
        } catch (e) {
          rec.laatsteFout = String(e && e.message || e).slice(0, 200); opslag.bewaar(rec);
          if (definitief(e)) { await zetStand(rec, 'mislukt', 'stripe-payout', rec.laatsteFout); await opslag.vast(); return rec; }
          await opslag.vast();
          throw fout('Stripe gaf geen uitsluitsel over de payout; de veeg probeert het met dezelfde sleutel opnieuw.', 'OPNIEUW', 503, { opnieuw: true });
        }
        if (!p || !p.id || p.amount !== rec.centen) {
          opslag.bevinding({ soort: 'payout-wijkt-af', afrekening: rec.id, gezien: p ? { id: p.id, amount: p.amount } : null });
          await opslag.vast();
          throw fout('Het antwoord van Stripe op de payout klopt niet met de aanvraag; zie de bevindingen.', 'AFWIJKING', 502);
        }
        rec.payoutId = p.id; opslag.bewaar(rec);
        await zetStand(rec, 'onderweg', 'stripe-payout');
        if (p.status === 'paid') await zetStand(rec, 'betaald', 'stripe-payout');
        await opslag.vast();
      }
      return rec;
    })();
    lopend.set(id, werk);
    const los = () => { lopend.delete(id); };
    werk.then(los, los);
    return werk;
  }
  return indienen;
};
