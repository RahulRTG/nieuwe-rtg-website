'use strict';

const NODE_MINIMAAL = Object.freeze([22, 13]);

function eisOndersteundeNode(versie) {
  const gelezen = String(versie || process.versions.node).split('.').map(Number);
  if (Number.isFinite(gelezen[0]) && gelezen[0] >= NODE_MINIMAAL[0] &&
      (gelezen[0] > NODE_MINIMAAL[0] || gelezen[1] >= NODE_MINIMAAL[1])) return true;
  console.error('[start] Node ' + String(versie || process.versions.node) +
    ' is te oud. RTG vereist Node ' + NODE_MINIMAAL.join('.') +
    ' of nieuwer, omdat de accountsdatabase op de ingebouwde node:sqlite draait. Zie LIVEGANG.md.');
  process.exit(78);
}

module.exports = { NODE_MINIMAAL, eisOndersteundeNode };
