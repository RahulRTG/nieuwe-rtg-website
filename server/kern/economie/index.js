/* RTG ECONOMIC CONTROL PLANE, de eerste laag: de werelden en de grens ertussen.

   ECONOMIE.md beschrijft de richting; dit is wat er van gebouwd is. Twee dingen,
   en ze horen bij elkaar:

     werelden   vier economieën die niet in elkaar overlopen (./werelden.js)
     firewall   wie mag wie iets in rekening brengen (./firewall.js), met het
                relatieregister eronder (./relaties.js) dat standaard leeg is

   WAAROM DEZE LAAG ONDER DE KOSTPRIJS HANGT EN NIET ANDERSOM. kern/kosten/ weet
   wat iets kost. Deze laag weet wie dat mag betalen. Dat zijn twee vragen, en
   ze horen op twee plekken: een meter die zelf beslist wie de rekening krijgt,
   is een meter die je niet meer kunt vertrouwen op zijn getal.

   WAT ER NOG NIET IS, staat in ECONOMIE.md met de reden erbij en niet hier als
   lege functie. Kort: er is nog geen economische graaf (identiteiten met
   ouders), geen provenance tot aan de providerfactuur, geen reconciliatie die
   een periode sluit, geen forecast en geen kostenroutering. Wat er wel is, is
   de grens -- en die is het enige stuk dat je niet later kunt toevoegen zonder
   de facturen van het jaar ervoor opnieuw te moeten uitleggen.

   Opslag: db.data.economie. */
'use strict';

const werelden = require('./werelden');

function maakEconomie({ db, save, klok }) {
  const nu = () => (typeof klok === 'function' ? klok() : new Date()).toISOString();
  function d() {
    if (!db.data.economie || typeof db.data.economie !== 'object') db.data.economie = {};
    return db.data.economie;
  }

  const ctx = { db, save, nu, d };
  const rel = require('./relaties')(ctx);
  ctx.relatieVoor = rel.relatieVoor;
  const fw = require('./firewall')(ctx);

  return { economie: {
    WERELDEN: werelden.WERELDEN, INFRA_WERELD: werelden.INFRA_WERELD,
    werelden: werelden.alle, wereldVan: werelden.wereldVan, wereld: werelden.wereld,
    factureerbaar: werelden.factureerbaar,
    relaties: rel.relaties, relatieZet: rel.relatieZet, relatieWeg: rel.relatieWeg,
    relatieVoor: rel.relatieVoor, relatiejournaal: rel.journaal,
    magBelasten: fw.magBelasten, magDragerBelasten: fw.magDragerBelasten
  } };
}

module.exports = maakEconomie;
module.exports.maakEconomie = maakEconomie;
