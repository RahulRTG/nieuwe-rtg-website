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
  /* EEN AANBOD DAT ALLEEN OP EEN VAST SCHERM STAAT, KOMT NIET AAN. Wie een wijk
     aangeboden krijgt, staat op dat moment met een PDA in zijn hand -- dus reist
     het AANTAL mee in dit antwoord, en de handeling blijft waar hij hoort (de
     vloer). Geteld uit dezelfde lijst als daar; geen tweede waarheid. */
  const over = require('../../../kern/horeca/wijk-overdracht')({ horeca, schoon });

  app.post('/api/supplier/horeca/werklijst', supplierAuth, (req, res) => {
    const ik = req.actor.name;
    const uit = werk.werklijst(H(req.supplier.code), req.supplier.code, {
      modus: req.body.modus,
      /* De wijklens staat NAAST de modus en niet erin: de modus filtert op soort
         werk, de wijk op wiens tafel het is. Samengevoegd zou "runner in mijn
         wijk" onmogelijk zijn, en dat is juist een bestaande werkstand. */
      wijk: req.body.wijk,
      staffId: req.actor.staffId == null ? null : String(req.actor.staffId)
    });
    const merk = (t) => Object.assign({}, t, { vanMij: !!(t.door && t.door === ik) });
    const staffId = req.actor.staffId == null ? null : String(req.actor.staffId);
    res.json(Object.assign({ ok: true }, uit, {
      nu: uit.nu.map(merk), open: uit.open.map(merk),
      voorMij: staffId == null ? 0
        : over.lijst(H(req.supplier.code)).filter((o) => String(o.naarId) === staffId).length,
      ik: ik
    }));
  });
};
