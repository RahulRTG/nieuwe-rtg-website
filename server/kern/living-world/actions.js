'use strict';
/* Eén actiewoordenlijst voor Edge, de bronpagina en de Experience Broker.
   Zichtbaarheid is geen bevoegdheid: dezelfde predicates worden bij uitvoering herhaald. */
const definitions = {
  'place.create': ['Plek toevoegen', 'place'],
  'place.update': ['Plek bijwerken', 'place'],
  'place.publish': ['Plek delen', 'place'],
  'place.withdraw': ['Plek intrekken', 'place'],
  'blueprint.create': ['Ervaring maken', 'blueprint'],
  'blueprint.update': ['Blueprint bijwerken', 'blueprint'],
  'blueprint.publish': ['Ervaring publiceren', 'blueprint'],
  'blueprint.withdraw': ['Ervaring intrekken', 'blueprint'],
  'blueprint.fork': ['Make it mine', 'blueprint'],
  'plan.create': ['Take me there', 'blueprint'],
  'plan.update': ['Mijn plan aanpassen', 'plan'],
  'plan.request': ['Aan organisator voorleggen', 'plan'],
  'plan.decide': ['Aanvraag behandelen', 'plan'],
  'plan.start': ['Uitvoering gestart vastleggen', 'plan'],
  'plan.complete': ['Deelname vastleggen', 'plan'],
  'plan.acknowledge': ['Mijn deelname bevestigen', 'plan'],
  'plan.revokeEvidence': ['Deelnamebewijs corrigeren', 'plan'],
  'plan.cancel': ['Annuleren', 'plan'],
  'plan.issue': ['Hulp nodig', 'plan'],
  'plan.resolve': ['Behandeling afronden', 'plan'],
  'plan.consent': ['Impactdeling wijzigen', 'plan'],
  'plan.connect': ['Reis of community verbinden', 'plan'],
  'contribution.create': ['Iets achterlaten', 'place'],
  'contribution.review': ['Bijdrage beoordelen', 'contribution'],
  'contribution.withdraw': ['Bijdrage intrekken', 'contribution'],
  'contribution.adopt': ['Verbetering overnemen', 'contribution']
};
const own = (x, key) => x && x.owner === key;
const open = (x, key) => x && (own(x,key) || x.status === 'published');
function allowed(action, row, key, state) {
  const mine = own(row,key), organizer = row && row.organizer === key;
  switch (action) {
    case 'place.create': return true;
    case 'place.update': return mine && row.status !== 'withdrawn';
    case 'place.publish': return mine && ['draft','withdrawn'].includes(row.status);
    case 'place.withdraw': return mine && row.status === 'published';
    case 'blueprint.create': return open(row,key);
    case 'blueprint.update': return mine && row.status !== 'withdrawn';
    case 'blueprint.publish': return mine && ['draft','withdrawn'].includes(row.status);
    case 'blueprint.withdraw': return mine && row.status === 'published';
    case 'blueprint.fork': return row && row.status === 'published' && row.versions.at(-1).remixAllowed;
    case 'plan.create': return row && row.status === 'published';
    case 'plan.update': return mine && ['planning','requested','accepted','declined'].includes(row.status);
    case 'plan.request': return mine && ['planning','declined'].includes(row.status);
    case 'plan.decide': return organizer && row.status === 'requested' && !mine;
    case 'plan.start': return organizer && row.status === 'accepted';
    case 'plan.complete': return organizer && row.status === 'active';
    case 'plan.acknowledge': return mine && row.status === 'completed' && !row.acknowledgedAt && !row.participation.revokedAt;
    case 'plan.revokeEvidence': return organizer && row.status === 'completed' && !row.participation.revokedAt;
    case 'plan.cancel': return (mine || organizer) && !['completed','cancelled'].includes(row.status);
    case 'plan.issue': return (mine || organizer) && ['requested','accepted','active'].includes(row.status);
    case 'plan.resolve': return organizer && row.status === 'waiting';
    case 'plan.consent': return mine;
    case 'plan.connect': return mine && !['cancelled','completed'].includes(row.status);
    case 'contribution.create': return row && row.status === 'published';
    case 'contribution.review': return row && row.owner !== key && row.status === 'pending'
      && own(state.places[row.placeId],key);
    case 'contribution.withdraw': return mine && row.status !== 'withdrawn';
    case 'contribution.adopt': return row && row.status === 'accepted' && row.blueprintId
      && own(state.blueprints[row.blueprintId],key) && !row.adoptedVersion;
    default: return false;
  }
}
function forObject(type, row, key, state) {
  return Object.entries(definitions).filter(([a,d]) => !['place.create','blueprint.create'].includes(a)
    && d[1] === type && allowed(a,row,key,state))
    .map(([id,d]) => ({ id, intent: 'living-world.' + id, label: d[0] }));
}
module.exports = { definitions, allowed, forObject };
