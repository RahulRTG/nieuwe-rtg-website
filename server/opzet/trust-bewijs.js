'use strict';

/* Compositiegrens voor Trust & Evidence. server.js levert alleen de bestaande
   domeinlezers; providerbewijs, runtimeconfiguratie en hospitality-assessment
   blijven hier bij elkaar en lekken niet de algemene servercompositie in. */
module.exports = function maakTrustBewijs({ db, save, betaal, vindReservering }) {
  const provider = require('../kern/reservering/providerbewijs')();
  const domain = require('../kern/reservering/domeinbewijs')({ vindReservering });
  const { maakTrustEvidenceStateFor } = require('../db/trust-evidence-state');

  function verifieerProviderBewijs(token, expected) {
    let eersteFout = null;
    for (const verify of [betaal.verifieerProviderBewijs, provider.verify]) {
      try { return verify(token, expected); }
      catch (error) {
        if (error && error.code === 'INGRESS_PROOF_REQUIRED') throw error;
        if (!eersteFout) eersteFout = error;
      }
    }
    throw eersteFout || Object.assign(new Error('Onbekend providerbewijs.'),
      { code: 'INGRESS_PROOF_INVALID' });
  }

  const trustPlane = require('../kern/bewijsvlak/runtime').configure({
    save, mode: 'shadow', issuer: 'rtg:platform',
    stateFor: maakTrustEvidenceStateFor(db),
    verifyProviderProof: verifieerProviderBewijs,
    verifyExternalOwnerProof: domain.verify
  });

  function bewijsHospitalityBesluit(req, reservationRef, reservation) {
    const extern = require('../kern/bewijsvlak/v3-external-hook');
    const commitmentSource = domain.commitment(reservationRef, reservation);
    const commitment = extern.reservation('commitment', { reservationRef,
      provider: commitmentSource.provider, ownerProof: commitmentSource.proof,
      ownerAssertion: commitmentSource.assertion, ownerEventRef: commitmentSource.eventRef,
      at: reservation.at, value: commitmentSource.value });
    if (!commitment || !commitment.evidenceId) {
      const error = new Error('Hospitality-aanvraag kon niet als domeinbewijs worden vastgelegd.');
      error.code = commitment && commitment.code || 'HOSPITALITY_COMMITMENT_EVIDENCE_FAILED';
      throw error;
    }
    const receipt = provider.bevestiging(req, reservationRef, reservation);
    const confirmed = extern.reservation('confirmed', { reservationRef,
      provider: receipt.provider, providerProof: receipt.proof,
      providerAssertion: receipt.assertion, at: reservation.beslotenAt,
      value: { providerReservationRef: reservation.id, status: 'confirmed',
        decisionRef: reservation.besluitAudit.decisionRef } });
    if (!confirmed || !confirmed.evidenceId) {
      const error = new Error('Hospitality-bevestiging kon niet als bewijs worden vastgelegd.');
      error.code = confirmed && confirmed.code || 'HOSPITALITY_EVIDENCE_FAILED';
      throw error;
    }
    const claim = extern.assess(reservationRef,
      [commitment.evidenceId, confirmed.evidenceId], reservation.beslotenAt);
    if (!claim || !claim.claimId) {
      const error = new Error('Hospitality-bevestiging kon niet worden beoordeeld.');
      error.code = claim && claim.code || 'HOSPITALITY_ASSESSMENT_FAILED';
      throw error;
    }
    return Object.freeze({ confirmed, claim });
  }

  return Object.freeze({ trustPlane, bewijsHospitalityBesluit,
    markeerHospitalityRequest: provider.authenticeer });
};
