/* Opslag, deel "merge": de drie-weg samenvoeging op item-niveau. Schrijven twee
   processen tegelijk naar DEZELFDE collectie (bijv. allebei een gezin toevoegen
   aan foundation.gezinnen, of allebei een sessie), dan voegen we hun wijzigingen
   per item samen in plaats van de hele collectie te overschrijven. base = onze
   laatst-gesynchroniseerde waarde, ours = ons geheugen, theirs = wat er nu in de
   store staat.
   - objecten (maps): sleutel voor sleutel; een kant die niet wijzigde geeft mee.
   - arrays met een id (of a+b bij connecties): als map op die sleutel mergen,
     zodat toevoegingen van beide kanten blijven en verwijderingen doorwerken.
   - overige arrays/scalars: de gewijzigde kant wint (anders de onze).
   Puur en zonder staat; gebruikt door zowel de SQLite- als de Postgres-opslag. */
const _j = x => JSON.stringify(x);
function itemSleutel(it) {
  if (!it || typeof it !== 'object') return null;
  if (it.id != null) return 'id:' + it.id;
  if (it.a != null && it.b != null) return 'ab:' + [it.a, it.b].sort().join('|');
  return null;
}
function soort(x) { return Array.isArray(x) ? 'array' : (x && typeof x === 'object' ? 'object' : 'scalar'); }
function merge3(base, ours, theirs) {
  if (theirs === undefined) return ours;
  if (ours === undefined) return theirs;
  if (soort(ours) !== soort(theirs) || (base !== undefined && soort(base) !== soort(ours))) {
    return _j(ours) !== _j(base) ? ours : theirs; // structuur veranderde: de gewijzigde kant
  }
  if (soort(ours) === 'scalar') {
    if (_j(ours) === _j(base)) return theirs;
    if (_j(theirs) === _j(base)) return ours;
    return ours; // beide gewijzigd: de onze (laatste schrijver)
  }
  if (soort(ours) === 'object') {
    const res = {}, b = base || {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(ours), ...Object.keys(theirs)])) {
      const bo = b[k], oo = ours[k], to = theirs[k];
      if (oo === undefined && bo !== undefined && _j(to) === _j(bo)) continue; // wij verwijderden
      if (to === undefined && bo !== undefined && _j(oo) === _j(bo)) continue; // zij verwijderden
      const m = merge3(bo, oo, to);
      if (m !== undefined) res[k] = m;
    }
    return res;
  }
  // arrays
  const b = base || [];
  const keybaar = [ours, theirs, b].every(arr => Array.isArray(arr) && arr.every(it => itemSleutel(it) != null));
  if (keybaar) {
    const mapVan = arr => { const m = new Map(); for (const it of arr) m.set(itemSleutel(it), it); return m; };
    const mb = mapVan(b), mo = mapVan(ours), mt = mapVan(theirs), res = new Map();
    for (const k of new Set([...mb.keys(), ...mo.keys(), ...mt.keys()])) {
      const bo = mb.get(k), oo = mo.get(k), to = mt.get(k);
      if (oo === undefined && mb.has(k) && _j(to) === _j(bo)) continue; // wij verwijderden
      if (to === undefined && mb.has(k) && _j(oo) === _j(bo)) continue; // zij verwijderden
      const m = merge3(bo, oo, to);
      if (m !== undefined) res.set(k, m);
    }
    return [...res.values()];
  }
  if (_j(ours) === _j(base)) return theirs;
  if (_j(theirs) === _j(base)) return ours;
  return ours;
}
module.exports = { merge3, itemSleutel, soort };
