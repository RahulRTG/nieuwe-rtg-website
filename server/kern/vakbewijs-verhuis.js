/* Vakbewijs (deelmodule): DE EENMALIGE VERHUIZING VAN DE CONCERN-KWALIFICATIES.

   Een overgangsverhaal, en die horen een eigen bestand te hebben: het heeft een
   begin, een einde, en het draait straks nooit meer iets. Tussen de regels die
   elke dag draaien zou het blijven staan als code waarvan niemand meer weet
   waarom hij er is.

   WAT ER GEBEURT. kern/concern/scope-filters.js hield zijn eigen lijst
   kwalificaties bij (db.data.concern.kwalificaties): persoon, wat, van, tot,
   nummer, opent. Dat is dezelfde vraag als het vakbewijs -- wat kan deze mens
   aantoonbaar, en tot wanneer -- en twee plekken die dat vasthouden lopen uit
   elkaar op precies het punt dat ertoe doet (LAT-regel 4). Ze verhuizen dus
   naar ../vakbewijs.js, met een sleutel die zegt uit welke wereld de persoon
   komt.

   TWEE DINGEN DIE HIER BEWUST ZO ZIJN. De verhuizing draait bij de eerste
   LEZING en niet bij het opstarten, zodat een database die nooit een concern
   heeft gehad er ook nooit iets van merkt. En de oude lijst wordt LEEGGEMAAKT
   en niet met rust gelaten: zou hij blijven staan, dan is er alsnog een tweede
   plek die iets vasthoudt, en dan hebben we de regel omzeild in plaats van
   gevolgd. */
'use strict';

module.exports = ({ db, save, vandaag, sleutelConcern }) => {
  /* De concern-kwalificaties komen eenmalig hierheen. Dit draait bij de eerste
     lezing en niet bij het opstarten, zodat een database die nooit een concern
     heeft gehad er ook nooit iets van merkt. De oude lijst wordt LEEGGEMAAKT en
     niet verwijderd: zou hij blijven staan, dan is er alsnog een tweede plek die
     iets vasthoudt, en dan hebben we de regel omzeild in plaats van gevolgd. */
  return function verhuisConcern() {
    const c = db.data.concern;
    if (!c || !Array.isArray(c.kwalificaties) || !c.kwalificaties.length) return;
    for (const k of c.kwalificaties) {
      const sleutel = sleutelConcern(k.persoon);
      if (!sleutel || !k.wat) continue;
      if (db.data.vakbewijzen.some(v => v.sleutel === sleutel && v.wat === k.wat)) continue;
      db.data.vakbewijzen.push({
        sleutel, wat: k.wat, nummer: k.nummer || null,
        van: k.van || null, tot: k.tot || null,
        opent: Array.isArray(k.opent) ? k.opent.slice(0, 12) : [],
        /* De concernkant kende geen aftekening en heeft er ook geen nodig: daar
           legt een werkgever iets over zijn eigen personeel vast. Hij komt dus
           binnen als NIET afgetekend, en dat is geen degradatie maar de waarheid
           -- het scheelt dat een supplier-poort die wel een aftekening eist er
           niet per ongeluk op gaat steunen. */
        afgetekend: null, ingediend: k.van || vandaag(), door: 'concern'
      });
    }
    c.kwalificaties.length = 0;
    save();
    };
};
