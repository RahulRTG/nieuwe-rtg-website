/* DE KERN SAMENSTELLEN -- deel 5g: RTG Vrijheid (VRIJHEID.md).

   Een eigen deel om dezelfde reden als ./kernlaag5f.js: deze laag hangt onder
   EEN naam in de kern, kern.vrijheid, en niet als losse functies. De kern gaat
   als FUNCTIE mee, want het teambeeld leest accounts, het rooster, het
   dienstverband en het vakbewijs op het moment van vragen -- niet op het moment
   van opstarten, als nog niet elke laag erin staat.

   De routes staan in server/routes/vrijheid/; dit maakt de motor, zijn opslag,
   het teambeeld en de brug naar het verzuimregister beschikbaar. */
'use strict';

module.exports = (kern, hulp) => {
  const { db, save, bijeen, inBundel } = hulp;
  /* DE BRONNEN MOETEN ER NU AL ZIJN. Het teambeeld leest ze laat, maar een
     ontbrekende naam zou pas bij de eerste vraag opvallen, als een TypeError
     midden in een besluit over iemands vrije tijd. Dus bij het opstarten
     nagelopen: ontbreekt er een, dan start de server niet en staat erbij welke.
     Elke servertoets vangt dat, ook zonder route. */
  const nodig = ['scheduleFor', 'findSupplier', 'vestigingVanUnit', 'employmentVanPersoon', 'vakbewijzenVan',
    'makeSupplierCode', 'ensureSupplierDefaults'];
  const mist = nodig.filter(n => typeof kern[n] !== 'function');
  for (const n of ['listStaff', 'findByLogin', 'createAccountStaff', 'staffByMember'])
    if (!kern.accounts || typeof kern.accounts[n] !== 'function') mist.push('accounts.' + n);
  if (!kern.afdelingen || !Array.isArray(kern.afdelingen.KAMER_IDS)) mist.push('afdelingen.KAMER_IDS');
  if (!kern.economie || typeof kern.economie.identiteitZet !== 'function') mist.push('economie.identiteitZet');
  /* De brug naar de strook en de planning (kern/vrijheid/verzuimbrug.js). */
  const vz = kern.payrollOS && kern.payrollOS.verzuim;
  for (const n of ['meld', 'bronWeg', 'heeftBron']) if (!vz || typeof vz[n] !== 'function') mist.push('payrollOS.verzuim.' + n);
  if (mist.length) throw new Error('kernlaag5g (RTG Vrijheid): het teambeeld mist ' + mist.join(', ') +
    ' in de kern. Hangt deze laag te vroeg, of is een bron hernoemd?');
  /* RTG zelf als werkgever (kern/vrijheid/rtghuis.js) hangt BINNEN kern.vrijheid
     (kern.vrijheid.rtghuis) en niet als eigen kernnaam: hij bestaat alleen
     omdat deze laag moet weten waar het beleid van RTG geldt, en `kernBreedte`
     in NORM.json mag alleen omlaag. */
  kern.vrijheid = require('../kern/vrijheid/huis')({ db, save, bijeen, inBundel, kern: () => kern });
};
