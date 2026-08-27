/* ============================================================================
   HET OPSLAGCONTRACT VAN MOBILITEIT -- de enige deur van dit domein naar db.data.

   Vierde domein achter een contract, en het grootste tot nu toe: 109
   aanraakpunten over twintig bestanden, tegen 28 bij payroll. Het is ook het
   rommeligste, en dat verdient een woord, want het is de reden dat dit contract
   iets oplost dat de andere drie niet hadden.

   HIER WAS DE VORM NIET AF TE LEZEN. Payroll had elf keurige bak()-functies, elk
   met dezelfde twee regels. Dit domein heeft ensureX()-functies naast
   rechtstreeks gebruik verspreid door de methodes, en de vormcontrole staat op
   de ene plek als Array.isArray en op de andere als typeof === 'object'. Welke
   vorm een collectie HEEFT was dus niet ergens opgeschreven -- het stond
   verspreid over vijftien plekken, en wie een zestiende toevoegde raadde. Het
   register hieronder is uit die code AFGELEID en niet verzonnen; dat is een
   eigen soort winst, los van de verhuisbaarheid.

   DRIE VREEMDE LEZERS, EN DAT IS ER EEN MEER DAN PAYROLL HEEFT. Ze staan apart
   in `vreemd`, allemaal alleen lezend. Dat zijn de draden waar dit domein aan
   een ander hangt, en wie mobiliteit ooit los wil trekken leest hier wat dat
   kost in plaats van het te moeten ontdekken.

   OVER DE VORM VAN DIT CONTRACT. Payroll bezit losse collecties op het hoogste
   niveau, concern en veiligheid een wortel met takken. Dit domein lijkt op
   payroll: vijftien collecties op het hoogste niveau, allemaal onder het
   voorvoegsel mob. Daarmee staat de teller op twee tegen twee, en dat is nog
   steeds te weinig om een gedeelde opslagklasse op te bouwen -- DEVELOPERCLOUD.md
   par. 2 en de meting in OBJECTMODEL.json zeggen allebei dat zo'n type gevonden
   moet worden en niet verklaard. Wat gedeeld wordt is de DISCIPLINE en de
   handhaving in keuringsregel 53. Niet de code.
   ========================================================================== */
'use strict';

/* ----------------------------------------------------------------------------
   WAT ER NIET IN ZIT, MET DE REDEN.
   ------------------------------------------------------------------------- */
const NIET_GEBOUWD = {
  schema: 'Vijftien collecties tegelijk een schema geven vraagt per collectie een eigen ronde. ' +
    'Een half schema keurt goed wat het niet kent, en dat is erger dan geen schema.',
  validatie: 'Hangt aan het schema en komt er niet voor.',
  bevoegdheid: 'Zit vandaag bij de ROUTE en bij de leverancierspoort, niet bij de opslag. ' +
    'Hem hierheen halen is een besluit over de Authority Graph.',
  gebeurtenissen: 'server/bus.js vervoert wel maar spreekt geen taal (OS.md par. 4).',
  bewaartermijn: 'mobDiensten kapt op DIENST_MAX en dat is een GRENS, geen bewaarbeleid. ' +
    'Rittijden van een chauffeur zijn een persoonsgegeven; de bewaarlaag kent dit domein nog niet.'
};

/* ----------------------------------------------------------------------------
   HET REGISTER. Vijftien collecties, met de vorm zoals de code hem vandaag
   afdwingt -- afgeleid uit de bestaande ensure-functies en niet gekozen.
   ------------------------------------------------------------------------- */
const REGISTER = {
  mobOpdrachten:        { soort: 'lijst', wat: 'vervoersopdrachten: de kern van dit domein' },
  mobReizen:            { soort: 'lijst', wat: 'reizen van een lid, nieuwste eerst' },
  mobKaartjes:          { soort: 'lijst', wat: 'kaartjes en abonnementen' },
  mobPendels:           { soort: 'lijst', wat: 'pendeldiensten van een werkgever' },
  mobOvereenkomsten:    { soort: 'lijst', wat: 'overeenkomsten met een vervoerder' },
  mobDiensten:          { soort: 'lijst', wat: 'gereden diensten (CDT), gekapt op DIENST_MAX' },
  mobStoringen:         { soort: 'lijst', wat: 'gemelde storingen per vervoerder' },
  mobAssets:            { soort: 'lijst', wat: 'voertuigen en materieel' },
  mobCdtExports:        { soort: 'lijst', wat: 'uitgevoerde CDT-uitdraaien' },
  mobModules:           { soort: 'kaart', wat: 'welke modules een vervoerder aan heeft staan' },
  mobBeleid:            { soort: 'kaart', wat: 'reisbeleid per organisatie' },
  mobCdtRegime:         { soort: 'kaart', wat: 'rij- en rusttijdenregime per vervoerder' },
  mobCdtDienstverlener: { soort: 'kaart', wat: 'wie de CDT-administratie voert' },
  mobMatching:          { soort: 'kaart', wat: 'instellingen voor het koppelen van vraag en aanbod' },
  mobFavorieten:        { soort: 'kaart', wat: 'opgeslagen plekken per lid' }
};

module.exports = function maakOpslag({ db }) {
  if (!db || !db.data) throw new Error('mobiliteit/opslag: zonder db.data is er niets om te bewaren');

  function eis(naam) {
    if (!REGISTER[naam]) {
      throw new Error('mobiliteit/opslag: "' + naam + '" staat niet in het register. ' +
        'Een collectie die nergens is opgeschreven, kan niemand verhuizen -- zet hem erbij ' +
        'met zijn soort en wat erin zit.');
    }
  }
  function klopt(naam, waarde) {
    return REGISTER[naam].soort === 'lijst'
      ? Array.isArray(waarde)
      : (waarde && typeof waarde === 'object' && !Array.isArray(waarde));
  }

  /* DE ENIGE PLEK WAAR EEN COLLECTIE ONTSTAAT. Dit verving vijftien
     ensure-functies die de vorm elk op hun eigen manier controleerden. */
  function bak(naam, zaai) {
    eis(naam);
    if (!klopt(naam, db.data[naam])) {
      db.data[naam] = REGISTER[naam].soort === 'lijst' ? [] : {};
      /* `zaai` draait alleen bij het AANMAKEN, en de inhoud blijft bij de
         aanroeper: wat een standaardgewicht is, is domeinkennis. Een opslaglaag
         die dat weet, is de vermenging die dit contract moet voorkomen. */
      if (typeof zaai === 'function') zaai(db.data[naam]);
    }
    return db.data[naam];
  }

  /* EEN COLLECTIE VERVANGEN, voor de plekken die echt een nieuwe lijst maken
     (kappen op een maximum, een rij opnieuw opbouwen). Weigert een verkeerde
     vorm: dat is precies het gat waarlangs zo'n zetter een contract laat lekken. */
  function zetBak(naam, waarde) {
    eis(naam);
    if (!klopt(naam, waarde)) {
      throw new Error('mobiliteit/opslag: "' + naam + '" hoort een ' + REGISTER[naam].soort +
        ' te zijn; er werd iets anders neergezet.');
    }
    db.data[naam] = waarde;
    return waarde;
  }

  /* ----------------------------------------------------------------------------
     WAT MOBILITEIT VAN ANDEREN LEEST, en nergens schrijft. Drie draden, alle
     drie lezend. Dit is wat het kost om dit domein ooit apart te draaien.
     ------------------------------------------------------------------------- */
  const vreemd = {
    /* ./dispatch.js en ./plekken.js: welke zaken bestaan er, om een vervoerder
       of een ophaalpunt bij een code te vinden. */
    leveranciers: () => db.data.suppliers || [],
    /* ./reisfactoren.js: waar rijdt het materieel nu, om een vertraging te wegen.
       Wordt bijgehouden door de OV-laag, niet door dit domein. */
    ovVoertuigen: () => db.data.ovVoertuigen || [],
    /* ./plekken.js: de live-sessie van een lid, om "waar ben ik nu" te kunnen
       beantwoorden zonder het zelf bij te houden. */
    live: () => db.data.live || {}
  };

  return { bak, zetBak, vreemd, REGISTER, NIET_GEBOUWD };
};

module.exports.REGISTER = REGISTER;
module.exports.NIET_GEBOUWD = NIET_GEBOUWD;
