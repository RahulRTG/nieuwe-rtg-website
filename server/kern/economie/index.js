/* RTG ECONOMIC CONTROL PLANE, de eerste laag: de werelden en de grens ertussen.

   ECONOMIE.md beschrijft de richting; dit is wat er van gebouwd is. Twee dingen,
   en ze horen bij elkaar:

     werelden   vier economieën die niet in elkaar overlopen (./werelden.js),
                met ./identiteit.js voor de identiteit die zelf een entiteit is
                en dus niet de wereld van haar dragersoort draagt
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

const { datum: klokDatum } = require('../../lib/klok');

const werelden = require('./werelden');

function maakEconomie({ db, save, klok }) {
  /* De terugval is de HUISKLOK en niet het besturingssysteem. `new Date()` stond
     hier, en dat is precies de aanroep waar server/lib/klok.js voor bestaat: wie
     de tijd rechtstreeks aan het OS vraagt, doet niet mee aan RTG_KLOK en is dus
     niet te beproeven op een schrikkeldag, een zomertijdsprong of een maand die
     omslaat. In een boekhouding is die laatste geen theorie -- de periodesleutel
     JJJJ-MM hangt eraan. De injecteerbare `klok` blijft voorgaan, want een toets
     die een maandwissel naspeelt geeft er een mee. */
  const nu = () => (typeof klok === 'function' ? klok() : klokDatum()).toISOString();
  function d() {
    if (!db.data.economie || typeof db.data.economie !== 'object') db.data.economie = {};
    return db.data.economie;
  }

  const ctx = { db, save, nu, d };
  const rel = require('./relaties')(ctx);
  ctx.relatieVoor = rel.relatieVoor;
  /* VOOR de firewall: die vraagt in welke wereld een drager woont, en dat is
     een eigenschap van de identiteit en niet van haar dragersoort. */
  const ident = require('./identiteit')(ctx);
  ctx.wereldVanDrager = ident.wereldVanDrager;
  const fw = require('./firewall')(ctx);

  return { economie: {
    WERELDEN: werelden.WERELDEN, INFRA_WERELD: werelden.INFRA_WERELD,
    werelden: werelden.alle, wereldVan: werelden.wereldVan, wereld: werelden.wereld,
    factureerbaar: werelden.factureerbaar,
    wereldVanDrager: ident.wereldVanDrager, identiteiten: ident.alle,
    identiteitZet: ident.zet, identiteitWeg: ident.weg,
    relaties: rel.relaties, relatieZet: rel.relatieZet, relatieWeg: rel.relatieWeg,
    relatieVoor: rel.relatieVoor, relatiejournaal: rel.journaal,
    magBelasten: fw.magBelasten, magDragerBelasten: fw.magDragerBelasten
  } };
}

module.exports = maakEconomie;
module.exports.maakEconomie = maakEconomie;
