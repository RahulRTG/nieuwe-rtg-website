/* ============================================================================
   HET OPSLAGCONTRACT VAN PAYROLL -- de enige deur van dit domein naar db.data.

   WAAROM DIT BESTAAT, EN WAAROM UITGERKEND HIER.

   Er zijn 706 bestanden buiten server/db/ die db.data rechtstreeks aanraken,
   428 daarvan schrijvend (scripts/deuren.js, meters dbDeuren en
   dbDeurenSchrijvend in NORM.json). Zolang dat zo is, past er geen andere
   opslag onder dit huis: er is niet EEN doorgang die je kunt verleggen, er zijn
   er zevenhonderd. Ze een voor een vervangen door een gecontracteerde doorgang
   is de enige volgorde die werkt -- eerst het contract, dan de opslag. Zonder
   contract is een verhuizing van de opslag een herschrijving van zevenhonderd
   bestanden; met contract is het een verhuizing.

   Payroll is als eerste gekozen op de cijfers en niet op gevoel: elf schrijvers
   over veertien bestanden, dertien collecties die op twee na allemaal onder een
   eigen voorvoegsel wonen, en zestien toetsbestanden. Die dekking is
   doorslaggevend -- een contract dat gedrag verandert zonder dat een toets zakt,
   is geen contract maar een gok.

   WAT DIT BESTAND WEL DOET

   Het draagt het REGISTER van de collecties die payroll bezit: hoe elk heet,
   welke vorm hij heeft, wat erin zit en hoe gevoelig dat is. bak() is de enige
   plek waar een collectie ontstaat, en hij weigert een naam die niet in het
   register staat -- want een collectie die niemand heeft opgeschreven, is een
   collectie die niemand kan verhuizen.

   Wat payroll van ANDERE domeinen leest, staat apart in `vreemd`. Dat is geen
   nettigheid: het zijn precies de twee plekken waar dit domein aan een ander
   hangt, en die horen zichtbaar te zijn in plaats van verstopt tussen de eigen
   gegevens. Wie payroll ooit los wil trekken, leest hier wat dat kost.

   WAT DIT BESTAND MET OPZET NIET DOET

   Zie NIET_GEBOUWD onderaan. Het draagt geen schema's, geen validatie, geen
   bevoegdheidscontrole, geen gebeurtenissen en geen bewaartermijn. Die horen
   in een contract thuis en ze zijn hier niet verzonnen, want een veld dat er
   staat maar nergens wordt afgedwongen is de duurste vorm van LAT-regel 6: elk
   scherm dat hem leest gaat zich ernaar gedragen. Ze staan er met de reden en
   niet als lege waarde.

   DE GRENS DIE HIERBIJ HOORT. Keuringsregel 53 verbiedt db.data in
   server/kern/payroll/ buiten dit bestand. Zonder die poort is dit een
   afspraak, en een afspraak houdt een haastige middag niet tegen.
   ========================================================================== */
'use strict';

/* ----------------------------------------------------------------------------
   HET REGISTER. Elke collectie die payroll BEZIT, met:

     soort        'lijst' of 'kaart' -- bepaalt de lege vorm en de vormcontrole.
                  Dit stond eerder elf keer met de hand uitgeschreven (de ene
                  met Array.isArray, de andere met typeof === 'object'), en dat
                  is precies het soort verschil dat pas opvalt als het misgaat.
     wat          een regel: wat zit erin. Voor wie dit over een jaar leest.
     gevoelig     wat voor gegevens het zijn. NIET afgedwongen door dit bestand
                  -- het is de invoer voor de classificatie die er nog niet is,
                  en het staat hier zodat die classificatie straks niet opnieuw
                  hoeft te worden uitgezocht.
   ------------------------------------------------------------------------- */
const REGISTER = {
  payrollRegels:          { soort: 'kaart', wat: 'jaargangen met loonregels, per versie',        gevoelig: 'bedrijfsgegeven' },
  payrollComponenten:     { soort: 'kaart', wat: 'het looncomponentenregister',                  gevoelig: 'bedrijfsgegeven' },
  payrollContracten:      { soort: 'kaart', wat: 'arbeidscontracten, ingangsdatum-gestuurd',     gevoelig: 'persoonsgegeven' },
  payrollRunsV2:          { soort: 'lijst', wat: 'loonruns: concept, vier ogen, definitief',     gevoelig: 'persoonsgegeven' },
  payrollBevindingen:     { soort: 'kaart', wat: 'controlebevindingen per run',                  gevoelig: 'persoonsgegeven' },
  payrollAangiftes:       { soort: 'lijst', wat: 'loonaangiftes, dezelfde run als derde uitgang', gevoelig: 'persoonsgegeven' },
  payrollBetaalbestanden: { soort: 'lijst', wat: 'betaalbestanden bij een geboekte run',         gevoelig: 'persoonsgegeven' },
  payrollRegelJournaal:   { soort: 'lijst', wat: 'wat de bijwerkronde aan regels veranderde',    gevoelig: 'bedrijfsgegeven' },
  payrollBronnen:         { soort: 'kaart', wat: 'per land: waar de regels vandaan komen',       gevoelig: 'bedrijfsgegeven' },
  /* DE TWEE GEVOELIGE. Verzuim draagt ziekte, en de AP eist dat de reden
     gescheiden blijft van wie hem mag zien -- die scheiding zit in ./verzuim.js
     en niet hier; dit register zegt alleen dat het hier ligt. */
  payrollVerzuim:         { soort: 'kaart', wat: 'verlof en ziekte',                             gevoelig: 'bijzonder persoonsgegeven' },
  identiteitVerzoeken:    { soort: 'lijst', wat: 'ja/nee-vragen over identiteit, met reden',     gevoelig: 'bijzonder persoonsgegeven' }
};

/* ----------------------------------------------------------------------------
   WAT ER NIET IN ZIT, MET DE REDEN. Niet als lege velden, want een leeg veld
   in een contract leest als "komt nog" en gedraagt zich als "bestaat al".
   ------------------------------------------------------------------------- */
const NIET_GEBOUWD = {
  schema: 'Elf collecties tegelijk een schema geven vraagt dat je van elk weet wat er ' +
    'echt in staat, en dat is een eigen ronde per collectie. Een half schema keurt ' +
    'goed wat het niet kent, en dat is erger dan geen schema.',
  validatie: 'Hangt aan het schema en komt er niet voor.',
  bevoegdheid: 'De bevoegdheid wordt vandaag bij de ROUTE gecontroleerd en niet bij de ' +
    'opslag. Hem hierheen halen betekent dat de opslaglaag weet wie er belt, en dat is ' +
    'een besluit over de Authority Graph (CONCERN.md verbiedt een derde rechtenmodel) ' +
    'en niet iets om er in een opslagbestand bij te doen.',
  gebeurtenissen: 'server/bus.js VERVOERT wel maar spreekt geen taal: er is geen ' +
    'envelop, dus een gebeurtenis hier zou een vorm verzinnen die het huis nog niet ' +
    'heeft afgesproken (OS.md par. 4).',
  bewaartermijn: 'De bewaarlaag (server/bewaarbeleid.js, bewaartermijnen.js) kent ' +
    'payroll nog niet. Een termijn hier noemen die daar niet staat, is een belofte ' +
    'zonder veger.'
};

module.exports = function maakOpslag({ db }) {
  if (!db || !db.data) throw new Error('payroll/opslag: zonder db.data is er niets om te bewaren');

  /* DE ENIGE PLEK WAAR EEN PAYROLL-COLLECTIE ONTSTAAT.

     `zaai` is er voor componenten: die vult bij het AANMAKEN een basislijst.
     Dat is domeinkennis en hoort dus bij de aanroeper te blijven -- zou de
     basislijst hier staan, dan wist de opslaglaag ineens wat een looncomponent
     is, en dat is precies de vermenging die dit contract moet voorkomen. */
  function bak(sleutel, zaai) {
    const spec = REGISTER[sleutel];
    if (!spec) {
      throw new Error('payroll/opslag: "' + sleutel + '" staat niet in het register. ' +
        'Een collectie die nergens is opgeschreven, kan niemand verhuizen -- zet hem erbij, met zijn soort en wat erin zit.');
    }
    const huidig = db.data[sleutel];
    const goed = spec.soort === 'lijst'
      ? Array.isArray(huidig)
      : (huidig && typeof huidig === 'object' && !Array.isArray(huidig));
    if (!goed) {
      db.data[sleutel] = spec.soort === 'lijst' ? [] : {};
      if (typeof zaai === 'function') zaai(db.data[sleutel]);
    }
    return db.data[sleutel];
  }

  /* ----------------------------------------------------------------------------
     WAT PAYROLL VAN ANDEREN LEEST, en nergens schrijft. Twee plekken, allebei
     lezend. Ze staan hier met naam zodat de afhankelijkheid zichtbaar is: dit
     zijn de twee draden die je moet doorknippen als payroll ooit apart draait.
     ------------------------------------------------------------------------- */
  const vreemd = {
    /* ./dekking.js: welke zaken bestaan er, om per land te bepalen of hier loon
       kan draaien. Alleen lezen; payroll bezit geen enkele leverancier. */
    leveranciers: () => db.data.suppliers || [],
    /* ./uren.js: de geklokte uren van een zaak. Alleen lezen; de klok wordt
       elders bijgehouden en payroll weegt hem alleen. */
    klokVan: (code) => (db.data.klok || {})[String(code).toUpperCase()]
  };

  return { bak, vreemd, REGISTER, NIET_GEBOUWD };
};

module.exports.REGISTER = REGISTER;
module.exports.NIET_GEBOUWD = NIET_GEBOUWD;
