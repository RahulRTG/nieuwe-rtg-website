/* De platformbrede woordenlijst voor acties. Surfaces, Search en Rahul mogen
   alleen een versie uit dit register aanbieden. De handler blijft bij de
   runtime-adapter; metadata en bevoegdheid staan hier op één plek. */
'use strict';

const { diepBevries } = require('./contract');
const { kopie } = require('./canon');

const DEFINITIES = diepBevries({
  'attention.acknowledge': {
    id: 'attention.acknowledge', version: 1, runtime: 'experience.attention',
    worlds: ['living', 'travel', 'work', 'foundation'],
    required: ['attentionId'], optional: [], confirmation: 'REQUIRED',
    authority: ['attention.acknowledge'], evidence: 'REQUIRED',
    consequence: 'EXPERIENCE_STATE'
  },
  'schedule.item.create': {
    id: 'schedule.item.create', version: 1, runtime: 'agenda',
    worlds: ['living', 'travel', 'work', 'foundation'],
    required: ['title', 'date'], optional: ['time', 'note'], confirmation: 'REQUIRED',
    authority: ['schedule.item.create'], evidence: 'REQUIRED',
    consequence: 'DOMAIN_TRUTH'
  }
});

function haal(intent, version) {
  const d = DEFINITIES[String(intent || '')];
  return d && Number(version || 1) === d.version ? d : null;
}

function publiek() { return Object.values(DEFINITIES).map(kopie); }

module.exports = { DEFINITIES, haal, publiek };
