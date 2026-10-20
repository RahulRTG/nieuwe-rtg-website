/* Duurzame provider-inbox: identificeert en ontdubbelt een melding voordat
   zij de bestaande status- en afhandelpoorten aanroept. Geen betaalprovider
   starten, geen restitutie uitvoeren en geen eigen financiële toestand. */
module.exports = (ctx) => {
  const { meldingenVan, doos, save, nuIso, handelAf, pasProviderToe, providerProof, log } = ctx;
  async function providerMelding(invoer) {
    const meldingen = meldingenVan();
    const eventId = String(invoer.eventId || (invoer.aanbieder + ':' + invoer.providerId + ':' + invoer.status));
    if (meldingen[eventId] && meldingen[eventId].verwerktAt) {
      if (meldingen[eventId].conflict) return false;
      const eerder = meldingen[eventId].betalingId && doos()[meldingen[eventId].betalingId];
      if (eerder) await handelAf(eerder); /* herstel na een lokale afhandelstoring */
      return meldingen[eventId].betalingId || null;
    }
    if (!meldingen[eventId]) meldingen[eventId] = { eventId, aanbieder: invoer.aanbieder,
      providerId: invoer.providerId || null, ontvangenAt: nuIso(), verwerktAt: null };
    save(); /* duurzame inbox vóór een 2xx aan de provider */
    /* De eigen referentie wint van het provider-id. Bij Adyen valt het
       paymentLinkId buiten de HMAC, de merchantReference niet: wie in een echt
       ondertekend bericht alleen het link-id verwisselt, mag daarmee geen
       andere betaling raken. Wijst het provider-id naar een ander record dan
       de referentie, dan raakt deze melding geen van beide en staat het
       conflict in de inbox. */
    const opReferentie = invoer.referentie ? doos()[String(invoer.referentie)] : null;
    const opProviderId = invoer.providerId ? Object.values(doos()).find(x =>
      x.providerId === invoer.providerId || x.providerPaymentId === invoer.providerId) : null;
    if (opReferentie && opProviderId && opReferentie !== opProviderId) {
      meldingen[eventId].conflict = { referentie: opReferentie.id, providerId: opProviderId.id };
      meldingen[eventId].betalingId = null;
      meldingen[eventId].verwerktAt = nuIso();
      save();
      if (log && log.warn) log.warn('betaalmelding wijst naar twee betalingen; niets toegepast',
        { eventId, aanbieder: invoer.aanbieder });
      return false;
    }
    const r = opReferentie || opProviderId;
    if (!r && /^BW-/.test(String(invoer.referentie || ''))) {
      meldingen[eventId].wachtOpWaarheid = true;
      save();
      throw new Error('De betaalwaarheid is nog niet zichtbaar; provider moet opnieuw proberen.');
    }
    if (r) {
      meldingen[eventId].betalingId = r.id;
      save(); /* koppeling staat vast vóór de mogelijk falende domeinafhandeling */
      await pasProviderToe(r, invoer, eventId, invoer.gebeurtenis,
        invoer.providerProof || providerProof(invoer.providerSource));
    } else meldingen[eventId].betalingId = null;
    meldingen[eventId].verwerktAt = nuIso();
    save();
    return r ? r.id : null;
  }

  return providerMelding;
};
