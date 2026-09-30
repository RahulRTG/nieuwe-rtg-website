/* ============================================================================
   HET LEERHUIS -- wat de leerling over ZICHZELF ziet: de afgeronde
   beoordelingen (met het herstelpad, want dat gaat over hem), een bezwaar
   ertegen, en zijn EVC-aanvragen. Onderdeel van mijn() in ./zicht.js.
   ========================================================================== */
'use strict';

const { relatieActief } = require('./oordeel');

/* De uitslagen over de leerling zelf (met het herstelpad: dat gaat over hem) en
   zijn EVC-aanvragen. Of een bezwaar of EVC mag, zegt de handeling; hier staat
   alleen of er al een loopt, zodat het scherm geen tweede knop toont. */
function eigenOordelen(st, persoon) {
  const naam = (v) => (st.vaardigheden[v] || {}).naam || v;
  const bezwaar = (id) => Object.values(st.bezwaren).filter(z => z.beoordeling === id).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null;
  return {
    UITSLAGEN: Object.values(st.beoordelingen).filter(b => b.persoon === persoon && ['PROVEN', 'NOT_YET_PROVEN', 'INCONCLUSIVE'].includes(b.stand))
      .map(b => { const z = bezwaar(b.id); return { id: b.id, vaardigheidNaam: naam(b.vaardigheid), stand: b.stand, herstel: b.herstel || null, sinds: b.at,
        bezwaar: z ? { stand: z.stand, uitkomst: ['UPHELD', 'CHANGED', 'REASSESSMENT'].includes(z.stand) ? z.uitkomst || null : null } : null }; }),
    EVC: Object.values(st.evc).filter(e => e.persoon === persoon).map(e => ({ id: e.id, vaardigheidNaam: naam(e.vaardigheid), extern: e.extern, stand: e.stand })),
    EVC_KEUZE: relatieActief(st, persoon) ? Object.values(st.vaardigheden).map(v => ({ id: v.id, naam: v.naam })) : []
  };
}

module.exports = { eigenOordelen };
