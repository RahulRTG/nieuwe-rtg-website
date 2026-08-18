/* CONCERN (deelmodule): DE KWALIFICATIES.

   Afgesplitst van ./scope.js toen die over de 10 kB ging. De naad is echt:
   daar staat wat een rol GEEFT (recht plus reikwijdte), hier staat wat dat
   antwoord nog kan TEGENHOUDEN of doen opvallen.

   DE KWALIFICATIE IS EEN FILTER, GEEN ROL. Verloopt een rijbewijs, dan valt
   het bijbehorende werk weg en blijft de rol staan -- "u bent geen chauffeur
   meer" en "uw rijbewijs is verlopen" vragen om een ander gesprek.

   Zij staan hier los omdat ./scope.js ze LEEST maar niet bezit: een
   kwalificatie is geen recht en geen rol, en zij hoort dus ook niet in het
   bestand te wonen dat over rollen gaat.

   DE OPSLAG IS SINDS DE PERSOONSEIS NIET MEER VAN DIT BESTAND. Toen het
   leverancierskanaal dezelfde vraag kreeg -- wat kan deze mens aantoonbaar, en
   tot wanneer -- stonden er bijna twee stores naast elkaar met hetzelfde
   antwoord. Die zouden uiteenlopen op precies het punt dat ertoe doet: het
   moment waarop iets vervalt (LAT-regel 4). Dus draagt kern/vakbewijs.js nu de
   rij, en blijft hier alleen wat de concernkant EIGEN is: de vorm van de vraag
   (`persoon`, niet `sleutel`) en het antwoord dat ./scope.js verwacht.

   WAT DAARBIJ NIET IS VERANDERD, EN MET OPZET NIET. De concernkant kent geen
   aftekening door RTG. Een werkgever legt hier iets vast over zijn eigen
   mensen, en dat is zijn zaak -- RTG is daar geen keurmeester. Een supplier-
   poort die wel een aftekening eist, gaat daarom nooit per ongeluk op een
   concernrij steunen: die vraagt met `aftekening: true`. */
'use strict';

module.exports = (ctx) => {
  const { db, save, schoon, tijdVandaag } = ctx;

  /* De store, met de concern-sleutelvorm eromheen. De helpers hieronder zijn
     dun met opzet: hoe langer deze laag, hoe groter de kans dat er alsnog een
     tweede regel over geldigheid ontstaat. */
  const store = require('../vakbewijs')({ db, save, schoon, tijdVandaag });
  const { sleutelConcern } = store;

  function kwalificatieZet(body) {
    const b = body || {};
    const persoon = schoon(b.persoon, 80);
    const wat = schoon(b.wat, 80);
    if (!persoon || !wat) return { status: 400, error: 'Wie heeft welke kwalificatie?' };
    const r = store.vakbewijsZet(sleutelConcern(persoon), b);
    if (r.error) return r;
    return { ok: true, kwalificatie: naarKwalificatie(r.vakbewijs, persoon) };
  }

  const kwalificatiesVan = (persoon) =>
    store.vakbewijzenVan(sleutelConcern(persoon)).map(v => naarKwalificatie(v, persoon));

  /* Terug naar de vorm die ./scope.js en routes/concern/mensen.js kennen. De
     velden die de concernkant nooit had (aftekening, intrekking) gaan hier niet
     mee: ze zouden een betekenis suggereren die deze wereld niet kent. */
  function naarKwalificatie(v, persoon) {
    /* Het nummer komt apart op, want ../vakbewijs.js houdt hem sinds de
       kluis-verhuizing uit de leesbare vorm van een rij. Voor een concernrij
       verandert er niets: die heeft geen RTG-account om een dossier aan te
       hangen, dus vakbewijsNummer() leest hem gewoon uit de rij zelf. */
    return { persoon, wat: v.wat, nummer: store.vakbewijsNummer(sleutelConcern(persoon), v.wat) || null,
      van: v.van || null, tot: v.tot || null, opent: v.opent || [], geldig: v.geldig };
  }

  return { kwalificatieZet, kwalificatiesVan };
};
