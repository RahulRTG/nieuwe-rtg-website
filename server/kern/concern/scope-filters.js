/* CONCERN (deelmodule): DE KWALIFICATIES.

   Afgesplitst van ./scope.js toen die over de 10 kB ging. De naad is echt:
   daar staat wat een rol GEEFT (recht plus reikwijdte), hier staat wat dat
   antwoord nog kan TEGENHOUDEN of doen opvallen.

   DE KWALIFICATIE IS EEN FILTER, GEEN ROL. Verloopt een rijbewijs, dan valt
   het bijbehorende werk weg en blijft de rol staan -- "u bent geen chauffeur
   meer" en "uw rijbewijs is verlopen" vragen om een ander gesprek.

   Zij staan hier los omdat ./scope.js ze LEEST maar niet bezit: een
   kwalificatie is geen recht en geen rol, en zij hoort dus ook niet in het
   bestand te wonen dat over rollen gaat. */
'use strict';

module.exports = (ctx) => {
  const { db, save, schoon, tijdVandaag } = ctx;

  /* ---- kwalificaties ----
     Wat iemand aantoonbaar kan of mag. Geen rol en geen recht: een filter dat
     ERVOOR hangt. Verloopt hij, dan valt het bijbehorende werk weg en blijft de
     rol staan -- dat is het verschil tussen "u bent geen chauffeur meer" en "uw
     rijbewijs is verlopen", en die twee vragen om een ander gesprek. */
  function bak() {
    if (!db.data.concern || typeof db.data.concern !== 'object') db.data.concern = {};
    if (!Array.isArray(db.data.concern.kwalificaties)) db.data.concern.kwalificaties = [];
    return db.data.concern.kwalificaties;
  }

  function kwalificatieZet(body) {
    const b = body || {};
    const persoon = schoon(b.persoon, 80);
    const wat = schoon(b.wat, 80);
    if (!persoon || !wat) return { status: 400, error: 'Wie heeft welke kwalificatie?' };
    const tot = b.tot && /^\d{4}-\d{2}-\d{2}$/.test(b.tot) ? b.tot : null;
    const bestaand = bak().find(k => k.persoon === persoon && k.wat === wat);
    const k = bestaand || { persoon, wat };
    k.van = b.van && /^\d{4}-\d{2}-\d{2}$/.test(b.van) ? b.van : tijdVandaag();
    k.tot = tot;
    k.nummer = schoon(b.nummer, 60) || null;
    k.opent = Array.isArray(b.opent) ? b.opent.slice(0, 12).map(x => schoon(x, 60)).filter(Boolean) : (k.opent || []);
    if (!bestaand) bak().push(k);
    save();
    return { ok: true, kwalificatie: k };
  }

  const kwalificatiesVan = (persoon) => {
    const d = tijdVandaag();
    return bak().filter(k => k.persoon === persoon)
      .map(k => Object.assign({}, k, { geldig: !(k.van && k.van > d) && !(k.tot && k.tot < d) }));
  };


  return { kwalificatieZet, kwalificatiesVan };
};
