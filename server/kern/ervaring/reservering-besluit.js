/* Een zaakbesluit is de provider-ingress voor een tafelreservering. De
   domeinbeslissing wordt eerst duurzaam opgeslagen; pas daarna mag het
   bewijsvlak er een providerbevestiging van maken. Bij bewijsuitval blijft de
   reservering domeinwaarheid, maar de Connection-projectie expliciet UNKNOWN.

   Dit bestand bewaart daarnaast uitsluitend niet-geheime auditverwijzingen.
   Bearers, ruwe requests en personeelsidentiteiten horen nooit in de
   reservering of het bewijsvlak. */
'use strict';

function digest(crypto, waarde) {
  if (!crypto || typeof crypto.createHash !== 'function') {
    const error = new Error('Cryptografische auditfunctie ontbreekt.');
    error.code = 'HOSPITALITY_AUDIT_CRYPTO_REQUIRED';
    throw error;
  }
  return crypto.createHash('sha256').update(String(waarde)).digest('hex');
}

function herstel(object, naam, waarde) {
  if (waarde === undefined) delete object[naam];
  else object[naam] = waarde;
}

module.exports = (ctx) => {
  const { db, save, crypto, notify, sseToCustomer, nu, observe, metricTimer, finish,
    bewijsHospitalityBesluit } = ctx;

  return function beslisReservering(supplier, rid, action, authority) {
    const r = (db.data.reserveringen || []).find(x => x.id === rid && x.supplierCode === supplier.code);
    if (!r) return { status: 404, error: 'Reservering niet gevonden.' };
    if (r.status !== 'aangevraagd') return { status: 409, error: 'Deze reservering is al ' + r.status + '.' };
    const decisionTimer = metricTimer({ capability: 'reservation.request', boundary: 'supplier:' + supplier.code });
    const nieuweStatus = action === 'bevestig' ? 'bevestigd' : 'geweigerd', beslotenAt = nu();
    const matches = db.data.vonk && Array.isArray(db.data.vonk.matches) ? db.data.vonk.matches : [];
    const vonkMatch = matches.find(m => m.reserveringId === r.id);
    const actor = authority && authority.actor || {};
    const request = authority && authority.request;
    const actorRef = actor.staffId || actor.lidKey || actor.name;
    const requestRef = request && request.id;
    if (!actorRef || !requestRef) {
      const error = new Error('Het geauthenticeerde reserveringsbesluit mist een auditverwijzing.');
      error.code = 'HOSPITALITY_DECISION_AUTHORITY_REQUIRED';
      throw error;
    }
    const besluitRef = ['supplier-decision-v1', String(supplier.code).toLowerCase(), r.id, nieuweStatus].join(':');
    const besluitAudit = {
      version: 1,
      decisionRef: besluitRef,
      requestRefDigest: digest(crypto, ['hospitality-request-v1', supplier.code, r.id, requestRef].join(':')),
      actorRefDigest: digest(crypto, ['hospitality-actor-v1', supplier.code, actorRef].join(':')),
      supplierCode: supplier.code,
      decidedAt: beslotenAt
    };
    const vorig = { status: r.status, beslotenAt: r.beslotenAt, besluitAudit: r.besluitAudit,
      matchStatus: vonkMatch && vonkMatch.status,
      reserveringStatus: vonkMatch && vonkMatch.reserveringStatus,
      reservationEvidence: vonkMatch && vonkMatch.reservationEvidence };
    r.status = nieuweStatus;
    r.beslotenAt = beslotenAt;
    r.besluitAudit = besluitAudit;
    if (vonkMatch) {
      vonkMatch.reserveringStatus = nieuweStatus;
      /* Een duurzame zaakbeslissing is nog geen voor Connection vrijgegeven
         bevestiging. Tot de provider-ingress én claim groen zijn, blijft de
         match fail-closed in de onbekende toestand. */
      vonkMatch.status = nieuweStatus === 'bevestigd' ? 'reservering-onbekend' : 'reservering-geweigerd';
      vonkMatch.reservationEvidence = nieuweStatus === 'bevestigd'
        ? { state: 'UNKNOWN', finality: 'UNKNOWN',
          missing: ['provider-confirmation', 'operational-outcome'] }
        : { state: 'REJECTED', finality: 'SOURCE_ATTESTED',
          missing: ['provider-confirmation', 'operational-outcome'] };
    }
    try { save(); }
    catch (error) {
      r.status = vorig.status;
      herstel(r, 'beslotenAt', vorig.beslotenAt);
      herstel(r, 'besluitAudit', vorig.besluitAudit);
      if (vonkMatch) {
        vonkMatch.status = vorig.matchStatus;
        herstel(vonkMatch, 'reserveringStatus', vorig.reserveringStatus);
        herstel(vonkMatch, 'reservationEvidence', vorig.reservationEvidence);
      }
      finish(decisionTimer, { outcome: 'FAILED', domainOutcome: 'DECISION_NOT_PERSISTED',
        errorClass: error.code || 'STORAGE_EXCEPTION' });
      throw error;
    }

    let bewijsFout = null;
    if (nieuweStatus === 'bevestigd' && vonkMatch && typeof bewijsHospitalityBesluit === 'function') {
      const trust = vonkMatch.reservationTrust || {};
      const zonderBewijs = vonkMatch.reservationEvidence;
      const statusZonderBewijs = vonkMatch.status;
      try {
        const bewijs = bewijsHospitalityBesluit(request, trust.reservationRef,
          { ...r }, trust.commitmentEvidenceId);
        const claim = bewijs && bewijs.claim;
        if (claim && claim.claimId) {
          vonkMatch.reservationEvidence = { state: 'CONFIRMED', finality: claim.finality,
            missing: claim.completeness.missing.map(x => x.requirementId) };
          vonkMatch.status = 'bevestigd';
          try { save(); } catch (error) {
            vonkMatch.reservationEvidence = zonderBewijs;
            vonkMatch.status = statusZonderBewijs;
            bewijsFout = error;
          }
        } else bewijsFout = Object.assign(new Error('Bevestigingsbewijs ontbreekt.'),
          { code: 'HOSPITALITY_EVIDENCE_MISSING' });
      } catch (error) { bewijsFout = error; }
    } else if (nieuweStatus === 'bevestigd' && vonkMatch) {
      bewijsFout = Object.assign(new Error('Hospitality-bewijsadapter ontbreekt.'),
        { code: 'HOSPITALITY_EVIDENCE_ADAPTER_MISSING' });
    }
    finish(decisionTimer, { outcome: 'SUCCEEDED', domainOutcome: r.status === 'bevestigd' ? 'CONFIRMED' : 'REJECTED',
      measurementKey: 'reservation-decision:' + r.id + ':' + r.status });
    observe({ capability: 'reservation.request', boundary: 'supplier:' + supplier.code,
      subjectRef: { domain: 'hospitality', type: 'reservation', id: r.id },
      predicate: r.status === 'bevestigd' ? 'reservation.confirmed' : 'reservation.rejected',
      value: { status: r.status }, evidence: { status: r.status, supplierRef: supplier.code,
        decisionRef: besluitRef },
      policy: { id: 'hospitality-policy', version: 1, decision: 'SHADOW' } });
    const vrijgegeven = r.status === 'bevestigd' && (!vonkMatch ||
      (vonkMatch.status === 'bevestigd' && vonkMatch.reservationEvidence &&
        vonkMatch.reservationEvidence.state === 'CONFIRMED' &&
        !(vonkMatch.reservationEvidence.missing || []).includes('provider-confirmation')));
    const tekst = vrijgegeven
      ? 'Uw tafel bij ' + supplier.name + ' op ' + r.datum + ' om ' + r.tijd + ' (' + r.personen + 'p) is bevestigd.'
      : r.status === 'bevestigd'
        ? 'De zaak heeft uw reserveringsbesluit ontvangen. RTG controleert de bevestiging; de tafel wordt nog niet als geboekt getoond.'
      : supplier.name + ' kan uw reservering voor ' + r.datum + ' ' + r.tijd + ' helaas niet plaatsen.';
    notify(r.customerKey, { icon: 'table', title: supplier.name, body: tekst, scope: 'orders' });
    if (vonkMatch) for (const wie of [vonkMatch.a, vonkMatch.b]) {
      try { notify(wie, { icon: 'bar', title: supplier.name,
        body: vrijgegeven
          ? 'De zaak heeft jullie tafel bevestigd voor ' + r.datum + ' om ' + r.tijd + '.'
          : nieuweStatus === 'bevestigd'
            ? 'Het zaakbesluit is ontvangen. RTG controleert de bevestiging; dit is nog geen afspraak.'
          : 'De zaak kon jullie tafel niet bevestigen. Vonk houdt dit zichtbaar voor opvolging.' }); } catch (error) {}
      try { sseToCustomer(wie, 'vonk', { kind: 'reservation-decision', id: vonkMatch.id }); } catch (error) {}
    }
    sseToCustomer(r.customerKey, 'sync', { scope: 'reserveringen' });
    return { ok: true, reservering: r, evidence: vonkMatch ? vonkMatch.reservationEvidence : undefined,
      evidenceDebt: bewijsFout ? { state: 'UNKNOWN', code: bewijsFout.code || 'HOSPITALITY_EVIDENCE_FAILED',
        incidentId: bewijsFout.incidentId || null, decisionRef: besluitRef } : undefined };
  };
};
