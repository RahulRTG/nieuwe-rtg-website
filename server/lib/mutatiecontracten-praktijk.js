'use strict';
const CONTRACTEN = {};
const paden = ['beeld', 'inrichten', 'aanbod', 'vraag', 'stap', 'delen'];
for (const pad of paden) CONTRACTEN['POST /api/bedrijf/praktijk/' + pad] = {
  mutatieId: 'bedrijf.praktijk.' + pad, herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'werkruimte' },
  stand: pad === 'beeld' ? 'NOT_APPLICABLE' : 'PROTECTED',
  nagekeken: 'Werkruimtepoort en klanten/projectrechten. Schrijven controleert versie en duurzame herhaalsleutel; delen bewaart geen kaal geheim.',
  bewijs: { op: '2026-09-30', gemeten: 'test/praktijk.test.js: vijf werkprofielen, bronobjecten, herhaling, grenzen en gastlink. test/praktijk-http.test.js: echte routes.' },
  afgetekend: { door: 'Codex: implementatie en geautomatiseerde controle, geen menselijke UX-goedkeuring', op: '2026-09-30' }
};
for (const pad of ['beeld', 'besluit']) CONTRACTEN['POST /api/werk-gast/' + pad] = {
  mutatieId: 'werk.gast.' + pad, herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'sleutel' },
  stand: pad === 'beeld' ? 'NOT_APPLICABLE' : 'PROTECTED',
  nagekeken: 'Actueel, hash-only, tijdelijk en intrekbaar geheim voor precies één voorstel. Geen generieke antwoordcache. Akkoord vraagt de actuele versie en kan slechts eenmaal.',
  bewijs: { op: '2026-09-30', gemeten: 'test/praktijk-http.test.js: onbekende, verlopen en ingetrokken link, akkoord en dubbele beslissing.' },
  afgetekend: { door: 'Codex: implementatie en geautomatiseerde controle, geen menselijke UX-goedkeuring', op: '2026-09-30' }
};
module.exports = { CONTRACTEN };
