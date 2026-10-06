/* DE OPSLAG VAN DE PARTNERAFREKENINGEN: records, gezien-meldingen, bevindingen.

   Achter een interface met vijf werkwoorden, zodat de dienst (./afrekening.js)
   niet weet of hij op db.data draait of op iets anders. De standaard is
   db.data met save(); wie de afrekening op de duurzame weg wil hebben
   (db/duurzaam.js, keuringsregel 47 bewaakt die aanroeperslijst), vervangt deze
   module door een met dezelfde vijf werkwoorden -- dat is een besluit voor de
   geldlaag en staat als integratiepunt in het eindverslag.

   De bevindingen GROEIEN AAN en worden nooit herschreven: een verschil tussen
   Stripe en het grootboek dat later verdwijnt, was er toch. */
'use strict';

function maakOpslag({ db, save }) {
  const bak = () => {
    if (!db.data.connectAfrekeningen) db.data.connectAfrekeningen = { records: {}, gezien: {}, bevindingen: [], effecten: {} };
    const b = db.data.connectAfrekeningen;
    for (const [k, v] of Object.entries({ records: {}, gezien: {}, bevindingen: [], effecten: {} })) if (!b[k]) b[k] = v;
    return b;
  };
  return {
    haal: id => bak().records[id] || null,
    alle: () => Object.values(bak().records),
    bewaar: rec => { bak().records[rec.id] = rec; save(); return rec; },
    /* Een providermelding die al verwerkt is, wordt niet nog eens verwerkt. Op
       event-id, want Stripe stuurt dezelfde melding bij een time-out opnieuw. */
    gezien: eventId => !!bak().gezien[eventId],
    markeer: (eventId, wat) => { bak().gezien[eventId] = { op: new Date().toISOString(), wat }; save(); },
    bevinding: b => { bak().bevindingen.push(Object.assign({ op: new Date().toISOString() }, b)); save(); },
    bevindingen: () => bak().bevindingen.slice(),
    /* Het EFFECTJOURNAAL. Geen grootboek: het legt vast welke economische
       sleutel aan de grootboekkoppeling is AANGEBODEN en wat die terugzei, zodat
       de reconciliatie kan zien of iedere afgerekende uitbetaling precies een
       effect heeft. */
    effect: (sleutel, rij) => { const e = bak().effecten; if (!e[sleutel]) { e[sleutel] = rij; save(); } return e[sleutel]; },
    effecten: () => Object.assign({}, bak().effecten)
  };
}

module.exports = { maakOpslag };
