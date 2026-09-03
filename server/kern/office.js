/* Kern-module "office": RTG Office, het eigen kantoorpakket voor het hele
   ecosysteem. Leden (RTG, Lifestyle en Business Pass) werken op hun eigen
   account; elke leverancier en partner heeft een team-drive per zaak
   (sleutel 'sup:CODE'); de eigen RTG-kantoren delen de kantoor-drive
   ('rtg:kantoor'); en RTF-leden werken per gezinsprofiel
   ('rtf:CODE:handle'), met een kring per gezin. Drie soorten: tekst,
   rekenblad en presentatie.

   De onderdelen wonen onder ./office/: basis.js (grenzen, sjablonen,
   rechten-helpers), docs.js (mappenlijst, maken, openen, bewaren,
   verwijderen), delen.js (versies, delen op codenaam, gezinskring,
   AI-schrijfhulp) en formulier.js (invullen en de uitslag).
   maakOffice(state) voegt ze samen; de API blijft gelijk. */

const { maakBasis } = require('./office/basis');

function maakOffice(state) {
  const basis = maakBasis(state);
  return {
    ...require('./office/docs')(state, basis),
    ...require('./office/delen')(state, basis),
    ...require('./office/formulier')(state, basis),
    ...require('./office/workflow')(state, basis),
    ...require('./office/samen')(state, basis)
  };
}

/* HET PAKKET ALS EEN NAAM (TAKEN.md 5.14).

   Deze negentien namen stonden plat op de kern, en twee routedomeinen
   (kantoorpakket en kantoorpakket-huis) haalden er elk twaalf los uit de
   gedeelde zak. Dat was met afstand de grootste echte koppeling in
   `npm run grenzen` -- en anders dan de meeste is dit er WEL een die inhoudelijk
   een module is: het is niet een verzameling namen die toevallig samen voorkomt,
   het is de drive van RTG Office.

   Sindsdien hangen die twee domeinen aan EEN naam (`office`) in plaats van aan
   twaalf. De platte namen blijven op de kern staan voor de aanroepers binnen de
   kern zelf (kern/kantoorwereld.js leest er een); wat verandert is dat een
   ROUTEDOMEIN ze niet meer los mag aanraken.

   DE LIJST STAAT UITGESCHREVEN EN WORDT NIET AFGELEID. "Haal `office` van de
   naam af en maak de eerste letter klein" zou werken tot iemand een naam
   toevoegt die niet met `office` begint, en dan mist het pakket hem stil. De
   controle eronder zakt zodra de twee uit elkaar lopen -- in beide richtingen. */
const PAKKETNAMEN = {
  mijn: 'officeMijn', maak: 'officeMaak', open: 'officeOpen', bewaar: 'officeBewaar',
  weg: 'officeWeg', ster: 'officeSter', versies: 'officeVersies', terug: 'officeTerug',
  deel: 'officeDeel', kring: 'officeKring', ai: 'officeAI', vul: 'officeVul',
  uitslag: 'officeUitslag', fase: 'officeFase', samen: 'officeSamen',
  aanwezig: 'officeAanwezig', opmerking: 'officeOpmerking', beheer: 'officeBeheer',
  beheerVan: 'officeBeheerVan'
};

function alsPakket(plat) {
  const uit = {};
  for (const [kort, lang] of Object.entries(PAKKETNAMEN)) {
    if (typeof plat[lang] !== 'function') {
      throw new Error('kern/office: het pakket noemt "' + lang + '" en die staat niet op de module');
    }
    uit[kort] = plat[lang];
  }
  const missend = Object.keys(plat).filter(n => !Object.values(PAKKETNAMEN).includes(n));
  if (missend.length) {
    throw new Error('kern/office: deze namen staan wel op de module en niet in het pakket: ' +
      missend.join(', ') + ' -- zet ze in PAKKETNAMEN, anders kan een routedomein er niet bij');
  }
  return uit;
}

module.exports = { maakOffice, alsPakket, PAKKETNAMEN };
