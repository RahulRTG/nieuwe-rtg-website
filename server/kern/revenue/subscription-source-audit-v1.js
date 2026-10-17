/* RTG REVENUE SUBSCRIPTION SOURCE AUDIT V1.

   De abonnementsladder, prijslijst, capability-profielen, runtime-herkenning en
   aanmeldingsstroom zijn bestaande bronnen met ieder een eigen taak. Deze
   audit voegt ze niet samen en verleent geen recht. Hij projecteert uitsluitend
   waar de bronnen overeenkomen en waar een trede half is uitgerold.

   De live prijslijst en aanmeldingsdefinities worden expliciet aangeleverd.
   Daardoor hoeft deze module geen geldregie of aanmeldingskern te initialiseren
   en kan een ontbrekende bron nooit stil worden vervangen door een schatting. */
'use strict';

const ladder = require('../pasladder');
const capaciteiten = require('../commercie/capaciteiten');
const runtimePassen = require('../passen');
const diepVast = require('./immutable');

const AUDIT_ID = 'rtg.revenue.subscription-source-audit';
const AUDIT_VERSION = '1.0.0';
const STATUS = Object.freeze({
  HEALTHY: 'HEALTHY',
  SOURCE_MISMATCH: 'SOURCE_MISMATCH',
  UNKNOWN_SOURCE: 'UNKNOWN_SOURCE'
});
const BRONNEN = Object.freeze({
  ladder: 'server/kern/pasladder.js#treden',
  pricing: 'server/kern/geldregie.js#geldPasprijzen',
  capabilities: 'server/kern/commercie/capaciteiten.js#PROFIEL',
  runtime: 'server/kern/passen.js#PASSEN',
  applications: 'server/kern/aanmeldingen.js#PASSEN'
});

function eigen(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
function vlak(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  const p = Object.getPrototypeOf(o);
  return p === Object.prototype || p === null;
}
function tekst(v) { return typeof v === 'string' ? v.trim() : ''; }
function auditStatusVan(statussen) {
  if (statussen.includes(STATUS.SOURCE_MISMATCH)) return STATUS.SOURCE_MISMATCH;
  if (statussen.includes(STATUS.UNKNOWN_SOURCE)) return STATUS.UNKNOWN_SOURCE;
  return STATUS.HEALTHY;
}
function uniekeTeksten(lijst) {
  return [...new Set((Array.isArray(lijst) ? lijst : []).map(tekst).filter(Boolean))].sort();
}
function leesBron(bron) {
  if (typeof bron !== 'function') return { status: STATUS.UNKNOWN_SOURCE, value: null };
  try {
    const uit = bron();
    return vlak(uit) && (!eigen(uit, 'status') || uit.status === 200) ? { status: STATUS.HEALTHY, value: uit } :
      { status: STATUS.UNKNOWN_SOURCE, value: null };
  } catch (_) {
    return { status: STATUS.UNKNOWN_SOURCE, value: null };
  }
}

function prijsProjectie(trede, prijsBron) {
  const soort = trede.contractueel ? 'CONTRACT' : trede.vast ? 'FREE' : 'LIST';
  const basis = { kind: soort, currency: 'EUR', amountCenten: null,
    floorCenten: trede.bodemCenten, sourceStatus: prijsBron.status };
  if (prijsBron.status !== STATUS.HEALTHY) return basis;
  const passen = vlak(prijsBron.value.passen) ? prijsBron.value.passen : null;
  if (!passen) return { ...basis, sourceStatus: STATUS.UNKNOWN_SOURCE };
  const rij = passen[trede.id];
  if (!vlak(rij)) return { ...basis, sourceStatus: STATUS.SOURCE_MISMATCH };
  if (soort === 'CONTRACT') {
    const klopt = !eigen(rij, 'maandCenten') && Number.isSafeInteger(rij.vanafCenten) &&
      rij.vanafCenten === trede.bodemCenten;
    return { ...basis, sourceStatus: klopt ? STATUS.HEALTHY : STATUS.SOURCE_MISMATCH };
  }
  const klopt = Number.isSafeInteger(rij.maandCenten) && rij.maandCenten >= trede.bodemCenten &&
    (soort !== 'FREE' || rij.maandCenten === 0);
  return { ...basis, amountCenten: klopt ? rij.maandCenten : null,
    sourceStatus: klopt ? STATUS.HEALTHY : STATUS.SOURCE_MISMATCH };
}

function capabilityProjectie(trede, profielen) {
  if (!vlak(profielen)) return { sourceStatus: STATUS.UNKNOWN_SOURCE, capabilities: [], b2bAssignable: false };
  const bekend = eigen(profielen, trede.id) && Array.isArray(profielen[trede.id]);
  const capabilities = bekend ? uniekeTeksten(profielen[trede.id]) : [];
  const geldig = bekend && profielen[trede.id].every(c => typeof c === 'string' && eigen(capaciteiten.CAPS, c));
  return { sourceStatus: geldig ? STATUS.HEALTHY : STATUS.SOURCE_MISMATCH,
    capabilities, b2bAssignable: geldig && capabilities.includes('can_be_partner') };
}

function runtimeProjectie(trede, passen) {
  if (!Array.isArray(passen)) return { sourceStatus: STATUS.UNKNOWN_SOURCE, recognized: false };
  const recognized = passen.includes(trede.id);
  return { sourceStatus: recognized ? STATUS.HEALTHY : STATUS.SOURCE_MISMATCH, recognized };
}

function applicationProjectie(trede, definities, gratisId) {
  if (!vlak(definities)) return { sourceStatus: STATUS.UNKNOWN_SOURCE, defined: false, open: null };
  const vereist = trede.id !== gratisId;
  const definitie = definities[trede.id];
  const defined = vlak(definitie);
  const klopt = vereist ? defined : !defined;
  return { sourceStatus: klopt ? STATUS.HEALTHY : STATUS.SOURCE_MISMATCH,
    defined, open: defined && typeof definitie.open === 'boolean' ? definitie.open : null };
}

function bevindingenVan(trede) {
  const uit = [];
  if (trede.pricing.sourceStatus !== STATUS.HEALTHY)
    uit.push({ code: 'PRICE_SOURCE_' + trede.pricing.sourceStatus, source: 'pricing' });
  if (trede.capability.sourceStatus !== STATUS.HEALTHY)
    uit.push({ code: 'CAPABILITY_SOURCE_' + trede.capability.sourceStatus, source: 'capabilities' });
  if (trede.runtime.sourceStatus !== STATUS.HEALTHY)
    uit.push({ code: 'RUNTIME_SOURCE_' + trede.runtime.sourceStatus, source: 'runtime' });
  if (trede.application.sourceStatus !== STATUS.HEALTHY)
    uit.push({ code: 'APPLICATION_SOURCE_' + trede.application.sourceStatus, source: 'applications' });
  return uit;
}

function maakSubscriptionSourceAuditV1({ geldPasprijzen, applicationPasses,
  capabilityProfiles = capaciteiten.PROFIEL,
  recognizedPasses = runtimePassen.PASSEN } = {}) {
  const treden = ladder.treden();
  const prijsBron = leesBron(geldPasprijzen);
  const gratisId = ladder.enigeGratis();
  const tiers = treden.filter(v => vlak(v) && tekst(v.id)).map(t => {
    const tier = { id: t.id, name: tekst(t.naam), available: t.beschikbaar === true,
      pricing: prijsProjectie(t, prijsBron),
      capability: capabilityProjectie(t, capabilityProfiles),
      runtime: runtimeProjectie(t, recognizedPasses),
      application: applicationProjectie(t, applicationPasses, gratisId) };
    tier.findings = bevindingenVan(tier);
    tier.status = auditStatusVan([tier.pricing.sourceStatus, tier.capability.sourceStatus,
      tier.runtime.sourceStatus, tier.application.sourceStatus]);
    return tier;
  });
  const summary = { tiers: tiers.length,
    healthy: tiers.filter(t => t.status === STATUS.HEALTHY).length,
    sourceMismatch: tiers.filter(t => t.status === STATUS.SOURCE_MISMATCH).length,
    unknownSource: tiers.filter(t => t.status === STATUS.UNKNOWN_SOURCE).length };
  return diepVast({ schemaVersion: 1, auditId: AUDIT_ID, auditVersion: AUDIT_VERSION,
    status: auditStatusVan(tiers.map(t => t.status)), sources: { ...BRONNEN }, summary, tiers,
    provenance: Object.entries(BRONNEN).map(([source, sourceRef]) => ({ source, sourceRef })) });
}

module.exports = { AUDIT_ID, AUDIT_VERSION, STATUS, BRONNEN, maakSubscriptionSourceAuditV1 };
