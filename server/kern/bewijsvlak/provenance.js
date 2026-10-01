/* Herkomstgraaf met gekalibreerd vertrouwen per edge. Een onbekende edge blijft
   onbekend; succesvolle nachtmetingen verhogen vertrouwen, misses verlagen het. */
'use strict';

const { hash, bevries, kopie } = require('./canon');

function maakGraaf(initieel) {
  const nodes = new Map(), edges = new Map();

  function node(id, data) {
    if (!id) throw new Error('bewijsvlak provenance: node-id ontbreekt');
    const n = bevries({ id, ...(kopie(data || {})) }); nodes.set(id, n); return n;
  }
  function edge(from, to, gegevens) {
    if (!nodes.has(from) || !nodes.has(to)) throw new Error('bewijsvlak provenance: onbekende node');
    const g = gegevens || {}, edgeId = 'edge_' + hash({ from, to, reason: g.reason }).slice(0, 24);
    const e = bevries({ edgeId, from, to, reason: g.reason || 'unknown', basis: g.basis || 'declared',
      samples: g.samples || { confirmed: 0, missed: 0 }, confidence: Number.isFinite(g.confidence) ? g.confidence : 0 });
    edges.set(edgeId, e); return e;
  }
  function calibrate(edgeId, matched, evidenceRef) {
    const oud = edges.get(edgeId); if (!oud) throw new Error('bewijsvlak provenance: edge onbekend');
    const samples = { confirmed: oud.samples.confirmed + (matched ? 1 : 0), missed: oud.samples.missed + (matched ? 0 : 1) };
    /* Laplace voorkomt dat één groene run meteen zekerheid 1 claimt. Een miss
       degradeert dezelfde aanname die hem veroorzaakte, niet de hele graaf. */
    const confidence = Number(((samples.confirmed + 1) / (samples.confirmed + samples.missed + 2)).toFixed(4));
    const nieuw = bevries({ ...oud, samples, confidence, lastEvidenceRef: evidenceRef || null });
    edges.set(edgeId, nieuw); return nieuw;
  }
  function invalidate(changed) {
    const gezien = new Set(changed || []), rij = [...gezien];
    for (let i = 0; i < rij.length; i++) for (const e of edges.values()) {
      if (e.from === rij[i] && !gezien.has(e.to)) { gezien.add(e.to); rij.push(e.to); }
    }
    return [...gezien];
  }
  function why(from, to) {
    const pad = [], gezien = new Set();
    function zoek(n) {
      if (n === to) return true;
      if (gezien.has(n)) return false; gezien.add(n);
      for (const e of edges.values()) if (e.from === n) { pad.push(e); if (zoek(e.to)) return true; pad.pop(); }
      return false;
    }
    return zoek(from) ? { connected: true, path: pad.map(kopie), confidence: Math.min(...pad.map(e => e.confidence)) }
      : { connected: false, path: [], confidence: 0, reason: 'NO_PROVEN_EDGE' };
  }
  for (const n of (initieel && initieel.nodes) || []) node(n.id, n);
  for (const e of (initieel && initieel.edges) || []) edge(e.from, e.to, e);
  return Object.freeze({ node, edge, calibrate, invalidate, why,
    snapshot: () => ({ nodes: [...nodes.values()].map(kopie), edges: [...edges.values()].map(kopie) }) });
}

module.exports = { maakGraaf };
