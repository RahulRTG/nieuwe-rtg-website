/* Horeca OS (deellaag): DE WERKLIJST -- de deur naar PDA SERVICE.

   De rekensom staat in kern/horeca/werklijst.js; hier staat alleen de poort en
   de markering "van mij". Dat laatste is bewust GEEN filter: wie zijn eigen
   opgepakte taken niet terugziet tussen die van de rest, loopt er alsnog twee
   keer heen -- dezelfde les als op de paslijst hiernaast.

   ER IS EEN DEUR EN GEEN TWEEDE WAARHEID. Alles wat hier uitkomt is een
   projectie op de rekeningen en de verzoeken die er al staan. Deze laag maakt
   niets aan, verandert niets en vinkt niets af; handelen doe je op de deuren
   die er al zijn (verzoeken/zet, pas/pak, pas/uit, rekening/regel). Dat is
   opzet: een tweede plek waar een taak "gedaan" kan worden, is een tweede
   plek waar hij kan blijven hangen. */
'use strict';

module.exports = (kern) => {
  const { app, schoon, supplierAuth, horeca, verzoeklaag } = kern;
  const { H } = horeca;
  const werk = require('../../../kern/horeca/werklijst')({ horeca, schoon, verzoeklaag });

  app.post('/api/supplier/horeca/werklijst', supplierAuth, (req, res) => {
    const ik = req.actor.name;
    const uit = werk.werklijst(H(req.supplier.code), req.supplier.code, { modus: req.body.modus });
    const merk = (t) => Object.assign({}, t, { vanMij: !!(t.door && t.door === ik) });
    res.json(Object.assign({ ok: true }, uit, {
      nu: uit.nu.map(merk), open: uit.open.map(merk),
      ik: ik
    }));
  });
};
