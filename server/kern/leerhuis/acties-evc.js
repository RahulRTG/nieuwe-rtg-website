/* ============================================================================
   HET LEERHUIS -- EVC (erkenning van eerder verworven competenties) en bezwaar.

   EXTERN BEWIJS IS GEEN INTERN RECHT. EVC accepteert een extern stuk hoogstens
   als DOCUMENTED bewijs; PROVEN komt nog steeds uit een eigen beoordeling in
   DEZE organisatie. Een certificaat van elders maakt hier niemand geschikt.

   BEZWAAR IS ONAFHANKELIJK: niet de assessor, niet de indiener. REASSESSMENT
   maakt de oude beoordeling ongeldig, zodat een nieuwe kan beginnen; de oude
   blijft als historie staan.
   ========================================================================== */
'use strict';

const { overgang } = require('./standen');
const { relatieActief } = require('./oordeel');
const { weiger, eisBestuur, eisNiet, eisOrg, kennisNu, eigenId } = require('./hulp');

const tekst = (x, n) => String(x == null ? '' : x).slice(0, n || 300);

module.exports = {
  evcIndienen(st, i, door, ctx) {
    eisOrg(st);
    if (!relatieActief(st, door)) weiger('EVC vraagt een lopende relatie', 403);
    if (!st.vaardigheden[i.vaardigheid]) weiger('vaardigheid bestaat niet', 404);
    if (!i.extern) weiger('noem het externe stuk (wat, van wie, wanneer)', 400);
    if (Object.values(st.evc).some(e => e.persoon === door && e.vaardigheid === i.vaardigheid && ['CLAIM', 'EVIDENCE', 'REVIEW'].includes(e.stand)))
      weiger('er loopt al een EVC voor deze vaardigheid', 409);
    const id = eigenId(st.evc, i.id, ctx);
    return [{ soort: 'evc', data: { id, persoon: door, vaardigheid: i.vaardigheid, extern: tekst(i.extern, 400) } },
      { soort: 'evcStand', data: { id, naar: 'EVIDENCE' } }];
  },

  evcBeoordeel(st, i, door, ctx) {
    eisBestuur(st, door, ['ASSESSOR'], 'een EVC beoordelen');
    const e = st.evc[i.id]; if (!e) weiger('EVC bestaat niet', 404);
    eisNiet(door, e.persoon, 'niemand beoordeelt zijn eigen EVC');
    const uit = [];
    if (e.stand === 'EVIDENCE') uit.push({ soort: 'evcStand', data: { id: e.id, naar: 'REVIEW' } });
    const o = overgang('evc', 'REVIEW', i.uitkomst); if (!o.ok) weiger(o.reden, 409);
    uit.push({ soort: 'evcStand', data: { id: e.id, naar: i.uitkomst } });
    if (i.uitkomst !== 'REJECTED') uit.push({ soort: 'bewijs', data: { id: ctx.id(), persoon: e.persoon, vaardigheid: e.vaardigheid,
      soort: 'KNOWLEDGE_EVIDENCE', sterkte: 'DOCUMENTED', bron: 'EVC ' + e.id + ': ' + e.extern, notitie: i.uitkomst, kennis: kennisNu(st, e.vaardigheid) } });
    return uit;
  },

  bezwaarIndienen(st, i, door, ctx) {
    eisOrg(st);
    const b = st.beoordelingen[i.beoordeling]; if (!b) weiger('beoordeling bestaat niet', 404);
    if (b.persoon !== door) weiger('bezwaar maakt de beoordeelde zelf', 403);
    if (!['PROVEN', 'NOT_YET_PROVEN', 'INCONCLUSIVE'].includes(b.stand)) weiger('bezwaar gaat over een afgeronde beoordeling', 409);
    if (Object.values(st.bezwaren).some(z => z.beoordeling === b.id && ['REVIEW_REQUEST', 'INDEPENDENT_REVIEW'].includes(z.stand)))
      weiger('er loopt al een bezwaar tegen deze beoordeling', 409);
    if (!String(i.reden || '').trim()) weiger('een bezwaar zonder reden kan niemand behandelen', 400);
    return [{ soort: 'bezwaar', data: { id: ctx.id(), beoordeling: b.id, reden: tekst(i.reden, 800) } }];
  },

  /* Onafhankelijk: niet de assessor, niet de indiener. REASSESSMENT maakt de
     oude beoordeling ongeldig, zodat een nieuwe kan beginnen. */
  bezwaarStand(st, i, door) {
    eisBestuur(st, door, ['QUALITY_AUTHORITY'], 'een bezwaar behandelen');
    const z = st.bezwaren[i.id]; if (!z) weiger('bezwaar bestaat niet', 404);
    const b = st.beoordelingen[z.beoordeling];
    eisNiet(door, b.assessor, 'de assessor behandelt geen bezwaar tegen zijn eigen oordeel');
    const o = overgang('bezwaar', z.stand, i.naar); if (!o.ok) weiger(o.reden, 409);
    if (z.stand === 'INDEPENDENT_REVIEW' && z.reviewer !== door) weiger('de reviewer die begon, rondt af', 403);
    const uit = [{ soort: 'bezwaarStand', data: { id: z.id, naar: i.naar, notitie: tekst(i.notitie, 600) } }];
    if (i.naar === 'REASSESSMENT' && overgang('beoordeling', b.stand, 'INVALIDATED').ok)
      uit.push({ soort: 'beoordelingStand', data: { id: b.id, naar: 'INVALIDATED', reden: 'bezwaar ' + z.id + ': opnieuw beoordelen' } });
    return uit;
  }
};
