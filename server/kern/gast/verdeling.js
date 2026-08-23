/* Hospitality Guest OS (deelmodule): DE VERDELING, van de kant van de GAST.

   DE REKENSOM STAAT HIER NIET MEER. Die is verhuisd naar
   kern/horeca/verdeling.js, en dat is geen opruiming maar een reparatie: de
   bediening rekende dezelfde tafel af met één naïeve knop (`perPersoon: n`,
   door drieën en klaar) terwijl de gast op zijn telefoon al per product, per
   persoon of op percentage kon verdelen. Twee antwoorden op "wie betaalt wat"
   aan één tafel. Zie de kop van de kernmodule.

   WAT HIER WEL BLIJFT: de verantwoording. Een verdeling die de gast maakt,
   staat op zijn naam in het auditspoor en zet de gastreis op "afrekenen". Doet
   de bediening het, dan staat haar naam erbij en blijft de reis waar hij is --
   dezelfde afspraak als bij betalen, waar de reis ook alleen door de gastdeur
   opschuift.

   Afgesplitst van ./betalen.js op de 10 kB-grens; de knip zit op de naad tussen
   "wie betaalt wat" en "er wordt betaald". */
'use strict';

module.exports = ({ save, horeca, orderlaag }) => {
  const { nu } = horeca;
  const { audit, zetReis } = orderlaag;
  const kern = require('../horeca/verdeling')({ horeca });

  /* ---------- de verdeling ---------- */
  function verdeel(zaakcode, rek, opgave) {
    const uit = kern.bereken(rek, opgave || {});
    if (uit.error) return uit;

    rek.verdeling = Object.assign({}, uit.verdeling, { at: nu() });
    audit(rek, { actor: 'gast', bron: 'gast', wat: 'verdeling',
      naar: rek.verdeling.wijze + ' over ' + rek.verdeling.delen.length });
    zetReis(rek, 'afrekenen');
    save();
    return { ok: true, verdeling: rek.verdeling };
  }

  // WIJZEN en knip blijven hier bereikbaar: bestaande aanroepers vragen erom
  return { WIJZEN: kern.WIJZEN, knip: kern.knip, verdeel };
};
