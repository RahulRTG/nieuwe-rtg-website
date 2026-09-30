/* Dezelfde capaciteit bij tonen en uitvoeren; de reserveringsbron blijft leidend. */
'use strict';
function plaatsen(zaak) { return (zaak.tables || []).reduce((n,t)=>n+(Number(t.seats)||0),0); }
function bezet(reserveringen, code, datum, tijd) {
  return (reserveringen || []).filter(r=>r.supplierCode===code&&r.datum===datum&&r.tijd===tijd&&
    !['geannuleerd','geweigerd'].includes(r.status)).reduce((n,r)=>n+(Number(r.personen)||0),0);
}
function past(zaak, reserveringen, datum, tijd, personen) {
  return bezet(reserveringen,zaak.code,datum,tijd)+personen<=plaatsen(zaak);
}
module.exports={plaatsen,bezet,past};
