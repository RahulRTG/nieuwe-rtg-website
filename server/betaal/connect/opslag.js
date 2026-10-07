/* DE OPSLAG VAN DE PARTNERAFREKENINGEN: records, gezien-meldingen, bevindingen.

   Achter een interface met een handvol werkwoorden, zodat de dienst
   (./afrekening.js) niet weet of hij op db.data draait of op iets anders.

   DUURZAAM VOORDAT ER IETS NAAR BUITEN GAAT. De werkwoorden hieronder muteren
   het geheugen en plannen de gewone save(); `vast()` maakt wat er tot dan toe
   veranderde DUURZAAM (server/lib/duurzaam.js, op de aanroeperslijst van
   keuringsregel 47) en keert pas terug als de opslag het bevestigt. De dienst
   roept hem aan op de drie momenten waarop een verlies na een herstart geld
   kost: VOOR een aanroep bij Stripe (het opgehoogde pogingnummer en de stand
   moeten er staan, anders weet de veeg na een crash niet dat er iets is
   verstuurd), NA het antwoord van Stripe (het transfer- of payout-id), en
   voordat een melding als verwerkt wordt bevestigd (anders stuurt Stripe hem
   niet opnieuw en is de stand weg). Zonder `vastleggen` (een losse toets met
   een nep-db) is `vast()` de gewone save().

   De bevindingen GROEIEN AAN en worden nooit herschreven: een verschil tussen
   Stripe en het grootboek dat later verdwijnt, was er toch. */
'use strict';
const { fout } = require('./fout');

function maakOpslag({ db, save, vastleggen = null }) {
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
    effecten: () => Object.assign({}, bak().effecten),
    /* Alles wat hierboven in het geheugen veranderde, duurzaam. Gooit als de
       opslag het niet bevestigt: dan gaat er niets naar Stripe en krijgt een
       melding geen 200 (Stripe probeert het opnieuw). */
    async vast() {
      if (typeof vastleggen !== 'function') { save(); return; }
      const f = await vastleggen();
      if (f) throw fout('De afrekening kon niet duurzaam worden vastgelegd; er is niets verstuurd.', 'NIET_VASTGELEGD', 503, { nietVerstuurd: true });
    }
  };
}

module.exports = { maakOpslag };
