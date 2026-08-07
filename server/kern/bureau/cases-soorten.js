/* Het Privekantoor, deelbestand "cases-soorten": de tabellen achter een zaak.

   De statusketen, de soorten, wie er in het team komt en welke twee domeinen
   het kantoor nooit bereiken. Apart van ./cases.js omdat dit CONFIGURATIE is en
   geen gedrag: wie een nieuw soort verzoek toevoegt of een rol hernoemt, hoeft
   de motor niet te openen. En omdat cases.js anders over de tien KB gaat -- de
   maat waarop hier wordt opgeknipt.

   Zie ./cases.js voor wat de soorten betekenen en waarom 'geregeld' alleen van
   de kantoor-kant kan komen. */
'use strict';

/* De keten. `eind` betekent: hier houdt de case op te leven en telt hij nergens
   meer als open. */
const STATUSSEN = [
  { s: 'genoteerd', label: 'Genoteerd' },
  { s: 'in voorbereiding', label: 'In voorbereiding' },
  { s: 'wacht op uw akkoord', label: 'Wacht op uw akkoord' },
  { s: 'in uitvoering', label: 'In uitvoering' },
  { s: 'geregeld', label: 'Geregeld', eind: true },
  { s: 'afgewezen', label: 'Niet gelukt', eind: true },
  { s: 'ingetrokken', label: 'Ingetrokken', eind: true }
];
const EINDSTATUS = new Set(STATUSSEN.filter(x => x.eind).map(x => x.s));
// alleen de kantoor-kant mag hier komen; zie de kop van dit bestand
const KANTOOR_STATUSSEN = ['in voorbereiding', 'in uitvoering', 'geregeld', 'afgewezen'];

/* 'inkoop' is een reguliere zaak met een staart: wat u koopt, hoort daarna in
   uw register te staan. Dat die staart er is, is het hele punt -- een aankoop
   die nergens wordt vastgelegd is over twee jaar een onverzekerd voorwerp
   waarvan niemand meer weet wat het kostte. Zie `registreren` hieronder. */
const SOORTEN = ['regulier', 'bijzonder', 'warroom', 'inkoop'];

/* Wie eraan werkt. Dit zijn ROLLEN, geen namen: het systeem wijst een stoel aan
   en niet een persoon, want een naam op een scherm die er in het echt niet is,
   is precies de belofte die wij niet doen. */
const SPECIALIST = {
  reizen: 'Reisspecialist',
  vervoer: 'Vervoer & onderhoud',
  huishouden: 'Household manager',
  gelegenheden: 'Hospitality & events',
  gezelschap: 'Staf & planning',
  collectie: 'Sourcing & collecties',
  kring: 'Attenties',
  filantropie: 'Filantropie-adviseur',
  vermogen: 'Family office',
  gezondheid: 'Persoonlijk assistent',
  nalatenschap: 'Persoonlijk assistent'
};

/* Domeinen waarvan een case het kantoor NOOIT bereikt. Dezelfde twee die in
   delegatie.js een dak van 1 en 0 hebben, en in de graaf op 'besloten' staan.
   Drie bestanden, één regel -- en dat is geen dubbeling maar dezelfde grens die
   op drie plekken iets anders moet doen: niet delegeren, niet tonen, niet
   doorsturen. */
const BESLOTEN_DOMEIN = new Set(['gezondheid', 'nalatenschap']);


module.exports = { STATUSSEN, EINDSTATUS, KANTOOR_STATUSSEN, SOORTEN, SPECIALIST, BESLOTEN_DOMEIN };
