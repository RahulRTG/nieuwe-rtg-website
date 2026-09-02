/* Het contract dat iedere RTG-wereld implementeert. Een manifest beschrijft
   de verschillen; dit bestand bewaakt de gemeenschappelijke ondergrens. */
'use strict';

const CONTRACT_VERSION = 1;
const MENTAL_MODELS = ['feed', 'journey', 'workspace', 'progress'];
const DENSITIES = ['low', 'medium', 'high', 'calm'];

const WORLD_CONTRACT = Object.freeze({
  version: CONTRACT_VERSION,
  context: Object.freeze({ required: true, resumable: true, authoritative: false }),
  projection: Object.freeze({ required: true, ownsSourceData: false, provenanceRequired: true,
    freshnessRequired: true, completenessRequired: true }),
  objects: Object.freeze({ stableReferences: true, deepLinkable: true, duplicatedByWorld: false }),
  actions: Object.freeze({ brokered: true, policyChecked: true, idempotent: true, evidenceRequired: true }),
  rahul: Object.freeze({ contextAware: true, directExecution: false }),
  attention: Object.freeze({ separateFromEvents: true, separateFromNotifications: true })
});

function eis(waar, melding) { if (!waar) throw new Error('experience manifest: ' + melding); }

function valideerManifest(m) {
  eis(m && typeof m === 'object', 'manifest ontbreekt');
  eis(/^[a-z][a-z0-9-]+$/.test(m.id || ''), 'ongeldig world id');
  eis(Number.isInteger(m.version) && m.version > 0, m.id + ': version ontbreekt');
  eis(MENTAL_MODELS.includes(m.mentalModel), m.id + ': onbekend mental model');
  eis(Array.isArray(m.primaryObjects) && m.primaryObjects.length, m.id + ': primaryObjects ontbreekt');
  eis(Array.isArray(m.contextTypes) && m.contextTypes.length, m.id + ': contextTypes ontbreekt');
  eis(m.home && typeof m.home.projection === 'string', m.id + ': home projection ontbreekt');
  eis(m.attention && Array.isArray(m.attention.reasons), m.id + ': attention model ontbreekt');
  eis(m.navigation && Array.isArray(m.navigation.defaults), m.id + ': navigation ontbreekt');
  eis(m.navigation.defaults.length <= m.navigation.slots, m.id + ': te veel standaardnavigatie');
  eis(m.rahul && m.rahul.directExecution === false, m.id + ': Rahul mag niet direct uitvoeren');
  eis(DENSITIES.includes(m.experience && m.experience.density), m.id + ': onbekende density');
  eis(m.governance && Array.isArray(m.governance.prohibit), m.id + ': governance ontbreekt');
  return m;
}

function diepBevries(o) {
  if (!o || typeof o !== 'object' || Object.isFrozen(o)) return o;
  Object.freeze(o);
  Object.values(o).forEach(diepBevries);
  return o;
}

module.exports = { CONTRACT_VERSION, WORLD_CONTRACT, MENTAL_MODELS, DENSITIES,
  valideerManifest, diepBevries };
