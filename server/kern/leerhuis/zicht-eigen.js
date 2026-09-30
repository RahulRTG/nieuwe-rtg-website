/* ============================================================================
   HET LEERHUIS -- wat de leerling over ZICHZELF ziet: de afgeronde
   beoordelingen (met het herstelpad, want dat gaat over hem), een bezwaar
   ertegen, zijn EVC-aanvragen, en het werk dat hij onder goedgekeurd beleid
   vastlegt. Onderdeel van mijn() in ./zicht.js.
   ========================================================================== */
'use strict';

const { relatieActief } = require('./oordeel');
const { geschiktheid } = require('./brug');

/* De uitslagen over de leerling zelf (met het herstelpad: dat gaat over hem) en
   zijn EVC-aanvragen. Of een bezwaar of EVC mag, zegt de handeling; hier staat
   alleen of er al een loopt, zodat het scherm geen tweede knop toont. */
function eigenOordelen(st, persoon, nu) {
  const naam = (v) => (st.vaardigheden[v] || {}).naam || v;
  const bezwaar = (id) => Object.values(st.bezwaren).filter(z => z.beoordeling === id).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null;
  return {
    UITSLAGEN: Object.values(st.beoordelingen).filter(b => b.persoon === persoon && ['PROVEN', 'NOT_YET_PROVEN', 'INCONCLUSIVE'].includes(b.stand))
      .map(b => { const z = bezwaar(b.id); return { id: b.id, vaardigheidNaam: naam(b.vaardigheid), stand: b.stand, herstel: b.herstel || null, sinds: b.at,
        bezwaar: z ? { stand: z.stand, uitkomst: ['UPHELD', 'CHANGED', 'REASSESSMENT'].includes(z.stand) ? z.uitkomst || null : null } : null }; }),
    EVC: Object.values(st.evc).filter(e => e.persoon === persoon).map(e => ({ id: e.id, vaardigheidNaam: naam(e.vaardigheid), extern: e.extern, stand: e.stand })),
    EVC_KEUZE: relatieActief(st, persoon) ? Object.values(st.vaardigheden).map(v => ({ id: v.id, naam: v.naam })) : [],
    /* Werk onder goedgekeurd beleid: per handeling of hij geschikt is en, zo niet,
       welke eisen ontbreken. Geschikt is geen bevoegdheid (brug.js); vastleggen
       beslist werkVastleggen, dat dezelfde geschiktheid opnieuw rekent. */
    WERK: relatieActief(st, persoon) ? Object.values(st.beleid).filter(b => b.goedgekeurd).map(b => {
      const g = geschiktheid(st, persoon, b.handeling, nu);
      const eigen = st.werk.filter(w => w.persoon === persoon && w.handeling === b.handeling);
      return { handeling: b.handeling, geschikt: g.uitkomst === 'AUTHORITY_ELIGIBLE', ontbreekt: g.opbouw.filter(x => !x.ok).map(x => x.waarom),
        vastgelegd: eigen.length, laatste: eigen.length ? eigen[eigen.length - 1].at : null };
    }) : []
  };
}

module.exports = { eigenOordelen };
