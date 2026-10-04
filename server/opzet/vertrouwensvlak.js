'use strict';
/* Opzet: de hospitality-issuer en het Trust & Evidence Plane.

   Dit is een stuk composition root dat uit server/server.js is gehaald, omdat
   dat bestand al ver over de omvanggrens staat en alleen mag krimpen. De
   actieve hospitality-issuer blijft hier opgesloten: domeinmodules krijgen
   alleen de drie functies die hieronder worden teruggegeven, nooit de issuer
   zelf (test/hospitality-providerbewijs.test.js bewaakt dat).

   Het plane start additief in schaduwstand. De opslag bevat uitsluitend
   ketenbewijs en digests; domeinobjecten blijven bij hun eigenaar. Het wordt
   pas geconfigureerd als server.js `trustPlane()` aanroept, op dezelfde plek
   in de opstartvolgorde als voorheen. */
module.exports = function maakVertrouwensvlak({ db, save, betaal }) {
  const hospitalityProviderBewijs = require('../kern/reservering/providerbewijs')();
  const hospitalityDomainBewijs = require('../kern/reservering/domeinbewijs')({
    vindReservering: id => (db.data.reserveringen || []).find(r => r.id === id)
  });

  function verifieerTrustProviderBewijs(token, expected) {
    let eersteFout = null;
    for (const verify of [betaal.verifieerProviderBewijs, hospitalityProviderBewijs.verify]) {
      try { return verify(token, expected); }
      catch (error) {
        if (error && error.code === 'INGRESS_PROOF_REQUIRED') throw error;
        if (!eersteFout) eersteFout = error;
      }
    }
    throw eersteFout || Object.assign(new Error('Onbekend providerbewijs.'), { code: 'INGRESS_PROOF_INVALID' });
  }

  function trustPlane() {
    return require('../kern/bewijsvlak/runtime').configure({
      db, save, mode: 'shadow', issuer: 'rtg:platform',
      verifyProviderProof: verifieerTrustProviderBewijs,
      verifyExternalOwnerProof: hospitalityDomainBewijs.verify
    });
  }

  function mislukt(bericht, uitslag, code) {
    const error = new Error(bericht);
    error.code = uitslag && uitslag.code || code;
    return error;
  }

  function bewijsHospitalityBesluit(req, reservationRef, reservation) {
    const domain = hospitalityDomainBewijs.commitment(reservationRef, reservation);
    const trustExternal = require('../kern/bewijsvlak/v3-external-hook');
    const commitment = trustExternal.reservation('commitment', { reservationRef,
      provider: domain.provider, ownerProof: domain.proof, ownerAssertion: domain.assertion,
      ownerEventRef: domain.eventRef, at: reservation.at, value: domain.value });
    if (!commitment || !commitment.evidenceId)
      throw mislukt('Hospitality-aanvraag kon niet als domeinbewijs worden vastgelegd.', commitment,
        'HOSPITALITY_COMMITMENT_EVIDENCE_FAILED');
    const receipt = hospitalityProviderBewijs.bevestiging(req, reservationRef, reservation);
    const confirmed = trustExternal.reservation('confirmed', { reservationRef,
      provider: receipt.provider, providerProof: receipt.proof, providerAssertion: receipt.assertion,
      at: reservation.beslotenAt, value: { providerReservationRef: reservation.id,
        status: 'confirmed', decisionRef: reservation.besluitAudit.decisionRef } });
    if (!confirmed || !confirmed.evidenceId)
      throw mislukt('Hospitality-bevestiging kon niet als bewijs worden vastgelegd.', confirmed,
        'HOSPITALITY_EVIDENCE_FAILED');
    const refs = [commitment.evidenceId, confirmed.evidenceId].filter(Boolean);
    const claim = trustExternal.assess(reservationRef, refs, reservation.beslotenAt);
    if (!claim || !claim.claimId)
      throw mislukt('Hospitality-bevestiging kon niet worden beoordeeld.', claim, 'HOSPITALITY_ASSESSMENT_FAILED');
    return Object.freeze({ confirmed, claim });
  }

  return { markeerHospitalityRequest: hospitalityProviderBewijs.authenticeer, trustPlane, bewijsHospitalityBesluit };
};
