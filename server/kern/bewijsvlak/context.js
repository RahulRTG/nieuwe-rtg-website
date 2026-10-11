/* De correlatierug: een interne keten van voordeur tot event, worker en provider.
   Een chain-id is alleen samenhang. Hij verleent nooit toegang of bevoegdheid.

   EEN BRON, EN DAT IS HET VERZOEKFRAME (besluit van de eigenaar, 6 oktober
   2026). Deze module maakte per verzoek een eigen willekeurige chain-id, naast
   de correlatie van opzet/verzoekframe.js. Daardoor wisselde de keten binnen
   een verzoek van naam: de verzoekwortel heette chain_<willekeur>, en zodra er
   een gebeurtenis liep zette uitEvent() hem op de correlatie van de envelop --
   die van het frame komt. Twee waarheden over dezelfde keten.

   Nu wordt de keten AFGELEID uit de correlatie (ketenVan): het frame opent de
   verzoekwortel (opzet/verzoekframe.js), en deze module maakt er geen meer.
   Een correlatie maakt de server altijd zelf (lib/correlatie.js), dus een kop
   van buiten kan de keten nog steeds niet kiezen. Buiten een verzoek (een
   expliciete servicehop met verifieerCarrier, een toets) is er geen frame, en
   dan is een met inContext geopende keten het enige wat er is. */
'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');
const { bevries } = require('./canon');

const opslag = new AsyncLocalStorage();
const gemaakt = new WeakSet();
const nieuw = (p) => p + '_' + (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));

function maak(invoer) {
  const i = invoer || {};
  const c = bevries({
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
  gemaakt.add(c);
  return c;
}

/* De ketennaam van een correlatie. Een al gevormde chain-id blijft wie hij is. */
function ketenVan(correlatie) {
  if (correlatie == null || correlatie === '') return null;
  const c = String(correlatie);
  return c.startsWith('chain_') ? c : 'chain_' + c;
}

function huidige() { return opslag.getStore() || null; }
/* Een context die maak() al heeft gemaakt, draait als zichzelf: het verzoekframe
   zet na de body-lezer DEZELFDE wortel terug en geen kopie met een nieuwe stap. */
function inContext(context, fn) {
  const c = context && gemaakt.has(context) ? context : maak(context);
  return opslag.run(c, fn);
}

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
    chainId: (envelop && ketenVan(envelop.correlatie)) || (ouder && ouder.chainId),
    stepId: (envelop && envelop.id) || nieuw('step'),
    causedBy: (envelop && envelop.oorzaak) || null,
    actorRef: (envelop && envelop.actor) || (ouder && ouder.actorRef) || null,
    classification: (envelop && envelop.classificatie) || 'onbekend',
    phase: 'event'
  }));
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

module.exports = { maak, huidige, inContext, kind, uitEvent, ketenVan, carrier, verifieerCarrier };
