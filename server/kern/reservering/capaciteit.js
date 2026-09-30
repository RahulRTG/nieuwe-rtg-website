/* Dezelfde capaciteit bij tonen en uitvoeren; de reserveringsbron blijft leidend. */
'use strict';
function plaatsen(zaak) { return (zaak.tables || []).reduce((n,t)=>n+(Number(t.seats)||0),0); }
/* Een tegenvoorstel houdt zijn plek vast zolang het geldt, en daarna niet meer:
   berekend, zonder opruimtaak (kern/ervaring/tafeluitzondering.js). */
function tegenvoorstelVerlopen(r) {
  return r.status==='tegenvoorstel'&&!(Date.parse(r.tegenvoorstel&&r.tegenvoorstel.geldigTot)>Date.now());
}
function bezet(reserveringen, code, datum, tijd) {
  return (reserveringen || []).filter(r=>r.supplierCode===code&&r.datum===datum&&r.tijd===tijd&&
    !['geannuleerd','geweigerd'].includes(r.status)&&!tegenvoorstelVerlopen(r)).reduce((n,r)=>n+(Number(r.personen)||0),0);
}
function past(zaak, reserveringen, datum, tijd, personen) {
  return bezet(reserveringen,zaak.code,datum,tijd)+personen<=plaatsen(zaak);
}
module.exports={plaatsen,bezet,past};
