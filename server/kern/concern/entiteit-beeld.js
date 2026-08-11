/* CONCERN (deelmodule): HET BEELD VAN EEN ENTITEIT OP EEN DAG.

   Afgesplitst van ./entiteit.js toen die over de 10 kB ging. De naad loopt
   langs de vraag wie er SCHRIJFT: daar de handelingen die de entiteit
   veranderen (aanmaken, registreren, een onderneming aanwijzen), hier het
   samenstellen en lezen. Dezelfde snede die kern/onderneming/ al maakt tussen
   levensloop.js en beeld.js, en om dezelfde reden.

   DIT IS DE TIJDMACHINE ZOALS EEN SCHERM HEM ZIET. Geef een datum en je krijgt
   de entiteit zoals zij er TOEN bij stond -- niet zoals zij er nu bij staat.
   Dat is precies waarom de velden niet op het object staan maar als feiten in
   ./tijd.js. */
'use strict';

module.exports = (ctx) => {
  const { tijdOpDatum, tijdGeschiedenis } = ctx;
  const RV = require('../onderneming/rechtsvorm');

  /* Het beeld van een entiteit OP EEN DAG. Zonder datum: vandaag. Met een datum
     in het verleden krijg je de entiteit zoals zij er toen bij stond -- dat is
     de tijdmachine, en het is precies waarom de velden hier niet op het object
     staan. */
  function entiteitBeeld(e, op) {
    const stand = tijdOpDatum(e.id, op);
    const f = stand.feiten;
    /* VRAGEN NAAR EEN DAG WAAROP ER NOG NIETS GOLD GEEFT EEN LEEG BEELD, en dat
       leest als "deze entiteit heeft geen naam" terwijl het "toen wisten wij
       haar nog niet" is. Die twee horen niet hetzelfde te lezen. Een toets liep
       er als eerste tegenaan: een vandaag aangemaakte entiteit opvragen per
       vorig jaar gaf `naam: null` zonder enige aanwijzing waarom.

       Het is geen fout in de tijdmachine -- hij bewéért terecht niets over een
       dag waarover niemand iets heeft vastgelegd. Maar het antwoord hoort dat
       te zeggen in plaats van het aan de lezer over te laten. */
    const eerste = tijdGeschiedenis(e.id).reduce((a, x) => (!a || x.van < a ? x.van : a), null);
    const bestondNog = !eerste || !stand.op || stand.op >= eerste;
    const rvId = f.rechtsvorm ? f.rechtsvorm.waarde : null;
    const vorm = rvId ? RV.rechtsvormVan(rvId) : null;
    return {
      id: e.id, land: e.land, concern: e.concern || null,
      onderneming: e.onderneming || null,
      op: stand.op,
      bestondNog,
      vanaf: eerste,
      leeguitleg: bestondNog ? null
        : 'Op ' + stand.op + ' was er over deze entiteit nog niets vastgelegd; het eerste gegeven begint op ' + eerste + '. Dat is iets anders dan een entiteit zonder naam.',
      naam: f.naam ? f.naam.waarde : null,
      handelsnamen: (f.handelsnaam || []).map(x => x.waarde),
      rechtsvorm: rvId,
      rechtsvormLabel: vorm ? vorm.label : null,
      rechtspersoon: vorm ? !!vorm.rechtspersoon : null,
      zetel: f.zetel ? f.zetel.waarde : null,
      boekjaar: f.boekjaar ? f.boekjaar.waarde : null,
      registraties: (f.registratie || []).map(r => ({
        nummer: r.waarde, land: (r.extra || {}).land || e.land,
        register: (r.extra || {}).register || null, van: r.van, tot: r.tot, bron: r.bron })),
      fiscaal: (f.fiscaal || []).map(x => ({ soort: x.sleutel, waarde: x.waarde, bron: x.bron })),
      bestuurders: (f.bestuurder || []).map(x => ({
        wie: x.sleutel, rol: x.waarde, van: x.van, tot: x.tot,
        bevoegd: (x.extra || {}).bevoegd || null, tekenlimiet: (x.extra || {}).tekenlimiet ?? null, bron: x.bron })),
      aandeelhouders: (f.aandeelhouder || []).map(x => ({
        wie: x.sleutel, percentage: Number(x.waarde) || 0,
        klasse: (x.extra || {}).klasse || null, stemrecht: (x.extra || {}).stemrecht ?? null, bron: x.bron })),
      vergunningen: (f.vergunning || []).map(x => ({
        wat: x.waarde, sleutel: x.sleutel, van: x.van, tot: x.tot, bron: x.bron })),
      gestart: e.gestart
    };
  }


  return { entiteitBeeld };
};
