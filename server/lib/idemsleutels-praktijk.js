'use strict';
const SLEUTELS = { 'POST /api/experience/network': { leest: true },
  'POST /api/werk-gast/beeld': { leest: true }, 'POST /api/werk-gast/besluit': { zelfdeVerzoek: true } };
for (const p of ['beeld', 'inrichten', 'aanbod', 'vraag', 'stap', 'delen', 'leverancier', 'betaalverzoek'])
  SLEUTELS['POST /api/bedrijf/praktijk/' + p] = p === 'beeld' ? { leest: true } : { velden: ['idem'] };
for (const p of ['beeld','besluit']) SLEUTELS['POST /api/werk-leverancier/'+p] = p === 'beeld' ? { leest:true } : { zelfdeVerzoek:true };
SLEUTELS['POST /api/werk-gast/betaling/start'] = { zelfdeVerzoek:true };
SLEUTELS['POST /api/werk-gast/betaling/status'] = { zelfdeVerzoek:true };
module.exports = { SLEUTELS };
