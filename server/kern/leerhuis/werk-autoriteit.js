/* ============================================================================
   HET LEERHUIS -- wat er klaarligt voor de certificaat- en de trainerautoriteit
   (fase B-UI, het werkscherm).

   Twee leesvragen, allebei over DE LEZER zelf, en ze beslissen niets. Of een
   certificaat mag, zegt certificaatUitgeven (niemand certificeert zichzelf, en
   bij een kritieke vaardigheid geeft de assessor het niet zelf uit); of een
   trainer mag, zeggen trainerKwalificeer en trainerToewijzen. Deze module zegt
   wat er LIGT.

   MINSTE KENNIS PER LEZER (grondwet 21): de certificaatautoriteit ziet welke
   beoordelingen bewezen zijn en nog geen certificaat dragen, niet het bewijs of
   de criteria erachter -- die staan in de beoordeling, en die is van de
   assessor. De trainerautoriteit ziet welke leerpaden geen trainer hebben en
   wie ze geldig zou kunnen geven, niet hoe ver een leerling is.
   ========================================================================== */
'use strict';

const { heeftBestuur, relatieActief, certStand, certTelt, trainerGeldig } = require('./oordeel');
const { TRAINERLADDER } = require('./standen');

const naamVan = (st, v) => (st.vaardigheden[v] || {}).naam || v;

function certificaatWerk(st, door, nu) {
  const uitgeven = heeftBestuur(st, door, 'ASSESSMENT_AUTHORITY');
  if (!uitgeven && !heeftBestuur(st, door, 'QUALITY_AUTHORITY'))
    return { ok: false, reden: 'u bent in deze organisatie geen certificaat- of kwaliteitsautoriteit' };
  const certs = Object.values(st.certificaten);
  const gedekt = new Set(certs.filter(c => certStand(st, c, nu).stand !== 'REVOKED').flatMap(c => c.beoordelingen || []));
  return { ok: true, magUitgeven: uitgeven,
    /* Alleen wie mag uitgeven ziet wat er klaarligt; de kwaliteitsautoriteit schorst en trekt in. */
    KLAAR: uitgeven ? Object.values(st.beoordelingen).filter(b => b.stand === 'PROVEN' && !gedekt.has(b.id) && relatieActief(st, b.persoon))
      .map(b => ({ beoordeling: b.id, persoon: b.persoon, vaardigheid: b.vaardigheid, vaardigheidNaam: naamVan(st, b.vaardigheid),
        geldigDagen: (st.vaardigheden[b.vaardigheid] || {}).geldigDagen || null,
        zelf: b.persoon === door, eigenOordeel: b.assessor === door && !!(st.vaardigheden[b.vaardigheid] || {}).kritiek })) : [],
    CERTIFICATEN: certs.map(c => ({ id: c.id, persoon: c.persoon, vaardigheden: (c.vaardigheden || []).map(v => naamVan(st, v)),
      stand: certStand(st, c, nu).stand, geldigTot: c.geldigTot || null })),
    nietZichtbaar: 'het bewijs en de criteria achter een beoordeling; die staan bij de assessor' };
}

function trainerWerk(st, door, nu) {
  const autoriteit = heeftBestuur(st, door, 'TRAINER_AUTHORITY');
  if (!autoriteit && !heeftBestuur(st, door, 'ACADEMY_OWNER'))
    return { ok: false, reden: 'u bent in deze organisatie geen trainerautoriteit of eigenaar' };
  const trainers = Object.entries(st.trainers).map(([persoon, t]) => Object.assign({ persoon }, t));
  const zonder = [];
  for (const [p, x] of Object.entries(st.personen))
    for (const [c, l] of Object.entries(x.leren || {})) if (!l.trainer && relatieActief(st, p))
      zonder.push({ persoon: p, curriculum: c, titel: (st.curricula[c] || {}).titel || c,
        kandidaten: trainers.filter(t => t.persoon !== p && trainerGeldig(st, t.persoon, c).ok).map(t => t.persoon) });
  /* Wie gecertificeerd trainer KAN worden: een geldig certificaat op een
     trainerschapsvaardigheid, en per curriculum of hij de vaardigheden zelf bewees. */
  const kandidaten = autoriteit ? Object.keys(st.relaties).filter(p => p !== door && relatieActief(st, p)
    && Object.values(st.certificaten).some(c => c.persoon === p && certTelt(certStand(st, c, nu).stand)
      && (c.vaardigheden || []).some(v => (st.vaardigheden[v] || {}).trainerschap)))
    .map(p => ({ persoon: p, trede: (st.trainers[p] || {}).trede || null,
      curricula: Object.values(st.curricula).filter(c => c.vaardigheden.every(v => ((st.personen[p] || {}).bewezen || {})[v])).map(c => c.id) })) : [];
  return { ok: true, magKwalificeren: autoriteit, treden: TRAINERLADDER,
    TRAINERS: trainers.map(t => ({ persoon: t.persoon, trede: t.trede, curricula: t.curricula.map(c => c.id) })),
    ZONDER_TRAINER: zonder, KANDIDATEN: kandidaten,
    nietZichtbaar: 'hoe ver een leerling is en wat zijn bewijs zegt; dat ziet zijn trainer' };
}

module.exports = { certificaatWerk, trainerWerk };
