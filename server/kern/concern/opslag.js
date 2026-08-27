/* ============================================================================
   HET OPSLAGCONTRACT VAN CONCERN -- de enige deur van dit domein naar db.data.

   Tweede domein achter een contract, na server/kern/payroll/opslag.js. Zelfde
   discipline, ANDERE VORM, en dat verschil is het vermelden waard.

   Payroll bezit elf collecties op het hoogste niveau van db.data. Concern bezit
   er EEN -- db.data.concern -- met acht takken eronder. Dat is geen detail: het
   betekent dat een gedeelde opslagklasse voor beide domeinen nu al twee vormen
   zou moeten kennen, en bureau (een dossier per lid) een derde. Drie vormen uit
   vier domeinen.

   Daarom staat hier geen gedeelde klasse maar een eigen bestand. DEVELOPERCLOUD.md
   par. 2: een universeel objectmodel moet worden GEVONDEN in de domeinen, niet
   eroverheen verklaard -- en OBJECTMODEL.json heeft die meting hier al een keer
   gedaan met een streng antwoord (71% van de velden hoort bij precies een
   domein; `Asset` bleek niet te bestaan). Wat gedeeld wordt is de DISCIPLINE
   (een register, een benoemde deur, vreemde lezers apart, en wat er niet is met
   de reden) en de handhaving in keuringsregel 53. Niet de code.

   WAAROM ER OOK EEN wortel() IS. ./verandering.js zet een opname terug en moet
   daarvoor over drie takken tegelijk lopen met dezelfde momentopname -- takken
   die elkaar via entiteit-id's kennen. Dat per tak doen zou drie keer bak()
   betekenen op een moment dat er tussendoor niets mag veranderen. De wortel is
   daar de eerlijke vorm; hij staat hier met naam zodat zichtbaar is dat er EEN
   plek is die hem nodig heeft, en niet acht.

   VREEMDE LEZERS: GEEN. Dit domein leest niets van een ander domein rechtstreeks
   uit db.data -- wat het van buiten nodig heeft (een leverancier, een
   onderneming) krijgt het als functie mee via de context. Dat is een sterkere
   grens dan payroll heeft, en hij staat hier zodat hij zichtbaar blijft als
   iemand er ooit iets bij wil zetten.
   ========================================================================== */
'use strict';

/* ----------------------------------------------------------------------------
   WAT ER NIET IN ZIT, MET DE REDEN. Niet als lege velden: een leeg veld in een
   contract leest als "komt nog" en gedraagt zich als "bestaat al".
   ------------------------------------------------------------------------- */
const NIET_GEBOUWD = {
  schema: 'Acht takken tegelijk een schema geven vraagt van elk te weten wat er echt in ' +
    'staat, en dat is een eigen ronde per tak. Een half schema keurt goed wat het niet kent.',
  validatie: 'Hangt aan het schema en komt er niet voor.',
  bevoegdheid: 'Die zit vandaag bij de ROUTE en bij ./scope.js, niet bij de opslag. Hem ' +
    'hierheen halen is een besluit over de Authority Graph; CONCERN.md verbiedt met zoveel ' +
    'woorden een derde rechtenmodel, dus dat hoort daar en niet hier.',
  gebeurtenissen: 'server/bus.js vervoert wel maar spreekt geen taal (OS.md par. 4). Een ' +
    'gebeurtenis hier zou een vorm verzinnen die dit huis nog niet heeft afgesproken.',
  bewaartermijn: 'De opnames van ./verandering.js kappen op MAX_OPNAMES en dat is een ' +
    'grens, geen bewaarbeleid. De bewaarlaag kent concern nog niet.'
};

/* ----------------------------------------------------------------------------
   HET REGISTER. Elke tak onder db.data.concern, met zijn vorm en wat erin zit.
   De vormcontrole stond eerder acht keer met de hand uitgeschreven, elke keer
   net anders (de ene met Array.isArray, de andere met typeof === 'object').
   ------------------------------------------------------------------------- */
const REGISTER = {
  concerns:      { soort: 'kaart', wat: 'de concerns zelf: de bovenste knoop van de graaf' },
  entiteiten:    { soort: 'kaart', wat: 'juridische entiteiten (een bedrijf is niet een KvK)' },
  vestigingen:   { soort: 'kaart', wat: 'vestigingen per entiteit' },
  employments:   { soort: 'kaart', wat: 'wie werkt waar, en onder welke entiteit' },
  uitnodigingen: { soort: 'kaart', wat: 'openstaande uitnodigingen om ergens te komen werken' },
  voorstellen:   { soort: 'kaart', wat: 'wat Document Intelligence voorstelt; een mens bevestigt' },
  feiten:        { soort: 'lijst', wat: 'de tijdlijn: elk juridisch gegeven met bron en datum' },
  opnames:       { soort: 'lijst', wat: 'momentopnames waar ./verandering.js naar terug kan zetten' }
};

/* De wortel waar alle takken onder hangen. Eén naam, één plek. */
const WORTEL = 'concern';

module.exports = function maakOpslag({ db }) {
  if (!db || !db.data) throw new Error('concern/opslag: zonder db.data is er niets om te bewaren');

  /* De wortel zelf, aangemaakt als hij er niet is. Alleen ./verandering.js
     heeft hem nodig; alle andere lagen gaan door tak(). */
  function wortel() {
    const huidig = db.data[WORTEL];
    if (!huidig || typeof huidig !== 'object' || Array.isArray(huidig)) db.data[WORTEL] = {};
    return db.data[WORTEL];
  }

  /* DE ENIGE PLEK WAAR EEN TAK ONTSTAAT. Een naam die niet in het register
     staat is een fout en geen nieuwe tak: wat niemand heeft opgeschreven, kan
     niemand verhuizen. */
  function tak(naam) {
    const spec = REGISTER[naam];
    if (!spec) {
      throw new Error('concern/opslag: "' + naam + '" staat niet in het register. ' +
        'Zet hem erbij met zijn soort en wat erin zit, of gebruik een tak die bestaat.');
    }
    const w = wortel();
    const huidig = w[naam];
    const goed = spec.soort === 'lijst'
      ? Array.isArray(huidig)
      : (huidig && typeof huidig === 'object' && !Array.isArray(huidig));
    if (!goed) w[naam] = spec.soort === 'lijst' ? [] : {};
    return w[naam];
  }

  return { tak, wortel, REGISTER, NIET_GEBOUWD };
};

module.exports.REGISTER = REGISTER;
module.exports.NIET_GEBOUWD = NIET_GEBOUWD;
module.exports.WORTEL = WORTEL;
