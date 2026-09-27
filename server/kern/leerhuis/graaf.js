/* ============================================================================
   HET LEERHUIS -- de afhankelijkheden, zonder opslag.

   Een PROJECTIE en geen tweede database, in de vorm van
   kern/levensgraaf/graaf.js: de knopen en kanten worden bij elke vraag afgeleid
   uit de gebeurtenissen van EEN organisatie (./projectie.js). Er is geen
   `Knowledge Graph`-tabel naast de rest; een graaf die je apart moet bijwerken,
   loopt binnen een jaar achter op wat hij beschrijft.

   Twee vragen, en allebei deterministisch -- nooit een model:
     1. zit er een CYCLUS in de voorkennis? (een curriculum dat zichzelf als
        voorwaarde heeft, laat niemand ooit beginnen)
     2. wie en wat RAAKT een kennisverandering? (de opdracht, par. 17)
   ========================================================================== */
'use strict';

/* Geeft het eerste gevonden cyclische pad terug, of null.
   `vereist` is { id: [id, ...] } -- "om id te leren, eerst deze". */
function cyclus(vereist) {
  const kleur = new Map();   // afwezig = wit, 1 = bezig, 2 = klaar
  const pad = [];
  function loop(id) {
    kleur.set(id, 1); pad.push(id);
    for (const v of vereist[id] || []) {
      if (kleur.get(v) === 1) return pad.slice(pad.indexOf(v)).concat(v);
      if (!kleur.get(v)) { const c = loop(v); if (c) return c; }
    }
    kleur.set(id, 2); pad.pop();
    return null;
  }
  for (const id of Object.keys(vereist).sort()) {
    if (!kleur.get(id)) { const c = loop(id); if (c) return c; }
  }
  return null;
}

/* DE IMPACT VAN EEN KENNISWIJZIGING.

   Loopt van een kennisitem naar alles wat erop steunt, in vaste volgorde:
   kennis -> vaardigheid -> curriculum -> rol -> mensen, trainers en
   geschiktheidsbeleid. Het resultaat noemt elke geraakte knoop MET de kant
   waarlangs hij geraakt werd -- een lijst namen zonder waarom is een orakel
   (AUTHORITY.md grens 4).

   `st` is de projectie van ./projectie.js. `klasse` is de door de
   KNOWLEDGE_OWNER opgegeven impactklasse; de graaf verzint hem niet, want of een
   wijziging "alleen informatie" is of hercertificering vraagt, is een oordeel
   over de INHOUD en dat is mensenwerk. */
function impact(st, kennisId, klasse) {
  const vaardigheden = Object.values(st.vaardigheden).filter(v => (v.kennis || []).includes(kennisId));
  const vIds = new Set(vaardigheden.map(v => v.id));
  const curricula = Object.values(st.curricula).filter(c =>
    (c.kennis || []).includes(kennisId) || (c.vaardigheden || []).some(x => vIds.has(x)));
  const rollen = Object.values(st.rollen).filter(r => (r.vaardigheden || []).some(x => vIds.has(x)));
  const rIds = new Set(rollen.map(r => r.id));
  const cIds = new Set(curricula.map(c => c.id));

  const mensen = [];
  for (const [persoon, p] of Object.entries(st.personen)) {
    const waarom = [];
    for (const v of vIds) if (p.bewezen[v]) waarom.push('bewees vaardigheid ' + v);
    for (const r of p.rollen) if (rIds.has(r)) waarom.push('draagt rol ' + r);
    for (const c of Object.keys(p.leren)) if (cIds.has(c)) waarom.push('volgt curriculum ' + c);
    if (waarom.length) mensen.push({ persoon, waarom });
  }
  const trainers = Object.entries(st.trainers)
    .filter(([, t]) => (t.curricula || []).some(c => cIds.has(c.id)))
    .map(([persoon]) => ({ persoon, waarom: 'geeft een geraakt curriculum' }));
  const beleid = Object.values(st.beleid)
    .filter(b => (b.vaardigheden || []).some(x => vIds.has(x)))
    .map(b => ({ id: b.id, handeling: b.handeling, waarom: 'eist een geraakte vaardigheid' }));

  return {
    kennis: kennisId, klasse: klasse || null,
    vaardigheden: [...vIds].sort(), curricula: [...cIds].sort(), rollen: [...rIds].sort(),
    mensen, trainers, beleid,
    /* Trainers eerst: zij mogen geen verouderde kritieke training meer geven
       voordat ze zelf bij zijn (de opdracht, par. 17). */
    volgorde: ['trainers', 'mensen', 'beleid']
  };
}

module.exports = { cyclus, impact };
