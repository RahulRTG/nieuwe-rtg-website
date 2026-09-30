'use strict';
const SLEUTELS = { 'POST /api/experience/network': { leest: true },
  'POST /api/werk-gast/beeld': { leest: true }, 'POST /api/werk-gast/besluit': { zelfdeVerzoek: true } };
for (const p of ['beeld', 'inrichten', 'aanbod', 'vraag', 'stap', 'delen'])
  SLEUTELS['POST /api/bedrijf/praktijk/' + p] = p === 'beeld' ? { leest: true } : { velden: ['idem'] };
module.exports = { SLEUTELS };
