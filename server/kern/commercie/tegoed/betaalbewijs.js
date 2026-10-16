/* De betaalbewijsgrens voor AI-capaciteit.

   De tegoedadministratie kent bundels en credits. Deze module kent de extra
   voorwaarde voor een aankoop: een serveradapter moet exact dit product, deze
   betaler, prijs en valuta als SETTLED aanwijzen. Een clientreferentie is nooit
   zelf bewijs. De evidence-id bindt het geldspoor idempotent aan één effect. */
'use strict';

const bewijsTekst = v => {
  const s = String(v == null ? '' : v);
  return /^[A-Za-z0-9._:-]{8,160}$/.test(s) ? s : '';
};

module.exports = function maakBundelkoop({ BUNDELS, verifieerBetaalbewijs, bewijsBak,
  rijVan, restVan, tijd, save }) {
  return function koopBundel(houder, pas, bundelId, prijs, bewijsRef) {
    const b = BUNDELS[String(bundelId || '')];
    if (!b) return { status: 404, error: 'Deze bundel bestaat niet.' };
    if (!b.credits) return { status: 400, error: b.naam + ' is een contractafspraak en wordt niet los gekocht.' };
    const centen = prijs && Number.isFinite(prijs.centen) ? prijs.centen : null;
    if (centen === null) return { status: 409, error: prijs && prijs.reden ||
      'Voor deze bundel is nog geen prijs vastgesteld; hij is daarom niet te koop.' };
    if (typeof verifieerBetaalbewijs !== 'function') return { status: 409,
      code: 'PAYMENT_EVIDENCE_REQUIRED',
      error: 'Deze aankoop blijft geblokkeerd tot RTG de betaling servermatig heeft bevestigd.' };

    let bewijs;
    const verwacht = { payerRef: String(houder || ''), productRef: 'ai-bundle:' + b.id,
      amountCenten: centen, currency: 'EUR' };
    try { bewijs = verifieerBetaalbewijs(bewijsRef, verwacht); }
    catch (e) { return { status: 503, code: 'PAYMENT_EVIDENCE_UNAVAILABLE',
      error: 'Het betaalbewijs kon niet veilig worden gecontroleerd.' }; }
    const evidenceId = bewijsTekst(bewijs && bewijs.evidenceId);
    const ledgerRef = bewijsTekst(bewijs && bewijs.ledgerRef);
    if (!bewijs || typeof bewijs.then === 'function' || bewijs.ok !== true || bewijs.status !== 'SETTLED' ||
        bewijs.payerRef !== verwacht.payerRef || bewijs.productRef !== verwacht.productRef ||
        bewijs.amountCenten !== centen || bewijs.currency !== 'EUR' || !evidenceId || !ledgerRef) {
      return { status: 409, code: 'PAYMENT_EVIDENCE_INVALID',
        error: 'Het betaalbewijs bevestigt niet exact deze bundel, betaler en prijs.' };
    }

    const gebruikt = bewijsBak(), vinger = [verwacht.payerRef, b.id, centen, 'EUR'].join('|');
    if (gebruikt[evidenceId]) {
      if (gebruikt[evidenceId].vinger !== vinger) return { status: 409,
        code: 'PAYMENT_EVIDENCE_REUSE', error: 'Dit betaalbewijs is al aan een andere toekenning gebonden.' };
      const bestaand = rijVan(houder, pas);
      return { status: 200, ok: true, replay: true, bundel: b.naam, centen,
        rest: restVan(bestaand), paymentEvidenceId: evidenceId };
    }

    const r = rijVan(houder, pas);
    r.bijgekocht += b.credits;
    r.bundels.unshift({ bundel: b.id, credits: b.credits, centen, automatisch: false,
      paymentEvidenceId: evidenceId, ledgerRef, at: tijd() });
    gebruikt[evidenceId] = { vinger, houder: verwacht.payerRef, bundel: b.id, centen, ledgerRef, at: tijd() };
    save();
    return { status: 200, ok: true, replay: false, bundel: b.naam, centen,
      rest: restVan(r), paymentEvidenceId: evidenceId };
  };
};
