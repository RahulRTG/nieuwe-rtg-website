'use strict';

// De persoonseis is een eigen poort: iedere leveranciersroute gebruikt hem,
// ook die van de eigenaar. De kernlaag is laat gebonden omdat zij pas na de
// leverancierspoort wordt opgebouwd.
module.exports = ({ kern, demo }) => function persoonsPoort(supplier, actor) {
  if (!kern.persoonseis) {
    const eis = require('../kern/persoonseis').EISEN[String(supplier && supplier.type || '')];
    if (!eis || !eis.werk) return { ok: true };
    return { ok: false, error: 'De persoonscontrole is niet beschikbaar; dit genre gaat dan niet open.' };
  }
  // De gedeelde demo-inlog is geen persoon en bestaat buiten demostand niet.
  if (demo && kern.persoonseis.isGedeeldeInlog(actor)) return { ok: true, demo: true };
  return kern.persoonseis.magWerkenHier(supplier && supplier.type,
    kern.persoonseis.persoonVanActor(actor));
};
