/* CONNECTION OS -- doelgebonden toestemming als runtime-toestand.

   Dit is bewust geen nieuwe opslaglaag. Productkernen bewaren hun eigen ledger
   bij het object waarop toestemming betrekking heeft. Dit bestand levert alleen
   de gedeelde betekenis: een toestemming is specifiek, versieerbaar, intrekbaar
   en eventueel tijdelijk. Ontbrekende of ongeldige toestemming is altijd dicht. */
'use strict';

const trustAuthority = require('./bewijsvlak/v3-authority-hook');

const STATES = Object.freeze({
  ABSENT: 'ABSENT',
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED'
});

const MUTUAL_STATES = Object.freeze({
  NONE: 'NONE',
  A_GRANTED: 'A_GRANTED',
  B_GRANTED: 'B_GRANTED',
  MUTUAL: 'MUTUAL',
  REVOKED: 'REVOKED'
});

function consentNormaliseer(input) {
  const b = input && typeof input === 'object' ? input : {};
  const uit = {
    actor: String(b.actor || '').trim(),
    counterpart: String(b.counterpart || '').trim(),
    purpose: String(b.purpose || '').trim(),
    capability: String(b.capability || '').trim(),
    scope: String(b.scope || '').trim(),
    version: Number.isInteger(b.version) && b.version > 0 ? b.version : 1
  };
  if (!uit.actor || !uit.counterpart || !uit.purpose || !uit.capability || !uit.scope) {
    throw new Error('Toestemming vereist actor, counterpart, purpose, capability en scope.');
  }
  return uit;
}

function consentSleutel(input) {
  const b = consentNormaliseer(input);
  return [b.actor, b.counterpart, b.purpose, b.capability, b.scope, 'v' + b.version]
    .map(x => encodeURIComponent(x)).join('|');
}

function record(ledger, input) {
  if (!ledger || typeof ledger !== 'object') return null;
  return ledger[consentSleutel(input)] || null;
}

function toestand(ledger, input, now) {
  const r = record(ledger, input);
  if (!r) return STATES.ABSENT;
  if (r.state !== STATES.ACTIVE) return Object.values(STATES).includes(r.state) ? r.state : STATES.ABSENT;
  const tijd = Date.parse(now || new Date().toISOString());
  const einde = r.expiresAt ? Date.parse(r.expiresAt) : NaN;
  return Number.isFinite(einde) && Number.isFinite(tijd) && einde <= tijd ? STATES.EXPIRED : STATES.ACTIVE;
}

function consentGebeurtenis(ledger, input, state, opties) {
  if (!ledger || typeof ledger !== 'object') throw new Error('Een toestemmingsledger is vereist.');
  const b = consentNormaliseer(input);
  const id = consentSleutel(b);
  const oud = ledger[id] || {};
  const at = String((opties && opties.at) || new Date().toISOString());
  const events = Array.isArray(oud.events) ? oud.events.slice() : [];
  const event = { state, at, revision: Number(oud.revision || 0) + 1 };
  events.push(event);
  ledger[id] = {
    ...b,
    state,
    grantedAt: state === STATES.ACTIVE ? at : (oud.grantedAt || null),
    revokedAt: state === STATES.REVOKED ? at : null,
    expiresAt: state === STATES.ACTIVE && opties && opties.expiresAt ? String(opties.expiresAt) : null,
    revision: event.revision,
    events
  };
  trustAuthority.record(b, state, at);
  return ledger[id];
}

function grant(ledger, input, opties) { return consentGebeurtenis(ledger, input, STATES.ACTIVE, opties); }
function revoke(ledger, input, opties) { return consentGebeurtenis(ledger, input, STATES.REVOKED, opties); }
function expire(ledger, input, opties) { return consentGebeurtenis(ledger, input, STATES.EXPIRED, opties); }
function consentActief(ledger, input, now) { return toestand(ledger, input, now) === STATES.ACTIVE; }

function wederzijds(ledger, a, b, now) {
  const sa = toestand(ledger, a, now);
  const sb = toestand(ledger, b, now);
  if (sa === STATES.REVOKED || sb === STATES.REVOKED) return MUTUAL_STATES.REVOKED;
  const aa = sa === STATES.ACTIVE;
  const bb = sb === STATES.ACTIVE;
  if (aa && bb) return MUTUAL_STATES.MUTUAL;
  if (aa) return MUTUAL_STATES.A_GRANTED;
  if (bb) return MUTUAL_STATES.B_GRANTED;
  return MUTUAL_STATES.NONE;
}

module.exports = { STATES, MUTUAL_STATES, normaliseer: consentNormaliseer, sleutel: consentSleutel,
  record, toestand, grant, revoke, expire, actief: consentActief, wederzijds };
