'use strict';

/* Een expliciete Evidence DAG. Kanten wijzen van bewijs naar zijn invoer. Wie
   een invoer wijzigt, loopt de omgekeerde kanten en vindt precies welk bewijs
   ongeldig is. Onbekende kanten blijven zichtbaar en worden nooit genegeerd. */
const crypto = require('crypto');

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const id = (soort, naam) => soort + ':' + naam;

function bouw(snapshot, toetsen) {
  const nodes = new Map(), uitgaand = new Map(), ingaand = new Map();
  const voegNode = (nodeId, data) => { if (!nodes.has(nodeId)) nodes.set(nodeId, Object.freeze({ id: nodeId, ...data })); };
  const verbind = (van, naar, reden) => {
    if (!uitgaand.has(van)) uitgaand.set(van, []);
    if (!ingaand.has(naar)) ingaand.set(naar, []);
    const kant = Object.freeze({ van, naar, reden });
    uitgaand.get(van).push(kant); ingaand.get(naar).push(kant);
  };

  for (const b of snapshot.bestanden.values()) {
    const bron = id('bestand', b.pad);
    voegNode(bron, { soort: 'bestand', naam: b.pad, hash: b.hash });
    for (const d of b.afhankelijkheden) {
      const doel = id('bestand', d);
      voegNode(doel, { soort: 'bestand', naam: d, hash: snapshot.bestanden.get(d)?.hash || null });
      verbind(bron, doel, 'leest');
    }
    for (const groep of ['routes', 'capabilities', 'wetten']) {
      for (const naam of b.entiteiten[groep]) {
        const entiteit = id(groep.slice(0, -1), naam);
        voegNode(entiteit, { soort: groep.slice(0, -1), naam, hash: digest(naam + '@' + b.hash) });
        verbind(entiteit, bron, 'gedefinieerd-in');
      }
    }
    if (/^[^/]+\.json$/i.test(b.pad)) {
      const register = id('register', b.pad);
      voegNode(register, { soort: 'register', naam: b.pad, hash: b.hash });
      verbind(register, bron, 'inhoud');
    }
  }

  for (const toets of toetsen || []) {
    const bewijs = id('bewijs', toets);
    voegNode(bewijs, { soort: 'bewijs', naam: toets, hash: null });
    const s = snapshot.sluiting([toets]);
    for (const pad of s.paden) verbind(bewijs, id('bestand', pad), 'bewijsinvoer');
    if (s.onbekend.length) {
      const gat = id('onbekend', toets);
      voegNode(gat, { soort: 'onbekend', naam: toets, hash: null, redenen: s.onbekend });
      verbind(bewijs, gat, 'onbegrensde-invoer');
    }
  }

  function ongeldigVanaf(nodeIds) {
    const gezien = new Set(nodeIds), rij = [...nodeIds];
    for (let i = 0; i < rij.length; i++) {
      for (const kant of ingaand.get(rij[i]) || []) {
        if (!gezien.has(kant.van)) { gezien.add(kant.van); rij.push(kant.van); }
      }
    }
    return Object.freeze([...gezien].sort());
  }

  function bewijsInvoer(toets) {
    const bewijs = id('bewijs', toets);
    const kanten = uitgaand.get(bewijs) || [];
    const onbekend = kanten.some((k) => k.naar.startsWith('onbekend:'));
    const invoer = kanten.filter((k) => k.naar.startsWith('bestand:')).map((k) => nodes.get(k.naar))
      .filter(Boolean).sort((a, b) => a.naam.localeCompare(b.naam));
    return Object.freeze({ onbekend, invoer: Object.freeze(invoer),
      hash: digest(invoer.map((n) => n.naam + ':' + n.hash).join('\n')) });
  }

  return Object.freeze({ formaat: 'rtg-evidence-dag-v1', nodes, uitgaand, ingaand,
    ongeldigVanaf, bewijsInvoer });
}

module.exports = { bouw, id, digest };
