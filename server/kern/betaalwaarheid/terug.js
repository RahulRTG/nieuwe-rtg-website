/* Terugbetalingen bij de betaalwaarheid. Zowel een RTG-opdracht als een
   provider-webhook komt hier uit; één provider-refund telt daardoor nooit
   dubbel, ook niet als de webhook opnieuw of na een herstart arriveert. */
'use strict';

module.exports = function teruglaag(ctx) {
  const { d, doos, save, nuIso, gebeurtenis, naar, STATUS, definitiefBetaald,
    publiek, betaal } = ctx;

  function boek(r, invoer) {
    const providerRefundId = String(invoer.providerRefundId || invoer.id || '');
    if (!Array.isArray(r.terugbetalingen)) r.terugbetalingen = [];
    if (providerRefundId && r.terugbetalingen.some(x => x.providerRefundId === providerRefundId)) return true;
    const centen = Math.round(Number(invoer.centen));
    const resterend = r.centen - (r.terugbetaaldCenten || 0);
    if (!Number.isFinite(centen) || centen <= 0 || centen > resterend) {
      r.blokkade = 'terugbetaalbedrag-wijkt-af';
      naar(r, STATUS.CONTROLE_NODIG, { bron: invoer.aanbieder || r.provider,
        providerRefundId, ontvangenCenten: centen, resterendCenten: resterend });
      save(); return false;
    }
    if (r.status !== STATUS.TERUGBETALING_WACHT)
      naar(r, STATUS.TERUGBETALING_WACHT, { bron: invoer.aanbieder || r.provider, centen });
    r.terugbetaaldCenten = (r.terugbetaaldCenten || 0) + centen;
    r.terugbetalingen.push({ providerRefundId: providerRefundId || null,
      centen, at: nuIso(), aanbieder: invoer.aanbieder || r.provider });
    naar(r, r.terugbetaaldCenten === r.centen ? STATUS.TERUGBETAALD : STATUS.GEDEELTELIJK_TERUGBETAALD,
      { bron: invoer.aanbieder || r.provider, providerRefundId, centen });
    save(); return true;
  }

  async function terugbetalen(id, invoer) {
    const r = doos()[id];
    if (!r || !definitiefBetaald(r.status)) throw new Error('Alleen bevestigd geld kan terugbetaald worden.');
    const centen = Math.round(Number(invoer.centen));
    const resterend = r.centen - (r.terugbetaaldCenten || 0);
    if (!Number.isFinite(centen) || centen <= 0 || centen > resterend) throw new Error('Ongeldig terugbetaalbedrag.');
    naar(r, STATUS.TERUGBETALING_WACHT, { centen, reden: String(invoer.reden || '').slice(0, 120) });
    save(); /* opdracht staat vast vóór hij naar de rail gaat */
    const p = await betaal.maakTerugbetaling({ aanbieder: r.provider,
      providerId: r.providerPaymentId || r.providerId, bedrag: centen, valuta: r.valuta,
      referentie: r.id, idempotentieSleutel: 'terug:' + r.id + ':' + (r.terugbetaaldCenten || 0) + ':' + centen,
      omschrijving: invoer.reden });
    if (['refunded', 'succeeded'].includes(String(p.status || '').toLowerCase()))
      boek(r, { providerRefundId: p.id, centen, aanbieder: r.provider });
    else {
      r.laatsteTerugbetaling = { providerRefundId: p.id || null, centen, status: p.status || 'wacht', at: nuIso() };
      gebeurtenis(r, 'TERUGBETALING_BIJ_PROVIDER', { bron: r.provider,
        providerRefundId: p.id || null, centen, providerStatus: p.status || null });
      save();
    }
    return publiek(r);
  }

  async function providerTerugbetaling(invoer) {
    const meldingen = d().betaalWaarheidMeldingen || (d().betaalWaarheidMeldingen = {});
    const eventId = String(invoer.eventId || ('refund:' + invoer.providerRefundId));
    if (meldingen[eventId] && meldingen[eventId].verwerktAt) return meldingen[eventId].betalingId || null;
    if (!meldingen[eventId]) meldingen[eventId] = { eventId, aanbieder: invoer.aanbieder,
      providerId: invoer.providerPaymentId || null, ontvangenAt: nuIso(), verwerktAt: null, soort: 'terugbetaling' };
    save();
    const r = Object.values(doos()).find(x =>
      (invoer.providerPaymentId && (x.providerPaymentId === invoer.providerPaymentId || x.providerId === invoer.providerPaymentId)) ||
      (invoer.referentie && x.id === invoer.referentie));
    if (!r) throw new Error('De oorspronkelijke betaling van deze terugbetaling is niet gevonden.');
    if (invoer.gelukt === false) {
      r.blokkade = 'terugbetaling-mislukt';
      naar(r, STATUS.CONTROLE_NODIG, { bron: invoer.aanbieder,
        providerRefundId: invoer.providerRefundId || null });
      save();
    } else boek(r, { providerRefundId: invoer.providerRefundId,
      centen: invoer.centen, aanbieder: invoer.aanbieder });
    meldingen[eventId].betalingId = r.id; meldingen[eventId].verwerktAt = nuIso(); save();
    return r.id;
  }

  return { terugbetalen, providerTerugbetaling };
};
