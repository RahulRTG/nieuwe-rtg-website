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

module.exports = ({ db, save, vandaag, sleutelConcern, accounts }) => {
  /* De concern-kwalificaties komen eenmalig hierheen. Dit draait bij de eerste
     lezing en niet bij het opstarten, zodat een database die nooit een concern
     heeft gehad er ook nooit iets van merkt. De oude lijst wordt LEEGGEMAAKT en
     niet verwijderd: zou hij blijven staan, dan is er alsnog een tweede plek die
     iets vasthoudt, en dan hebben we de regel omzeild in plaats van gevolgd. */
  function concern() {
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
  }

  /* DE NUMMERS NAAR DE KLUIS. De tweede verhuizing, en de reden staat in
     ../vakbewijs.js: een BIG-registratie staat in een openbaar register, dus een
     nummer naast een codenaam in de operationele data voert die codenaam terug
     naar een echte naam.

     WAT HIER GEBEURT: elk nummer op een `lid:`-rij gaat naar het ledendossier
     (versleuteld, gebonden aan de rij) en wordt UIT de operationele rij gehaald.
     Dat laatste is het punt -- laten staan zou een tweede plek opleveren, en dan
     is er niets verhuisd maar alleen iets bijgezet.

     Concern-rijen blijven met opzet staan: die horen bij een codenaam zonder
     RTG-account, dus er is geen dossier om het in te leggen.

     Zonder `accounts` gebeurt er NIETS. Dat is geen stille overslag maar de
     enige veilige stand: het nummer half verplaatsen naar een kluis die er niet
     is, zou het weggooien. */
  function nummers() {
    if (!accounts || !accounts.getMemberState || !accounts.saveMemberState) return;
    let verplaatst = 0;
    for (const v of db.data.vakbewijzen) {
      if (!v || v.nummer == null) continue;
      const m = /^lid:(\d+)$/.exec(String(v.sleutel || ''));
      if (!m) continue;                       // concern: blijft waar hij staat
      const lid = Number(m[1]);
      try {
        const md = accounts.getMemberState(lid) || {};
        const bus = md.vakbewijsNummers && typeof md.vakbewijsNummers === 'object' ? md.vakbewijsNummers : {};
        if (!bus[v.wat]) bus[v.wat] = v.nummer;
        md.vakbewijsNummers = bus;
        accounts.saveMemberState(lid, md);
        delete v.nummer;
        verplaatst++;
      } catch (e) { /* dit account is er niet meer; de rij blijft dan zoals hij is */ }
    }
    if (verplaatst) save();
  }

  return { concern, nummers };
};
