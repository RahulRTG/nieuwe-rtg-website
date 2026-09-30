/* De verbindingslaag: policy -> verse bronnen -> intent -> samenstelling ->
   ervaring. Geen achtergrondprofilering, externe uitvoer of blijvende cache. */
'use strict';
const { hash, kopie } = require('./canon');
const contract = require('./network-contract');
const { collect } = require('./network-offers');
const { validate, collector } = require('./network-compose');
const graph = require('./network-graph');
const fout = (error, status = 400, code = 'INVALID_NETWORK_REQUEST') => ({ error, status, code });

module.exports = function network({ kern, db, crypto, contexten, manifesten, projecteer }) {
  const snapshot = options => collect({ kern, db, crypto, ...options });
  function selection(parameters) {
    const p = parameters || {};
    if (typeof p.title !== 'string' || !p.title.trim() || p.title.length > 60 || /[<>]/.test(p.title) ||
        !Array.isArray(p.choices) || !p.choices.length || p.choices.length > contract.limits.needs)
      return fout('Geef een naam van maximaal 60 tekens en kies één tot acht onderdelen.');
    if (p.choices.some(c => !c || typeof c.id !== 'string' || c.id.length > 80 || !/^[a-f0-9]{64}$/.test(c.revision)) ||
        new Set(p.choices.map(c => c.id)).size !== p.choices.length) return fout('Ongeldige of dubbele keuze.');
    const fresh = snapshot({ ids: new Set(p.choices.map(c => c.id)) }), byId = new Map(fresh.offers.map(o => [o.id, o]));
    if (fresh.discard) return fout('Een bron is onvolledig. Probeer opnieuw voordat u bewaart.', 503, 'NETWORK_PARTIAL');
    const selected = [];
    for (const c of p.choices) {
      const o = byId.get(c.id);
      if ((!o && fresh.missing.length) || (o && fresh.missing.includes(o.source)))
        return fout('De bron van uw keuze is onvolledig. Probeer opnieuw voordat u bewaart.', 503, 'NETWORK_PARTIAL');
      if (!o || o.revision !== c.revision || o.availability === 'UNAVAILABLE')
        return fout('Dit aanbod is gewijzigd of niet meer beschikbaar. Stel uw plan opnieuw samen.', 409, 'NETWORK_CHANGED');
      selected.push(o);
    }
    return { title: p.title.trim(), choices: selected.map(o => ({ id: o.id, revision: o.revision })), selected };
  }
  function read({ key, body, economicPrincipalRef }) {
    const b = body || {};
    if (!key) return fout('Log in om uw mogelijkheden te bekijken.', 401);
    if (!manifesten.haal(b.world)) return fout('Onbekende wereld.');
    const context = contexten.kies(key, b.world, b.contextId);
    if (!context || (b.contextId && b.contextId !== context.id))
      return fout('Deze context hoort niet bij u.', 403, 'CONTEXT_NOT_ALLOWED');
    if (b.mode === 'handoff') {
      const checked = selection({ title: 'Open aanbod', choices: [{ id: b.offerId, revision: b.revision }] });
      if (checked.error) return checked;
      return { ok: true, destination: checked.selected[0].destination, offer: checked.selected[0],
        bookingStatus: 'NOT_BOOKED', authority: 'DOMAIN_RECHECK_REQUIRED' };
    }
    if (b.mode && b.mode !== 'compose') return fout('Onbekende handeling.');
    const intent = validate(b.intent); if (intent.error) return intent;
    const stream = collector(intent), fresh = snapshot({ each: stream.add });
    const proposal = (fresh.discard ? collector(intent) : stream).finish(fresh);
    for (const need of proposal.needs) for (const o of need.options) o.revision = hash(crypto, o);
    const projection = b.includeContext === true ? projecteer({ key, world: b.world,
      contextId: context.id, economicPrincipalRef }) : null;
    if (projection && projection.error) return projection;
    const missing = [...fresh.missing];
    if (projection && projection.completeness.status !== 'COMPLETE') missing.push('experience');
    const options = proposal.needs.flatMap(n => n.options);
    return { ok: true, version: contract.version, world: b.world, contextId: context.id, proposal,
      graph: graph({ crypto, options, projection }),
      revision: hash(crypto, { intent, options: options.map(o => [o.id, o.revision]), missing }),
      completeness: { status: missing.length || fresh.rejected ? 'PARTIAL' : 'COMPLETE',
        scope: 'CONNECTED_SOURCES', missingSources: missing, rejected: fresh.rejected },
      freshness: { generatedAt: new Date().toISOString(), cached: false, sourceCapacityConfirmed: false },
      coverage: kopie(contract.coverage) };
  }
  return { read, selection, contract: () => kopie(contract) };
};
