/* Vorm en samenhang van dezelfde uitvoerversie. Een checksum is geen
   bevoegdheid; valideer vóór canoniseren en vóór enige nieuwe werkruimte. */
'use strict';
const { KOPVELDEN, scopeFout } = require('./uitgang-grens');
const object = v => !!v && typeof v === 'object' && !Array.isArray(v) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(v));
const fout = reden => ({ ok: false, reden });

function veiligeJSON(waarde) {
  const stapel = [[waarde, 0]], gezien = new WeakSet();
  while (stapel.length) {
    const [v, diepte] = stapel.pop();
    if (diepte > 128) return false; // geen recursie-uitputting bij checksum/import
    if (v === null || typeof v === 'string' || typeof v === 'boolean') continue;
    if (typeof v === 'number') { if (!Number.isFinite(v)) return false; continue; }
    if ((!Array.isArray(v) && !object(v)) || gezien.has(v)) return false;
    gezien.add(v);
    for (const k of Object.keys(v)) {
      if (['__proto__', 'prototype', 'constructor'].includes(k)) return false;
      stapel.push([v[k], diepte + 1]);
    }
  }
  return true;
}

function controleer(u, { versie, catalogus, som }) {
  if (!object(u) || !veiligeJSON(u)) return fout('Geen veilige JSON-uitvoer meegegeven.');
  if (u.versie !== versie) return fout('Onbekende uitvoerversie: ' + u.versie + '.');
  if (!object(u.inhoud)) return fout('De uitvoer draagt geen inhoudskaart.');
  if (u.werkruimte != null && (!object(u.werkruimte) || KOPVELDEN.some(k =>
    u.werkruimte[k] != null && typeof u.werkruimte[k] !== 'string')))
    return fout('De werkruimtekop heeft een ongeldige vorm.');
  const leden = u.inhoud.leden;
  if (leden != null && (!object(leden) || Object.values(leden).some(l => !object(l) ||
    (l.rollen != null && (!Array.isArray(l.rollen) || l.rollen.some(r => !object(r)))))))
    return fout('De leden of hun historische rollen hebben een ongeldige vorm.');
  if (!Array.isArray(u.catalogus) || u.catalogus.some(r => !object(r) || typeof r.soort !== 'string' ||
    !r.soort || !Number.isSafeInteger(r.aantal) || r.aantal < 0 || !/^[a-f0-9]{64}$/.test(r.checksum || '')))
    return fout('De catalogus heeft een ongeldige vorm.');
  if (new Set(u.catalogus.map(r => r.soort)).size !== u.catalogus.length)
    return fout('Een soort mag slechts eenmaal in de catalogus staan.');
  // Eerst per soort, zodat een beschadiging bij haar eigen naam wordt gemeld.
  const opnieuw = catalogus(u.inhoud), was = new Map(u.catalogus.map(r => [r.soort, r]));
  const nu = new Set(opnieuw.map(r => r.soort));
  const scheef = opnieuw.filter(r => !was.has(r.soort) || was.get(r.soort).checksum !== r.checksum ||
    was.get(r.soort).aantal !== r.aantal).map(r => r.soort);
  scheef.push(...[...was.keys()].filter(k => !nu.has(k)).map(k => k + ' (weg)'));
  if (scheef.length) return fout('Deze soorten kloppen niet met de catalogus: ' + scheef.join(', ') + '.');
  if (som(u.catalogus) !== u.checksum)
    return fout('De catalogus klopt met de inhoud, maar de eindsom van de uitvoer niet -- de catalogus zelf is aangeraakt.');
  const scope = scopeFout(u, som);
  return scope ? fout(scope) : { ok: true, catalogus: opnieuw };
}
module.exports = { controleer, veiligeJSON, object };
