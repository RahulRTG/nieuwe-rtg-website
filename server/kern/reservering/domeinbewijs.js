/* Alleen het hospitalitydomein kan bewijzen dat een reserveringsaanvraag
   werkelijk duurzaam bestaat. Het opaque bewijs bindt de oorspronkelijke
   aanvraag aan het Trust-subject; de centrale ledger ontvangt uitsluitend
   digests. */
'use strict';

const { maakOwnerBoundary } = require('../bewijsvlak/v3-owner-proof');
const { hash } = require('../bewijsvlak/canon');

function fout(code, message) {
  const error = new Error('hospitality-domainbewijs: ' + message);
  error.code = code;
  return error;
}

module.exports = function maakHospitalityDomeinBewijs(opties) {
  const o = opties || {}, boundary = maakOwnerBoundary('hospitality-domain');
  const vind = typeof o.vindReservering === 'function' ? o.vindReservering : () => null;

  function commitment(reservationRef, reservation) {
    const r = reservation || {}, opgeslagen = r.id && vind(String(r.id));
    if (!opgeslagen)
      throw fout('HOSPITALITY_DOMAIN_SOURCE_REQUIRED', 'de aanvraag komt niet uit de actieve domeinopslag');
    const velden = ['id', 'supplierCode', 'at', 'datum', 'tijd', 'personen'];
    if (velden.some(naam => String(opgeslagen[naam]) !== String(r[naam])))
      throw fout('HOSPITALITY_DOMAIN_SOURCE_MISMATCH', 'de aanvraag wijkt af van de actieve domeinopslag');
    if (!opgeslagen.id || !opgeslagen.supplierCode || !opgeslagen.at || !opgeslagen.datum ||
      !opgeslagen.tijd || !Number.isInteger(opgeslagen.personen))
      throw fout('HOSPITALITY_DOMAIN_SOURCE_INVALID', 'de duurzame aanvraag is onvolledig');
    const subjectRef = { domain: 'hospitality', type: 'reservation', id: String(reservationRef || '') };
    if (!subjectRef.id) throw fout('HOSPITALITY_DOMAIN_SUBJECT_REQUIRED', 'bewijsreferentie ontbreekt');
    const value = Object.freeze({ providerReservationRef: String(opgeslagen.id),
      supplierRef: String(opgeslagen.supplierCode), date: String(opgeslagen.datum),
      time: String(opgeslagen.tijd), people: Number(opgeslagen.personen), requestedAt: String(opgeslagen.at) });
    const eventRef = ['reservation-request-v1', opgeslagen.id, opgeslagen.supplierCode, opgeslagen.at].join(':');
    const assertion = Object.freeze({ subjectRef, factType: 'external.commitment.recorded',
      providerReservationRef: String(opgeslagen.id), provider: String(opgeslagen.supplierCode).toLowerCase(),
      state: 'REQUEST_PERSISTED', requestedAt: String(opgeslagen.at), valueDigest: hash(value) });
    boundary.mark(opgeslagen, { purpose: 'external-domain', factType: 'external.commitment.recorded',
      eventRef, subjectRef, assertion, retainedFrom: opgeslagen.at });
    return Object.freeze({ provider: assertion.provider, value, assertion, eventRef,
      proof: boundary.issue(opgeslagen) });
  }

  return Object.freeze({ commitment, verify: boundary.verify });
};
