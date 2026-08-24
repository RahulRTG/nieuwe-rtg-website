/* Horeca OS (deellaag): BAR -- de werkstand van het barteam.

   De rekensom staat in kern/horeca/bar.js; hier staat de deur. Er wordt niets
   aangemaakt en niets afgevinkt: een stand zetten gaat over dezelfde deur als
   bij de keuken (/keuken/stand), zodat er nooit twee wegen zijn waarlangs een
   glas op "klaar" komt te staan. */
'use strict';

module.exports = (kern) => {
  const { app, schoon, supplierAuth, horeca } = kern;
  const { H } = horeca;
  const bar = require('../../../kern/horeca/bar')({ horeca, schoon });

  app.post('/api/supplier/horeca/bar', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const golven = bar.golven(h);
    res.json({
      ok: true,
      golven, stapel: bar.stapel(h),
      /* Twee tellingen en geen derde. `open` is het aantal GLAZEN dat nog
         gemaakt moet worden -- dus de aantallen opgeteld en niet de regels
         geteld. Een regel "2x gin-tonic" is een regel en twee glazen, en het
         scherm zegt "glazen te maken". Een getal dat iets anders telt dan zijn
         label zegt, is precies de fout die grens 7 verbiedt.
         `staat` is het aantal ronden waarvan het eerste glas al staat te
         wachten op de rest. Allebei na te tellen op de lijst zelf. */
      open: golven.reduce((n, g) => n + g.regels
        .filter(r => r.stand !== 'klaar').reduce((m, r) => m + r.aantal, 0), 0),
      staat: golven.filter(g => g.staat > 0).length,
      let: 'Golven staan op wachttijd, oudste eerst. De stapel is dezelfde ' +
        'verzameling glazen, per drank geteld: wat samen gemaakt kan worden. ' +
        'Er staat geen grens op hoe lang een drankje mag staan -- die is nergens vastgelegd.'
    });
  });
};
