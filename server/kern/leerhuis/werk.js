/* ============================================================================
   HET LEERHUIS -- wat er voor een assessor en een kenniseigenaar klaarligt
   (fase B-UI, het werkscherm).

   Twee leesvragen, allebei over DE LEZER zelf: wie geen assessor is, krijgt
   geen beoordelingen te zien, en wie geen kenniseigenaar is geen concepten.
   Ze beslissen niets. Of een handeling mag, zegt de handeling zelf
   (acties-oordeel.js, acties-kennis.js); deze module zegt alleen wat er ligt.

   MINSTE KENNIS PER LEZER (grondwet 21, zoals zicht.js):
   - een assessor ziet beoordelingen die op een assessor WACHTEN, en het bewijs
     alleen van een beoordeling die HIJ begon, en alleen voor die vaardigheid;
   - een beoordeling over hemzelf ziet hij hier niet: niemand beoordeelt
     zichzelf, dus dat werk ligt niet voor hem klaar;
   - een kenniseigenaar ziet concepten en wat er nodig is om ze te activeren,
     maar een concept dat hij zelf schreef draagt `eigen`, omdat hij dat niet
     zelf goedkeurt.
   ========================================================================== */
'use strict';

const { heeftBestuur } = require('./oordeel');
const { IMPACT, MACHINES, BESTUUR, RELATIESOORTEN, VAARDIGHEIDSNIVEAUS, ROLSOORTEN, LEERFASEN, LEERBEWIJS, STERKTE } = require('./standen');

function assessorWerk(st, door) {
  if (!heeftBestuur(st, door, 'ASSESSOR')) return { ok: false, reden: 'u bent in deze organisatie geen assessor' };
  const naam = (v) => (st.vaardigheden[v] || {}).naam || v;
  const alle = Object.values(st.beoordelingen);
  return {
    ok: true,
    OPEN: alle.filter(b => b.stand === 'REQUESTED' && b.persoon !== door)
      .map(b => ({ id: b.id, persoon: b.persoon, vaardigheid: b.vaardigheid, vaardigheidNaam: naam(b.vaardigheid), vorm: b.vorm, sinds: b.at })),
    LOPEND: alle.filter(b => b.stand === 'ASSESSING' && b.assessor === door).map(b => ({
      id: b.id, persoon: b.persoon, vaardigheid: b.vaardigheid, vaardigheidNaam: naam(b.vaardigheid), vorm: b.vorm,
      eis: (st.vaardigheden[b.vaardigheid] || {}).bewijsEis || null,
      bewijs: Object.values(st.bewijs).filter(x => x.persoon === b.persoon && x.vaardigheid === b.vaardigheid && !x.ongeldig)
        .map(x => ({ id: x.id, soort: x.soort, sterkte: x.sterkte, sinds: x.at, bron: x.bron || null }))
    })),
    nietZichtbaar: 'beoordelingen die een andere assessor begon, beoordelingen over uzelf, en bewijs buiten de vaardigheid die u beoordeelt'
  };
}

function kennisWerk(st, door) {
  if (!heeftBestuur(st, door, 'KNOWLEDGE_OWNER')) return { ok: false, reden: 'u bent in deze organisatie geen kenniseigenaar' };
  const uit = [];
  for (const k of Object.values(st.kennis))
    for (const v of Object.values(k.versies)) {
      if (v.stand !== 'DRAFT' && v.stand !== 'REVIEW') continue;
      uit.push({ id: k.id, versie: v.versie, titel: v.titel, domein: v.domein, tekst: v.tekst, bron: v.bron, stand: v.stand,
        eigen: v.auteur === door, herkomst: v.herkomst || null,
        bronNodig: v.herkomst === 'startpakket', impactNodig: !!k.actief, actieveVersie: k.actief });
    }
  /* De impactklassen komen mee, zodat het scherm geen eigen kopie van de lijst draagt. */
  return { ok: true, CONCEPTEN: uit, impactKlassen: IMPACT,
    nietZichtbaar: 'wie een concept schreef staat er niet bij; alleen of u het zelf was, want dat keurt u niet zelf goed' };
}

/* De curricula en waar ze heen kunnen. `naar` komt uit de overgangstabel
   (standen.js), zodat het scherm geen eigen kopie draagt; of een overgang MAG,
   zegt curriculumStand (er gaat geen concept-kennis naar ACTIVE). */
function curriculumWerk(st, door) {
  if (!heeftBestuur(st, door, 'CURRICULUM_OWNER') && !heeftBestuur(st, door, 'QUALITY_AUTHORITY'))
    return { ok: false, reden: 'u bent in deze organisatie geen curriculumeigenaar of kwaliteitsautoriteit' };
  const naam = (v) => (st.vaardigheden[v] || {}).naam || v;
  const uit = { ok: true, CURRICULA: Object.values(st.curricula).map(c => ({ id: c.id, titel: c.titel, versie: c.versie, stand: c.stand,
    vaardigheden: c.vaardigheden.map(naam), naar: MACHINES.curriculum.naar[c.stand] || [],
    kennisZonderActief: c.kennis.filter(k => !(st.kennis[k] || {}).actief) })),
  nietZichtbaar: 'wie een curriculum volgt en hoe ver hij is; dat ziet zijn trainer en zijn manager' };
  /* SCHRIJVEN doet alleen de curriculumeigenaar (acties-bouw.js); de kwaliteitsautoriteit
     verandert een stand en schrijft niets. Wat er te kiezen valt, komt van hier, zodat het
     scherm geen eigen kopie van de lijsten draagt. */
  if (!heeftBestuur(st, door, 'CURRICULUM_OWNER')) return Object.assign(uit, { magSchrijven: false });
  const concept = (k) => { const v = Object.values(k.versies).find(x => x.stand === 'DRAFT' || x.stand === 'REVIEW');
    return v ? { versie: v.versie, stand: v.stand, eigen: v.auteur === door } : null; };
  return Object.assign(uit, { magSchrijven: true,
    KEUZES: { niveaus: VAARDIGHEIDSNIVEAUS, rolsoorten: ROLSOORTEN, leerfasen: LEERFASEN, bewijssoorten: LEERBEWIJS, sterktes: STERKTE },
    VAARDIGHEDEN: Object.values(st.vaardigheden).map(v => ({ id: v.id, naam: v.naam })),
    KENNIS: Object.values(st.kennis).map(k => ({ id: k.id, titel: (k.versies[k.actief || Math.max(...Object.keys(k.versies).map(Number))] || {}).titel || k.id,
      actief: !!k.actief, concept: concept(k) })),
    ROLLEN: Object.values(st.rollen).map(r => ({ id: r.id, titel: r.titel })) });
}

/* Het beheer van de eigenaar: wie welke bestuursrol draagt (op codenaam, via
   namen.js), en de soorten die hij kan kiezen. Een mens aanwijzen gaat op
   codenaam met een reden (aanwijzen.js); dit zegt alleen wat er staat. */
function eigenaarWerk(st, door) {
  if (!heeftBestuur(st, door, 'ACADEMY_OWNER')) return { ok: false, reden: 'u bent geen eigenaar van dit leerhuis' };
  return { ok: true, relatieSoorten: RELATIESOORTEN, bestuursrollen: BESTUUR,
    BESTUUR: Object.entries(st.bestuur).filter(([, r]) => r.length).map(([persoon, rollen]) => ({ persoon, rollen })),
    /* De lopende relaties met hun rollen, om een rol in te trekken of iemand uit dienst te melden.
       `zelf`: dat doet een tweede eigenaar (acties-mens.js uitDienst). */
    RELATIES: Object.entries(st.relaties).filter(([, r]) => r.actief).map(([persoon, r]) => ({ persoon, soort: r.soort, zelf: persoon === door,
      rollen: ((st.personen[persoon] || {}).rollen || []).map(id => ({ id, titel: (st.rollen[id] || {}).titel || id })) })),
    nietZichtbaar: 'echte namen en sleutels; een mens wijst u aan op zijn codenaam, en elke opzoeking staat op zijn inzagekaart' };
}

module.exports = { assessorWerk, kennisWerk, curriculumWerk, eigenaarWerk };
