/* ============================================================================
   De Trust Fabric, laag 1: de bedrading van de blootstellingsmeter.

   Dun met opzet. register.js, blootstelling.js en gewoonte.js zijn pure
   functies die met verzonnen invoer te ijken zijn; dit bestandje is het enige
   dat een opslag kent, en het doet verder niets.

   TWEE WERKWOORDEN, EN DE VOLGORDE ERTUSSEN IS DE HELE BEVEILIGING:

     weeg(actor, soort, aantal)      VOOR de handeling -- meten, niets bewaren
     voltooid(actor, soort, aantal)  NA de handeling  -- pas dan telt hij mee

   Wie `voltooid` aanroept voordat de handeling is gelukt, opent de aanval die
   in gewoonte.js beschreven staat: dan verzet een aanvaller zijn eigen normaal
   met pogingen die allemaal zijn tegengehouden. Daarom staan het meten en het
   onthouden in twee functies en niet in een.

   LAAG 1 MEET EN BLOKKEERT NIET. Er is nog geen step-up (laag 3), en een
   drempel zonder tweede moment zou alleen maar een deur dichtgooien met een
   getal erbij. Wat deze laag oplevert is het GETAL waar laag 3 op staat, en
   dat getal reist mee in het antwoord zodat een scherm het nu al kan tonen.
   ========================================================================== */
'use strict';

const blootstelling = require('./blootstelling');
const gewoonte = require('./gewoonte');
const register = require('./register');

module.exports = ({ db, save }) => {
  /* De bak hangt buiten de werkruimtes, en dat is een besluit: een gewoonte is
     een gegeven OVER een actor en geen inhoud VAN een werkruimte. Stond hij
     erin, dan reisde hij mee in de uitvoer van die werkruimte -- en dan zou een
     tenant bij het vertrek een gedragsreeks van zijn mensen meekrijgen die
     nooit voor hem bedoeld was. Dezelfde les als bij de herstelproefruimtes. */
  const bak = () => (db.data.vertrouwen = db.data.vertrouwen || { gewoonte: {} });

  function weeg(actor, soort, aantal) {
    return blootstelling.meet({ soort, aantal }, gewoonte.lees(bak(), actor, soort));
  }

  /* Een catalogus (soort, aantal, checksum) omrekenen naar een omvang. Deze
     regel staat hier en niet bij de aanroeper: hoe je een uitvoer TELT is een
     eigenschap van de meter, en twee plekken die dat elk anders doen leveren
     twee verschillende omvangen voor dezelfde handeling (LAT.md regel 4). */
  function weegCatalogus(actor, soort, catalogus) {
    const n = (catalogus || []).reduce((t, c) => t + (Number(c && c.aantal) || 0), 0);
    return weeg(actor, soort, n);
  }

  function voltooid(actor, soort, aantal) {
    const n = gewoonte.noteer(bak(), actor, soort, aantal);
    if (n !== null) save();
    return n;
  }

  /* Voor het vergeetrecht en de uitgang: een gewoonte hoort te verdwijnen met
     de actor. Blijft hij staan, dan overleeft het profiel de persoon. */
  function vergeet(actor) {
    const weg = gewoonte.vergeet(bak(), actor);
    if (weg) save();
    return weg;
  }

  return { weeg, weegCatalogus, voltooid, vergeet, register, NIET_GEDEKT: gewoonte.NIET_GEDEKT };
};
