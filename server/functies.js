/* Functieschakelaars ("feature flags") voor het beveiligde Backoffice-techniekbord.

   Anders dan de zekeringen (die springen bij een storing) zijn dit bewuste
   aan/uit-knoppen per functionaliteit van het hele platform. Zo kun je het
   systeem functie voor functie openzetten of juist iets tijdelijk sluiten,
   netjes geordend per categorie.

   Elke functie bewaakt een of meer pad-prefixen (bijv. /api/supplier/pos). Een
   verzoek wordt getoetst aan de MEEST SPECIFIEKE functie die op het pad past
   (langste prefix wint). Zo kan een brede functie uit staan terwijl een
   deelfunctie eronder aan blijft, en andersom, precies wat je wilt om het
   systeem "een voor een" open te zetten.

   PER DOELGROEP. Naast de globale aan/uit-knop kan elke functie ook per
   doelgroep worden bijgestuurd: wel voor de RTG-leden maar niet voor de
   Lifestyle-leden, wel voor de leveranciers maar niet voor de leden, enzovoort.
   Elke functie noemt de doelgroepen die zij bedient; de eigenaar zet de functie
   dan per doelgroep aan of uit. De doelgroep van een verzoek volgt uit het pad
   (leveranciers, personeel, backoffice, foundation) of uit de pas van het lid
   (RTG, Lifestyle, Business).

   De stand staat in db.data.techniek.functies:
     { id: { aan, storing, perDoelgroep:{lifestyle:false}, perLand:{NL:false}, perPersoon:{'user-12':false} } }
   Wat er niet in staat valt terug op de standaard (alles staat standaard AAN,
   zodat het platform draait zoals altijd tot je bewust iets omzet). Een
   doelgroep/land/persoon zonder eigen stand volgt de globale aan/uit.

   DRIE FIJNE ASSEN naast globaal. Een functie kan globaal aan staan maar toch
   gericht uit voor:
   - een PAS (doelgroep: rtg/lifestyle/business, en leverancier/personeel/...),
   - een LAND (landcode van het lid, bijv. NL/ES; alleen als het lid een land
     heeft ingevuld),
   - een PERSOON (een specifiek account, op sleutel 'user-<id>').
   Elke expliciete `false` op welke as dan ook blokkeert; anders is de functie
   beschikbaar. */


/* Opgeknipt in drie deelmodules die elkaar met gewone requires vinden:
   functies/register.js (de catalogus), functies/toegang.js (de motor) en
   functies/voorstel.js (bord + AI-voorstellen). De exports blijven exact
   gelijk, dus geen enkele aanroeper merkt er iets van. */
const { CATEGORIEEN, DOELGROEPEN, DOELGROEP_IDS, DOELGROEP_OP_ID, LEDEN, LEDEN_RTF, FUNCTIES, OP_ID } = require('./functies/register');
const { functieVoorPad, functieAan, functieAanVoor, functieStoring, functieStatus,
  heeftLandRegels, heeftGenreRegels, HEEFT_GENRE_STANDAARD, blokkadeReden, padGeblokkeerd,
  doelgroepVanVerzoek, tierNaarDoelgroep } = require('./functies/toegang');
const { catalogus, valideerVoorstel, duidVoorstel } = require('./functies/voorstel');

module.exports = {
  FUNCTIES, CATEGORIEEN, OP_ID, DOELGROEPEN, DOELGROEP_IDS,
  functieVoorPad, functieAan, functieAanVoor, functieStoring, functieStatus,
  heeftLandRegels, heeftGenreRegels, HEEFT_GENRE_STANDAARD, blokkadeReden, padGeblokkeerd, catalogus,
  doelgroepVanVerzoek, tierNaarDoelgroep, valideerVoorstel, duidVoorstel
};
