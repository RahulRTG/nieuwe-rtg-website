/* De correlatierug: een interne keten van voordeur tot event, worker en provider.
   Een chain-id is alleen samenhang. Hij verleent nooit toegang of bevoegdheid. */
'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');
const { bevries } = require('./canon');

const opslag = new AsyncLocalStorage();
const nieuw = (p) => p + '_' + (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));

function maak(invoer) {
  const i = invoer || {};
  return bevries({
    version: 1,
    chainId: i.chainId || nieuw('chain'),
    stepId: i.stepId || nieuw('step'),
    causedBy: i.causedBy || null,
    requestId: i.requestId || null,
    phase: i.phase || 'observe',
    purpose: i.purpose || null,
    actorRef: i.actorRef || null,
    tenantRef: i.tenantRef || null,
    economicPrincipalRef: i.economicPrincipalRef || null,
    classification: i.classification || 'onbekend'
  });
}

function huidige() { return opslag.getStore() || null; }
function inContext(context, fn) { return opslag.run(maak(context), fn); }

function kind(phase, extra) {
  const ouder = huidige();
  return maak(Object.assign({}, ouder || {}, extra || {}, {
    chainId: (extra && extra.chainId) || (ouder && ouder.chainId),
    stepId: (extra && extra.stepId) || nieuw('step'),
    causedBy: (extra && extra.causedBy) || (ouder && ouder.stepId) || null,
    phase: phase || (extra && extra.phase) || 'observe'
  }));
}

function uitEvent(envelop) {
  const ouder = huidige();
  return maak(Object.assign({}, ouder || {}, {
    chainId: (envelop && envelop.correlatie) || (ouder && ouder.chainId),
    stepId: (envelop && envelop.id) || nieuw('step'),
    causedBy: (envelop && envelop.oorzaak) || null,
    actorRef: (envelop && envelop.actor) || (ouder && ouder.actorRef) || null,
    classification: (envelop && envelop.classificatie) || 'onbekend',
    phase: 'event'
  }));
}

function middleware() {
  return (req, res, next) => {
    /* Een publieke header wordt niet als keten vertrouwd. Providerbruggen mogen
       na handtekeningcontrole expliciet inContext() gebruiken. */
    const context = maak({ requestId: req.id || null, phase: 'request' });
    req.trustContext = context;
    res.set('X-RTG-Correlation', context.chainId);
    opslag.run(context, next);
  };
}

/* Getekende carrier voor een vertrouwde servicehop. Alleen correlation en
   causation reizen mee; actor, tenant en bevoegdheid moeten aan de overkant
   opnieuw uit eigen authenticatie volgen. */
function carrier(secret, tijd) {
  const c = huidige();
  if (!c || !secret) throw new Error('bewijsvlak context: context of carrier-secret ontbreekt');
  const sentAt = String(tijd == null ? Date.now() : tijd);
  const inhoud = [c.chainId, c.stepId, sentAt].join('\n');
  const signature = crypto.createHmac('sha256', String(secret)).update(inhoud).digest('hex');
  return Object.freeze({ 'x-rtg-chain': c.chainId, 'x-rtg-step': c.stepId,
    'x-rtg-sent-at': sentAt, 'x-rtg-signature': signature });
}

function verifieerCarrier(headers, secret, opties) {
  const h = headers || {}, chainId = String(h['x-rtg-chain'] || ''), stepId = String(h['x-rtg-step'] || '');
  const sentAt = String(h['x-rtg-sent-at'] || ''), ontvangen = String(h['x-rtg-signature'] || '');
  if (!secret || !/^chain_[a-f0-9-]{16,80}$/i.test(chainId) || !/^step_[a-f0-9-]{16,80}$/i.test(stepId) ||
      !/^\d{10,16}$/.test(sentAt) || !/^[a-f0-9]{64}$/i.test(ontvangen)) return null;
  const nu = opties && opties.nu != null ? Number(opties.nu) : Date.now();
  const maxAgeMs = (opties && opties.maxAgeMs) || 300000;
  if (!Number.isFinite(nu) || Math.abs(nu - Number(sentAt)) > maxAgeMs) return null;
  const verwacht = crypto.createHmac('sha256', String(secret))
    .update([chainId, stepId, sentAt].join('\n')).digest();
  const gekregen = Buffer.from(ontvangen, 'hex');
  if (gekregen.length !== verwacht.length || !crypto.timingSafeEqual(gekregen, verwacht)) return null;
  return maak({ chainId, causedBy: stepId, phase: 'service-hop' });
}

module.exports = { maak, huidige, inContext, kind, uitEvent, middleware, carrier, verifieerCarrier };
