/* DE OPSLAG VAN DE SPELLEN -- de wortel `spellen` met zijn twee vaste takken.

   WAAROM DIT EEN EIGEN BESTAND IS. Toen de spellenlaag achter kern/eigencollectie.js
   ging, kwam spellen.js op 10.319 byte uit en dat is over de grens van
   keuringsregel 13. Het bestand stond daarvoor op 10.238 -- twee byte eronder,
   dus elke wijziging had hem geraakt. De grens verplaatsen zou dat verbergen;
   deze naad haalt hem echt weg, en het is dezelfde naad als bij payroll,
   command en livinglab: waar de opslag woont, is geen orkestratie.

   POTJES EN WACHTRIJ ZIJN VASTE TAKKEN en geen losse collecties. Ze horen bij
   elkaar (een wachtrij levert een potje op) en worden altijd samen aangemaakt,
   dus staan ze onder een wortel. De zaai-callback draait alleen bij het
   AANMAKEN -- daarna is de vorm van de takken domeinkennis van spellen.js. */
'use strict';

module.exports = function maakSpelOpslag({ db }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/spellen', bezit: { spellen: 'kaart' } });
  const S = () => eigen.bak('spellen', (b) => { b.potjes = {}; b.wachtrij = {}; });

  /* LEZEN ZONDER SCHEPPEN, en waarom die tweede deur er hoort te zijn.

     `S()` materialiseert: hij legt de wortel `spellen` aan als hij er niet is.
     Voor schrijven is dat de bedoeling; voor OPZOEKEN is het een stille
     bijwerking. STAATPROEF.json zag `/api/member/spel/antwoord` keurig 404 geven
     ("deze uitnodiging is er niet meer") en ondertussen de collectie `spellen`
     aanleggen, en zette ROLLBACK daarop op GEZAKT. Er komt geen gegeven bij,
     alleen leeg meubilair -- en toch is het een echte bevinding: zolang een
     weigering iets verandert, kan geen meter leeg meubilair onderscheiden van
     een half uitgevoerde mutatie.

     `kijk()` is het bestaande leespad van kern/eigencollectie.js: dezelfde
     eigenaars- en vormcontrole, maar afwezig blijft afwezig. De twee vaste
     takken worden hier BEVROREN teruggegeven wanneer de wortel er nog niet is,
     zodat een lezer nooit per ongeluk in een weggegooid object duwt.

     WAAROM HIJ AAN `S` HANGT EN NIET NAAST HEM STAAT. De lezer moet bij
     spellen/lobby.js komen, en die krijgt zijn gereedschap uit de ctx van
     kern/spellen.js. Die ctx-regel uitbreiden kostte 14 byte, en spellen.js
     stond op 10236 van de 10240 die keuringsregel 13 toestaat -- vier byte
     speling. Dat bestand is ooit juist om die grens opgeknipt (zie de kop
     hierboven), dus hem er weer overheen duwen zou die naad ongedaan maken, en
     de grens verleggen zou het verbergen. Zo hangt de tweede deur aan de eerste,
     bij de opslag waar hij hoort, en groeit de orkestrator geen byte. */
  const LEEG = Object.freeze({});
  S.lees = () => {
    const b = eigen.kijk('spellen');
    return { potjes: b.potjes || LEEG, wachtrij: b.wachtrij || LEEG };
  };
  return { S };
};
