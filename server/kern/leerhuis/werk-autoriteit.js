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
const { TRAINERLADDER, MACHINES } = require('./standen');

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

/* Kwaliteit: bezwaren, beoordelingen ongeldig verklaren, en geschiktheidsbeleid.
   De beoordeling achter een bezwaar (uitkomst, criteria, herstelpad) ziet alleen
   wie de review op zich nam, en pas dan -- zoals het bewijs bij een assessor.
   Wie een oordeel zelf gaf, krijgt het hier niet om te wegen (`eigenOordeel`). */
function kwaliteitWerk(st, door) {
  const kwaliteit = heeftBestuur(st, door, 'QUALITY_AUTHORITY');
  const beleid = kwaliteit || heeftBestuur(st, door, 'ACADEMY_OWNER');
  if (!beleid) return { ok: false, reden: 'u bent in deze organisatie geen kwaliteitsautoriteit of eigenaar' };
  const bezwaren = kwaliteit ? Object.values(st.bezwaren).filter(z => ['REVIEW_REQUEST', 'INDEPENDENT_REVIEW'].includes(z.stand)).map(z => {
    const b = st.beoordelingen[z.beoordeling] || {};
    const reviewer = z.stand === 'INDEPENDENT_REVIEW' && z.reviewer === door;
    return { id: z.id, persoon: b.persoon, vaardigheidNaam: naamVan(st, b.vaardigheid), stand: z.stand, reden: z.reden, sinds: z.at,
      eigenOordeel: b.assessor === door, anderReviewer: z.stand === 'INDEPENDENT_REVIEW' && z.reviewer !== door,
      naar: MACHINES.bezwaar.naar[z.stand] || [],
      oordeel: reviewer ? { stand: b.stand, criteria: b.criteria || null, herstel: b.herstel || null } : null };
  }) : [];
  const ongeldig = kwaliteit ? Object.values(st.beoordelingen).filter(b => ['PROVEN', 'NOT_YET_PROVEN', 'INCONCLUSIVE'].includes(b.stand) && b.assessor !== door)
    .map(b => ({ id: b.id, persoon: b.persoon, vaardigheidNaam: naamVan(st, b.vaardigheid), stand: b.stand, sinds: b.at })) : [];
  return { ok: true, magKwaliteit: kwaliteit, BEZWAREN: bezwaren, ONGELDIG: ongeldig,
    BELEID: Object.values(st.beleid).map(b => ({ id: b.id, handeling: b.handeling, rol: b.rol ? ((st.rollen[b.rol] || {}).titel || b.rol) : null,
      vaardigheden: b.vaardigheden.map(v => naamVan(st, v)), certificaat: b.certificaat, goedgekeurd: !!b.goedgekeurd, eigen: b.voorgesteldDoor === door })),
    KEUZES: { vaardigheden: Object.values(st.vaardigheden).map(v => ({ id: v.id, naam: v.naam })), rollen: Object.values(st.rollen).map(r => ({ id: r.id, titel: r.titel })) },
    nietZichtbaar: 'de beoordeling achter een bezwaar, tot u de review op u neemt; en oordelen die u zelf gaf' };
}

module.exports = { certificaatWerk, trainerWerk, kwaliteitWerk };
