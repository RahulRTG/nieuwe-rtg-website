/* ============================================================================
   WAT ER NODIG IS VOOR EEN SLA -- en wat de omgeving daarvan vandaag levert.

   Stond in ./bewijs.js. Het is er niet uit gehaald om ruimte te maken maar
   omdat het een eigen vraag is: bewijs.js gaat over welke BEWERING op een
   scherm mag, dit gaat over wat de MACHINE onder je voeten doet -- staat er een
   back-up, is er een meting, is er een proces. Die twee lopen alleen bij de
   SLA samen, en dan via een lijst en niet via een boolean.

   De vier staan los opgesomd en niet als een ja of nee: "nee" zonder te zeggen
   wat er ontbreekt, is een dichte deur zonder sleutelgat.

   HET VERSCHIL DAT HIER BEWAAKT WORDT. Een herstelproef van de UITVOER (zie
   ./herstelproef.js) bewijst dat een klant zijn data terugkrijgt. Een
   herstelproef van de PLATFORM-BACK-UP bewijst dat wij na een storing weer
   draaien. Een SLA hangt aan het tweede. Ze door elkaar laten lopen zou de
   makkelijkste manier zijn om deze voorwaarde op ja te krijgen zonder dat er
   iets is veranderd -- en dat is precies waar dit hele document tegen is.
   ========================================================================== */
'use strict';

const path = require('path');

const DATA_DIR = process.env.RTG_DATA_DIR || path.join(__dirname, '..', '..', 'data');

/* Hoe oud mag de laatste dagback-up zijn voordat de bewering vervalt. Eén dag
   speling: de back-up draait 's nachts, dus "gisteren" is de normale stand. */
const BACKUP_DAGEN = 2;

/* DE STAND VAN DE BACK-UP, en niet alleen zijn datum.

   Hier stond een functie die de nieuwste map opzocht die YYYY-MM-DD heette en
   die naam teruggaf. Daarmee stond de bewering "Dagelijkse back-up" op ja zodra
   er een MAP bestond -- leeg, half weggeschreven of met een db.json van nul
   bytes maakte niet uit. Dat is precies de vorm waar deze hele laag tegen is:
   een bewering waarvan het enige bewijs is dat er iets staat dat eruitziet als
   bewijs. Het nakijken zelf staat in server/backupstand.js, en de BAK-01-check
   in server/techniek.js leest dezelfde functie -- twee oordelen over dezelfde
   back-up zouden vroeg of laat uiteenlopen. */
function backupStand() {
  try { return require('../../backupstand').lees(DATA_DIR); }
  catch (e) { return { er: false, reden: 'de back-upstand is niet te lezen (' + e.message + ')' }; }
}
function laatsteBackup() { const b = backupStand(); return b.er ? b.dag : null; }

function maak({ contract, herstelproef }) {
  /* De vier voorwaarden onder een SLA, elk met hun eigen antwoord. Ze staan
     los opgesomd en niet als één boolean: "nee" zonder te zeggen wat er
     ontbreekt, is een dichte deur zonder sleutelgat. */
  return function slaVoorwaarden(t) {
    const c = contract.van(t.org);
    const back = laatsteBackup();
    const hp = herstelproef ? herstelproef.laatsteGeslaagde(t.org) : null;
    return [
      { wat: 'een lopend contract', ja: !!(c && c.loopt),
        reden: c && c.loopt ? 'pakket ' + c.pakket : 'er loopt geen contract voor deze organisatie' },
      { wat: 'een meting', ja: true,
        reden: 'server/meting.js telt elk verzoek; de doelen staan in SLO.json' },
      { wat: 'een incidentproces met een gemeten reactietijd', ja: false,
        reden: 'DATALEK.md beschrijft de 72-uursklok voor een datalek, maar er is geen ticketstroom die een reactietijd meet' },
      /* De herstelproef bewijst het EXIT-pad en niet de dagback-up van het
         platform, en die twee mogen niet door elkaar lopen. Een SLA hangt aan
         het tweede; daarom blijft deze voorwaarde op nee staan, ook als de
         eerste proef geslaagd is -- met een reden die het verschil noemt. */
      { wat: 'een herstelproef van de PLATFORM-back-up', ja: false,
        reden: (back ? 'er staat een dagback-up van ' + back + ', maar het TERUGZETTEN daarvan is niet beproefd'
          : 'er is geen dagback-up gevonden in de datamap') +
          (hp && hp.ok ? '. De UITVOER van deze organisatie is wel teruggelezen (' + hp.proef.at.slice(0, 10) +
            '); dat bewijst het exit-pad en niet deze back-up.' : '.') }
    ];
  }
}

module.exports = { maak, laatsteBackup, backupStand, BACKUP_DAGEN };
