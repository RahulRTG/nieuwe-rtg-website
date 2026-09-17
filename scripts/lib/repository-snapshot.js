'use strict';

/* ============================================================================
   DE REPOSITORYSNAPSHOT -- een leesronde, daarna alleen nog vragen.

   De bewijsmachine mag niet per meter opnieuw door de boom wandelen. Deze laag
   bouwt daarom EEN immutable beeld van bestanden, imports en semantische
   ankers. Afgeleide vragen worden gememoized. De bestaande reality-index blijft
   de parser; er komt hier geen tweede uitleg van require/import naast.
   ========================================================================== */
const crypto = require('crypto');
const { index: bouwIndex } = require('./werkelijkheid');

const STANDAARDMAPPEN = Object.freeze(['server', 'public', 'test', 'scripts', '.github', 'docs', '.']);
const hash = (waarde) => crypto.createHash('sha256').update(String(waarde)).digest('hex');
const uniek = (waarden) => Object.freeze([...new Set(waarden)].sort());

function entiteitenVan(bestand) {
  const bron = bestand.bron || '';
  const routes = [];
  const capabilities = [];
  const wetten = [];
  let m;
  const route = /\.(?:get|post|put|patch|delete|use)\s*\(\s*(['"`])([^'"`]+)\1/g;
  while ((m = route.exec(bron))) if (m[2].startsWith('/')) routes.push(m[2]);
  const capability = /\b(?:capability|capabiliteit|bevoegdheid)\s*[:=(,]\s*(['"])([\w.:-]+)\1/gi;
  while ((m = capability.exec(bron))) capabilities.push(m[2]);
  const wet = /\b(?:wet|law)[A-Za-z0-9_$]*\s*[:=(,]\s*(['"])([\w.:-]+)\1/gi;
  while ((m = wet.exec(bron))) wetten.push(m[2]);
  return Object.freeze({ routes: uniek(routes), capabilities: uniek(capabilities), wetten: uniek(wetten) });
}

function maak(mappen) {
  const begonnen = process.hrtime.bigint();
  const ix = bouwIndex(mappen || STANDAARDMAPPEN);
  const bestanden = new Map();
  const routes = new Map(), capabilities = new Map(), wetten = new Map(), registers = new Map();

  for (const [pad, invoer] of [...ix.bestanden.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const entiteiten = entiteitenVan(invoer);
    const bestand = Object.freeze({
      pad, hash: invoer.hash, bytes: invoer.bytes, codeBytes: invoer.codeBytes,
      gebied: invoer.gebied, soort: invoer.soort,
      afhankelijkheden: uniek(invoer.kanten.opgelost),
      benaderd: Object.freeze(invoer.kanten.benaderd.map((x) => Object.freeze({
        ...x, kandidaten: uniek(x.kandidaten || [])
      }))),
      onbekend: Object.freeze(invoer.kanten.onbekend.map((x) => Object.freeze({ ...x }))),
      entiteiten
    });
    bestanden.set(pad, bestand);
    for (const r of entiteiten.routes) voegToe(routes, r, pad);
    for (const c of entiteiten.capabilities) voegToe(capabilities, c, pad);
    for (const w of entiteiten.wetten) voegToe(wetten, w, pad);
    if (/^[^/]+\.json$/i.test(pad)) registers.set(pad, Object.freeze([pad]));
  }

  const regels = [...bestanden.values()].map((b) => b.pad + ':' + b.hash);
  const rootHash = hash(regels.join('\n'));
  const memo = new Map();
  const duurMs = Number(process.hrtime.bigint() - begonnen) / 1e6;

  function sluiting(start) {
    const sleutel = uniek(start).join('\0');
    if (memo.has(sleutel)) return memo.get(sleutel);
    const gezien = new Set(), rij = [...start];
    const onbekend = [];
    for (let i = 0; i < rij.length; i++) {
      const pad = rij[i];
      if (gezien.has(pad)) continue;
      gezien.add(pad);
      const b = bestanden.get(pad);
      if (!b) { onbekend.push({ pad, reden: 'bestand ontbreekt uit snapshot' }); continue; }
      for (const d of b.afhankelijkheden) if (!gezien.has(d)) rij.push(d);
      for (const ben of b.benaderd) for (const d of ben.kandidaten) if (!gezien.has(d)) rij.push(d);
      for (const o of b.onbekend) onbekend.push({ pad, ...o });
    }
    const uit = Object.freeze({ paden: uniek([...gezien]), onbekend: Object.freeze(onbekend.map(Object.freeze)) });
    memo.set(sleutel, uit);
    return uit;
  }

  return Object.freeze({
    formaat: 'rtg-repository-snapshot-v1', rootHash, gemaakt: new Date().toISOString(),
    duurMs, aantalBestanden: bestanden.size, bestanden,
    entiteiten: Object.freeze({ routes, capabilities, wetten, registers }),
    sluiting,
    /* Alleen voor de bestaande risicoanalyse. Nieuwe lezers gebruiken de
       snapshot-methoden hierboven en starten geen tweede scan. */
    index: ix
  });
}

function voegToe(map, sleutel, pad) {
  const oud = map.get(sleutel) || [];
  map.set(sleutel, Object.freeze([...oud, pad].sort()));
}

module.exports = { maak, entiteitenVan, STANDAARDMAPPEN, hash };
