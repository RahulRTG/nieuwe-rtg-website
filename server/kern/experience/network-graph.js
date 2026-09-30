'use strict';
const { hash } = require('./canon');
const { normal } = require('./network-offers');
const contract = require('./network-contract');
module.exports = function graph({ crypto, options, projection }) {
  const nodes = new Map(), edges = new Map();
  const id = (type, value) => type + ':' + hash(crypto, value).slice(0, 32);
  const node = n => { nodes.set(n.id, n); return n.id; };
  const edge = (from, relationship, to, source) => {
    const key = id('edge', [from, relationship, to]);
    edges.set(key, { id: key, from, relationship, to, source, grantsAuthority: false });
  };
  for (const o of options) {
    const resource = node({ id: id('resource', o.id), kind: 'resource', ref: o.id,
      title: o.title, revision: o.revision, source: o.source });
    const capability = node({ id: 'offer.type:' + o.type, kind: 'capability',
      taxonomy: 'mall.offerTypes', title: o.type });
    edge(resource, 'offers', capability, o.source);
    // Particuliere advertenties zijn geen toestemming om een persoonsgraaf te bouwen.
    if (o.provider.kind !== 'particulier') {
      const provider = node({ id: id('organization', [o.provider.kind, o.provider.id || o.source]),
        kind: 'organization', title: o.provider.name, source: o.source });
      edge(provider, 'provides', resource, o.source);
    }
    for (const p of o.locations) {
      // Zonder land niet samenvoegen met een gelijknamige stad elders.
      const place = node({ id: id('place', [p.country || o.id, normal(p.city)]),
        kind: 'place', title: p.city, country: p.country, source: o.source });
      edge(resource, 'locatedAt', place, o.source);
    }
  }
  if (projection) {
    const person = node({ id: id('person', projection.context.id), kind: 'person',
      title: 'Uw huidige context', scope: 'SELF_ONLY', source: 'experience' });
    for (const o of (projection.objects || []).slice(0, contract.limits.contextObjects)) {
      const object = node({ id: id('domainObject', o.ref), kind: 'domainObject',
        ref: o.ref, title: o.title, source: o.source });
      edge(person, 'hasContext', object, 'experience');
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()], scope: 'RETURNED_OPTIONS_AND_AUTHORIZED_CONTEXT',
    completeWorldGraph: false, ownsSourceData: false };
};
