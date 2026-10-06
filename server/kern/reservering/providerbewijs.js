/* Een tafelbevestiging komt vandaag niet van TheFork/OpenTable, maar van een
   medewerker van de zaak achter supplierAuth. Deze boundary bindt precies die
   geauthenticeerde request eenmalig aan precies het besluit dat hij nam.

   De actieve instantie wordt uitsluitend in server.js samengesteld. Een losse
   providernaam of een nagemaakt reserveringsobject kan daardoor geen V3-feit
   slaan. Het bewijs bevat na consumptie alleen digests, nooit het bearer-token
   of de ruwe request. */
'use strict';

const { maakProviderBoundary } = require('../bewijsvlak/v3-ingress');
const { hash: canonicalHash } = require('../bewijsvlak/canon');
const crypto = require('node:crypto');

const digest = waarde => crypto.createHash('sha256').update(String(waarde)).digest('hex');

function fout(code, message) {
  const error = new Error('hospitality-ingress: ' + message);
  error.code = code;
  return error;
}

module.exports = function maakHospitalityProviderBewijs() {
  const boundary = maakProviderBoundary(), requests = new WeakMap();

  function authenticeer(req, supplier, actor) {
    const actorRef = actor && (actor.staffId || actor.lidKey || actor.name);
    if (!req || typeof req !== 'object' || !supplier || !supplier.code || !actorRef || !req.id)
      throw fout('HOSPITALITY_AUTHORITY_INVALID', 'geverifieerde zaakrequest ontbreekt');
    requests.set(req, Object.freeze({ provider: String(supplier.code).toLowerCase(),
      supplierCode: String(supplier.code), actor: String(actorRef), requestRef: String(req.id) }));
  }

  function bevestiging(req, reservationRef, reservation) {
    const authority = req && requests.get(req);
    if (!authority) throw fout('HOSPITALITY_AUTHORITY_REQUIRED',
      'alleen een request dat supplierAuth volledig passeerde mag bevestigen');
    requests.delete(req);
    const r = reservation || {}, provider = String(r.supplierCode || '').toLowerCase();
    const audit = r.besluitAudit || {};
    if (!provider || provider !== authority.provider || r.status !== 'bevestigd' || !r.id)
      throw fout('HOSPITALITY_ASSERTION_INVALID', 'zaak, reservering of bevestigde status klopt niet');
    const decisionRef = ['supplier-decision-v1', provider, r.id, 'bevestigd'].join(':');
    const expectedRequest = digest(['hospitality-request-v1', authority.supplierCode, r.id,
      authority.requestRef].join(':'));
    const expectedActor = digest(['hospitality-actor-v1', authority.supplierCode, authority.actor].join(':'));
    if (audit.version !== 1 || audit.decisionRef !== decisionRef ||
      audit.requestRefDigest !== expectedRequest || audit.actorRefDigest !== expectedActor ||
      audit.supplierCode !== authority.supplierCode || audit.decidedAt !== r.beslotenAt)
      throw fout('HOSPITALITY_AUDIT_MISMATCH',
        'het duurzame zaakbesluit hoort niet bij deze geauthenticeerde request');
    const assertion = Object.freeze({ provider, reservationRef: String(reservationRef || ''),
      providerReservationRef: String(r.id), status: 'confirmed', decisionRef });
    if (!assertion.reservationRef)
      throw fout('HOSPITALITY_ASSERTION_INVALID', 'bewijsreferentie ontbreekt');
    const source = {};
    const retention = { contractRef: { id: 'hospitality.provider-source', version: 1 },
      locatorDigest: canonicalHash({ schemaVersion: 1, owner: 'hospitality',
        type: 'reservation-decision', provider, decisionRef }),
      retentionReceiptDigest: canonicalHash({ schemaVersion: 1, audit, assertion }),
      retainedFrom: r.beslotenAt, retainedUntil: null, verifiedAt: r.beslotenAt,
      available: true };
    boundary.mark(source, { provider, purpose: 'external', assertion,
      eventRef: [decisionRef, audit.requestRefDigest, audit.actorRefDigest, r.beslotenAt].join(':'),
      verifier: 'rtg-supplier-auth', verifiedAt: r.beslotenAt, retention });
    return Object.freeze({ provider, assertion, proof: boundary.issue(source) });
  }

  return Object.freeze({ authenticeer, bevestiging, verify: boundary.verify });
};
