/* ============================================================================
   HET OPSLAGCONTRACT VAN VEILIGHEID -- de enige deur van dit domein naar db.data.

   Derde domein achter een contract, na payroll en concern.

   EEN WAARNEMING DIE HIER HOORT TE STAAN. Payroll bezit elf collecties op het
   hoogste niveau; concern en dit domein bezitten er EEN met takken eronder.
   Twee keer dezelfde vorm is nog geen gedeelde vorm -- OBJECTMODEL.json en
   DEVELOPERCLOUD.md par. 2 zeggen allebei dat een gedeeld type gevonden moet
   worden en niet verklaard, en twee gevallen zijn te weinig om iets op te
   bouwen. Wie hier een derde wortel-met-takken tegenkomt, heeft wel genoeg om
   de vraag te stellen. Tot dan blijft dit een eigen bestand, en is wat gedeeld
   wordt de DISCIPLINE en niet de code.

   WAAROM ER EEN zetTak() IS, EN WAAROM DIE ZO SMAL BLIJFT. Twee plekken
   VERVANGEN een tak in plaats van hem te muteren: ./alarm.js kapt de alarmen op
   200 en ./wacht.js schuift zijn wachtrij op. Dat is echt vervangen en niet
   muteren, want er wordt een nieuwe lijst gemaakt. zetTak() controleert daarom
   dezelfde twee dingen als tak(): de naam staat in het register, en de vorm
   klopt. Zonder die controle zou dit de achterdeur zijn waarlangs het contract
   alsnog lekt.

   VREEMDE LEZERS: GEEN. Wat dit domein van buiten nodig heeft (sociaal, mail,
   de kluis, meldingen) krijgt het als functie mee via zijn fabriek en niet uit
   db.data. Dat staat hier zodat het zichtbaar blijft als iemand er iets bij wil
   zetten.
   ========================================================================== */
'use strict';

/* ----------------------------------------------------------------------------
   WAT ER NIET IN ZIT, MET DE REDEN.
   ------------------------------------------------------------------------- */
const NIET_GEBOUWD = {
  schema: 'Acht takken tegelijk een schema geven vraagt per tak een eigen ronde. Een half ' +
    'schema keurt goed wat het niet kent.',
  validatie: 'Hangt aan het schema en komt er niet voor.',
  bevoegdheid: 'Zit vandaag bij de ROUTE. Hem hierheen halen is een besluit over de ' +
    'Authority Graph, niet iets om er in een opslagbestand bij te doen.',
  gebeurtenissen: 'server/bus.js vervoert wel maar spreekt geen taal (OS.md par. 4).',
  bewaartermijn: 'De alarmen kappen op 200 en de wachten op 500. Dat zijn GRENZEN en geen ' +
    'bewaarbeleid -- een alarm is een persoonsgegeven en de bewaarlaag kent dit domein nog niet.'
};

/* ----------------------------------------------------------------------------
   HET REGISTER. Elke tak onder db.data.veilig.
   ------------------------------------------------------------------------- */
const REGISTER = {
  alarmen:   { soort: 'lijst', wat: 'verstuurde alarmen, nieuwste eerst, gekapt op 200' },
  wachten:   { soort: 'lijst', wat: 'lopende en afgeronde wachtmomenten ("ik ben zo thuis")' },
  momenten:  { soort: 'lijst', wat: 'gedeelde momenten waar een kring op meekijkt' },
  kring:     { soort: 'kaart', wat: 'wie er meekijkt, per lid' },
  plek:      { soort: 'kaart', wat: 'de laatst bekende plek per lid' },
  vensters:  { soort: 'kaart', wat: 'hoe lang een plek gedeeld mag blijven' },
  rust:      { soort: 'kaart', wat: 'wanneer een lid niet gestoord wil worden' },
  codewoord: { soort: 'kaart', wat: 'het woord dat een stil alarm herkent' }
};

const WORTEL = 'veilig';

module.exports = function maakOpslag({ db }) {
  if (!db || !db.data) throw new Error('veiligheid/opslag: zonder db.data is er niets om te bewaren');

  /* De wortel zelf. Alleen ./plek.js heeft hem nodig -- die zet plek en vensters
     in een adem en geeft er een handvat op terug. */
  function wortel() {
    const huidig = db.data[WORTEL];
    if (!huidig || typeof huidig !== 'object' || Array.isArray(huidig)) db.data[WORTEL] = {};
    return db.data[WORTEL];
  }

  function klopt(naam, waarde) {
    return REGISTER[naam].soort === 'lijst'
      ? Array.isArray(waarde)
      : (waarde && typeof waarde === 'object' && !Array.isArray(waarde));
  }

  function eis(naam) {
    if (!REGISTER[naam]) {
      throw new Error('veiligheid/opslag: "' + naam + '" staat niet in het register. ' +
        'Zet hem erbij met zijn soort en wat erin zit, of gebruik een tak die bestaat.');
    }
  }

  /* DE ENIGE PLEK WAAR EEN TAK ONTSTAAT. */
  function tak(naam) {
    eis(naam);
    const w = wortel();
    if (!klopt(naam, w[naam])) w[naam] = REGISTER[naam].soort === 'lijst' ? [] : {};
    return w[naam];
  }

  /* EEN TAK VERVANGEN. Voor de twee plekken die echt een nieuwe lijst maken in
     plaats van de bestaande te muteren. Weigert een verkeerde vorm: dat is
     precies het gat waarlangs zo'n zetter een contract laat lekken. */
  function zetTak(naam, waarde) {
    eis(naam);
    if (!klopt(naam, waarde)) {
      throw new Error('veiligheid/opslag: "' + naam + '" hoort een ' + REGISTER[naam].soort +
        ' te zijn; er werd iets anders neergezet.');
    }
    wortel()[naam] = waarde;
    return waarde;
  }

  return { tak, zetTak, wortel, REGISTER, NIET_GEBOUWD };
};

module.exports.REGISTER = REGISTER;
module.exports.NIET_GEBOUWD = NIET_GEBOUWD;
module.exports.WORTEL = WORTEL;
