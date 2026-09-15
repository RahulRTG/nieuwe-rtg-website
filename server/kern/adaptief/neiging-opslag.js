/* ============================================================================
   DE OPSLAG VAN ADAPTIEF RTG -- de bak, de actor en de schoonmaak.

   Apart van ./neiging.js langs de naad die kern/experience/opslag.js ook legt:
   hierin staat WAAR iets landt en onder welke sleutel, daarin staat WAT er
   wordt bewaard en wat het betekent. Twee redenen om te veranderen, twee
   bestanden -- en samen gingen ze over de tienkilobytegrens van keuringsregel
   13, een lijst die hoort te krimpen door een snede en niet door een
   uitzondering.

   Deze laag kent geen graden, geen doelen en geen ladder. Hij weet alleen hoe
   je bij de rijen van een actor komt.
   ========================================================================== */
'use strict';

module.exports = function maakOpslag({ db, crypto }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/adaptief',
    bezit: { adaptieveNeigingen: 'kaart' } });

  const wortel = () => eigen.bak('adaptieveNeigingen',
    bak => Object.assign(bak, { versie: 1, perActor: {}, gesteldPerActor: {} }));
  function bak() {
    const r = wortel();
    if (!r.perActor || typeof r.perActor !== 'object') r.perActor = {};
    /* WELKE VRAGEN AL ZIJN GESTELD hoort hier en niet bij de vraagmotor, om
       dezelfde reden dat ./vraag.js puur is: die motor mag niets over een mens
       weten. Het is per-actor toestand van deze laag, dus hij staat in dezelfde
       bak -- twee takken, een eigenaar. En het is een EIGEN tak en geen neiging
       met een raar onderwerp: "deze vraag is gesteld" is geen neiging, en wie
       dat door elkaar haalt krijgt het op de geheugenkaart te zien. */
    if (!r.gesteldPerActor || typeof r.gesteldPerActor !== 'object') r.gesteldPerActor = {};
    return r;
  }
  const actor = key => 'actor_' + crypto.createHash('sha256')
    .update(String(key || '')).digest('hex').slice(0, 20);
  /* EEN ONDERWERP IS EEN SLEUTEL EN GEEN VRIJE TEKST, en dat is hier een
     POSITIEVE lijst tekens en geen verboden-lijst -- dezelfde richting als
     AI-CONTEXT-01: bij een verbodenlijst glipt elk teken dat niemand heeft
     bedacht er vanzelf doorheen. Wat overblijft is wat ./vraag.js uitgeeft
     (`eten:japans`), en een aanroeper die er een zin in stopt houdt er geen
     zin aan over -- met opzet, want een onderwerp wordt VERGELEKEN. */
  const schoon = (s, n) => String(s == null ? '' : s)
    .replace(/[^a-zA-Z0-9:_ -]/g, '').trim().slice(0, n);
  const lijstVan = a => { const b = bak(); if (!Array.isArray(b.perActor[a])) b.perActor[a] = []; return b.perActor[a]; };

  return { bak, actor, schoon, lijstVan };
};
