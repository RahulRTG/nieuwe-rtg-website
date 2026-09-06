/* DE INTEGRATIEKAMER -- de standen van de vier externe kanalen, en de noodstop.

   WAT HIER WOONT EN WAAROM NIET IN DE ROUTE. De kamer zelf (welke kanalen aan
   staan, wie verantwoordelijk is, wat er getest is, het logboek) stond in
   server/routes/kantoren/integraties.js. Dat mocht zolang het bij een gewone
   write-behind save() bleef, maar de noodstop hoort duurzaam te zijn en die
   primitive komt niet in een route: de aanroeplijst van `npm run check` regel
   47 bestaat uit kern- en lib-bestanden, en dat is geen toeval maar de vorm.

   DE NOODSTOP IS DE REDEN DAT DIT BESTAND ER IS. FAALPROEF.json mat
   POST /api/office/techniek/integraties/noodstop onder `schrijf-verloren`:
   status 200 terwijl er niets was vastgelegd. Een boardroomlid zet elke
   koppeling uit, leest `noodstop: true` en loopt weg -- en na een herstart
   staat alles gewoon weer aan. GELDLAT.md kreeg daar op 6 september 2026 een
   derde been voor: een rem die een mens overhaalt.

   WAAROM HIJ ONDER `afdelingen` HANGT EN NIET ALS EIGEN KERNNAAM. Dat was de
   eerste opzet, en NORM.json floot hem terug: `kernBreedte` (kern-eigenschappen
   die routes aanraken) ging van 1556 naar 1557, en die ratel mag alleen omlaag.
   Terecht ook -- de kamer is een voorziening van het kantoor en geen zelfstandig
   domein. Hij komt dus binnen als `kern.afdelingen.integratiekamer`, waar het
   kantoor al woont, en de domeingrens hoeft geen naam bij te schrijven.

   DE HELPER WORDT UIT DE DB-MODULE GEHAALD en niet geinjecteerd, omdat `bijeen`
   en `inBundel` niet door deze bedradingsketen reizen. Acht kernmodules doen
   dat al; `save` blijft wel geinjecteerd, zodat een aanroeper die zijn eigen
   save meegeeft niet stilletjes wordt omzeild. */
'use strict';

module.exports = ({ db, save }) => {
  const dbModule = require('../../db');
  const vastleggen = require('../../lib/duurzaam')({
    bijeen: dbModule.bijeen, save, inBundel: dbModule.inBundel, bron: 'integratiekamer' });

  /* De kamer zoals hij op schijf staat, met de vier deelbakken gegarandeerd.
     LET OP: dit is INRICHTEN-OP-LEZEN -- de eerste lezer maakt de kamer aan.
     Dat is dezelfde klasse als de leespaden uit de kijk()-sweep en het staat op
     de lijst voor de aparte tak; het is hier ongewijzigd overgenomen zodat deze
     verhuizing niets anders doet dan verhuizen. */
  function data() {
    if (!db.data.integratiekamer || typeof db.data.integratiekamer !== 'object')
      db.data.integratiekamer = { schakelaars: {}, verantwoordelijk: {}, tests: {}, storingen: {}, verzoeken: [], log: [] };
    const s = db.data.integratiekamer;
    for (const k of ['schakelaars', 'verantwoordelijk', 'tests', 'storingen']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
    if (!Array.isArray(s.verzoeken)) s.verzoeken = [];
    if (!Array.isArray(s.log)) s.log = [];
    return s;
  }

  /* ALLES UIT, EN PAS BEVESTIGEN ALS HET VASTSTAAT.

     `zetRuntime` en `schrijfLog` komen van de route: de eerste kent de
     provider-sandboxen (mail en betaal), de tweede kent het verzoek en dus wie
     er drukte. Die twee horen niet hier -- deze module gaat over de kamer en
     over de belofte, niet over de kanalen.

     Geeft `null` terug als het vaststaat, of {status, error} van de duurzame
     helper. De aanroeper geeft dat rechtstreeks door; hij kan het niet per
     ongeluk negeren zoals een boolean. */
  async function noodstop(ids, zetRuntime, schrijfLog) {
    const s = data();
    for (const id of ids) { zetRuntime(id, false); s.schakelaars[id] = false; }
    schrijfLog();
    return vastleggen();
  }

  return { data, noodstop };
};
