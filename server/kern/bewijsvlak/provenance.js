/* Herkomstgraaf met gekalibreerd vertrouwen per edge. Een onbekende edge blijft
   onbekend; succesvolle nachtmetingen verhogen vertrouwen, misses verlagen het. */
'use strict';

const { hash, bevries, kopie } = require('./canon');

function maakGraaf(initieel, opties) {
  const vasteState = initieel || {}, o = opties || {};
  const stateFor = typeof o.stateFor === 'function' ? o.stateFor : () => vasteState;
  const save = typeof o.save === 'function' ? o.save : () => {};
  function state() {
    const s = stateFor();
    if (!s || typeof s !== 'object') throw new Error('bewijsvlak provenance: state ontbreekt');
    if (!Array.isArray(s.nodes)) s.nodes = [];
    if (!Array.isArray(s.edges)) s.edges = [];
    return s;
  }
  state();

  function node(id, data) {
    if (!id) throw new Error('bewijsvlak provenance: node-id ontbreekt');
    const s = state(), n = bevries({ id, ...(kopie(data || {})) });
    const i = s.nodes.findIndex(x => x.id === id), oud = i >= 0 ? s.nodes[i] : null;
    if (i >= 0) s.nodes[i] = n; else s.nodes.push(n);
    try { save(); }
    catch (error) { if (i >= 0) s.nodes[i] = oud; else { const j = s.nodes.indexOf(n); if (j >= 0) s.nodes.splice(j, 1); } throw error; }
    return n;
  }
  function edge(from, to, gegevens) {
    const s = state();
    if (!s.nodes.some(n => n.id === from) || !s.nodes.some(n => n.id === to))
      throw new Error('bewijsvlak provenance: onbekende node');
    const g = gegevens || {}, edgeId = 'edge_' + hash({ from, to, reason: g.reason }).slice(0, 24);
    const e = bevries({ edgeId, from, to, reason: g.reason || 'unknown', basis: g.basis || 'declared',
      samples: g.samples || { confirmed: 0, missed: 0 }, confidence: Number.isFinite(g.confidence) ? g.confidence : 0 });
    const i = s.edges.findIndex(x => x.edgeId === edgeId), oud = i >= 0 ? s.edges[i] : null;
    if (i >= 0) s.edges[i] = e; else s.edges.push(e);
    try { save(); }
    catch (error) { if (i >= 0) s.edges[i] = oud; else { const j = s.edges.indexOf(e); if (j >= 0) s.edges.splice(j, 1); } throw error; }
    return e;
  }
  function calibrate(edgeId, matched, evidenceRef) {
    const s = state(), i = s.edges.findIndex(x => x.edgeId === edgeId), oud = s.edges[i];
    if (!oud) throw new Error('bewijsvlak provenance: edge onbekend');
    const samples = { confirmed: oud.samples.confirmed + (matched ? 1 : 0), missed: oud.samples.missed + (matched ? 0 : 1) };
    /* Laplace voorkomt dat één groene run meteen zekerheid 1 claimt. Een miss
       degradeert dezelfde aanname die hem veroorzaakte, niet de hele graaf. */
    const confidence = Number(((samples.confirmed + 1) / (samples.confirmed + samples.missed + 2)).toFixed(4));
    const nieuw = bevries({ ...oud, samples, confidence, lastEvidenceRef: evidenceRef || null });
    s.edges[i] = nieuw;
    try { save(); } catch (error) { if (s.edges[i] === nieuw) s.edges[i] = oud; throw error; }
    return nieuw;
  }
  function invalidate(changed) {
    const gezien = new Set(changed || []), rij = [...gezien];
    const edges = state().edges;
    for (let i = 0; i < rij.length; i++) for (const e of edges) {
      if (e.from === rij[i] && !gezien.has(e.to)) { gezien.add(e.to); rij.push(e.to); }
    }
    return [...gezien];
  }
  function why(from, to) {
    const edges = state().edges;
    const pad = [], gezien = new Set();
    function zoek(n) {
      if (n === to) return true;
      if (gezien.has(n)) return false; gezien.add(n);
      for (const e of edges) if (e.from === n) { pad.push(e); if (zoek(e.to)) return true; pad.pop(); }
      return false;
    }
    return zoek(from) ? { connected: true, path: pad.map(kopie), confidence: Math.min(...pad.map(e => e.confidence)) }
      : { connected: false, path: [], confidence: 0, reason: 'NO_PROVEN_EDGE' };
  }
  return Object.freeze({ node, edge, calibrate, invalidate, why,
    snapshot: () => { const s = state(); return { nodes: s.nodes.map(kopie), edges: s.edges.map(kopie) }; } });
}

module.exports = { maakGraaf };
