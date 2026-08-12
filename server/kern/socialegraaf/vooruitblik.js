/* Sociale graaf, deelbestand "vooruitblik": wat er aankomt tussen de mensen om
   het lid heen.

   DIT BESTAND REKENT NIETS UIT, EN DAT IS ZIJN HELE ONTWERP. De verleiding was
   om hier de vervaldatums van Entourage-documenten en de verjaardagen uit
   Attenties zelf af te leiden -- het is een handvol regels, de gegevens staan in
   hetzelfde dossier, en het zou werken. Het zou ook betekenen dat dezelfde datum
   op twee plekken wordt berekend: hier en in de Control Tower van de levensgraaf
   (kern/levensgraaf/termijnen.js), die precies dit al doet voor vijf apps
   tegelijk.

   Twee berekeningen van "over hoeveel dagen" lopen uiteen op de dag dat iemand
   er een aanpast, en bij datums gebeurt dat stil: het lid ziet in het ene scherm
   "over 7 dagen" en in het andere "over 6", en niemand kan aanwijzen welke klopt
   (LAT.md regel 4). Dus vraagt deze laag het aan de tower en sorteert alleen.

   WAT ER WEL BIJ KOMT is de selectie: van alle termijnen die het lid heeft, zijn
   dit de termijnen die over MENSEN gaan. De tower kent kamers, en twee daarvan
   zijn sociaal:

     gezelschap   Entourage: de documenten van de mensen die meereizen
     kring        Attenties: verjaardagen en jubilea van relaties

   WAT ER NIET IN KAN, en dat hoort hier te staan omdat het in LIFE.md par. 7 wel
   als voorbeeld genoemd werd: de gastpassen van Cercle. Een club in Cercle draagt
   een AANTAL gastpassen, geen datum waarop er iets afloopt (zie
   kern/rechterhand/cercle.js). Er valt dus niets vooruit te blikken, en een
   verzonnen vervaldatum eromheen zou een waarschuwing zijn die nergens op slaat.
   De clubs komen daarom als telling mee en niet als termijn.

   De rijen komen ONGEWIJZIGD uit de tower, inclusief `waarvan` -- de naam die
   het lid zelf in zijn eigen dossier heeft getypt. Dat is geen kluisgegeven maar
   zijn eigen aantekening, en zonder die naam is "paspoort verloopt over twaalf
   dagen" een waarschuwing waar niemand iets mee kan. */
'use strict';

/* De twee kamers van de levensgraaf die over mensen gaan. Een derde erbij
   verzinnen kan niet: de kamer wordt door de bron gezet (kern/levensgraaf/
   bronnen*.js), en wat daar niet bestaat, bestaat hier ook niet. */
const SOCIALE_KAMERS = new Set(['gezelschap', 'kring']);

module.exports = ({ kern }) => {

  /* De sociale termijnen, op datum, met achterstallig apart. Achterstallig staat
     los omdat het de enige categorie is waar het lid iets aan MOET doen: een
     paspoort dat vorige maand verliep is geen aankondiging meer maar een
     probleem, en het valt in geen enkel toekomstvenster. Precies het venster dat
     nergens bestond voordat de tower er was. */
  function termijnen(key) {
    const rijen = (kern.levensgraaf.termijnen(key) || [])
      .filter(r => SOCIALE_KAMERS.has(r.kamer));
    return {
      achterstallig: rijen.filter(r => r.dagen < 0),
      /* Dertig dagen en niet zeven: een paspoort verlengen kost weken en een
         verjaardagscadeau kiezen kost dagen. De horizon hoort bij wat je er nog
         aan kunt doen, niet bij wat er comfortabel op een scherm past. */
      komt: rijen.filter(r => r.dagen >= 0 && r.dagen <= 30),
      later: rijen.filter(r => r.dagen > 30).length,
      totaal: rijen.length
    };
  }

  /* De clubs: een telling en verder niets. Zie de kop voor waarom hier geen
     termijn onder kan hangen. */
  function clubs(key) {
    const g = kern.levensgraaf.graaf(key) || {};
    return (g.knopen || []).filter(k => k.soort === 'club').length;
  }

  return { termijnen, clubs, SOCIALE_KAMERS };
};
