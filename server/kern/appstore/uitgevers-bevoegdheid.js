/* ============================================================================
   WAT EEN UITGEVER MAG -- de bevoegdheidskant, los van de toelating.

   ./uitgevers.js beantwoordt "wie mag hier publiceren": een vraag over
   TOELATING, die een mens van RTG per geval beslist. Dit bestand beantwoordt
   "en wat mag hij dan": een vraag over BEVOEGDHEID, die uit de SOORT volgt en
   die niemand per geval beslist. Dat is een echte naad en geen opdeling om de
   omvang -- de eerste vraag kent een besluit met een naam eronder, de tweede
   niet.

   Alles hier is met opzet PUUR: geen opslag, geen klok, geen journaal. Daardoor
   is elke regel te toetsen zonder een server op te starten, en dat is precies
   wat een toegangsregel nodig heeft om ook werkelijk getoetst te worden.
   ========================================================================== */
'use strict';

/* TWEE SOORTEN UITGEVER, en het verschil is geen etiket maar een BEVOEGDHEID.

   Besloten op 27 augustus 2026: een geverifieerd PERSOON mag publiceren, maar
   alleen gratis. Betaalde distributie blijft een rechtspersoon vragen -- daar
   hangen btw, de afdracht en een aanspreekbare partij aan, en die drie zijn niet
   aan een natuurlijk persoon op te hangen zonder dat RTG iets belooft wat het
   niet kan waarmaken.

   Dat het geen boolean is, is met opzet. WAARDE.md houdt in dit huis vast dat
   uitbetaalbaar aan een BEVOEGDHEID hangt en nooit aan een vlag; dezelfde
   redenering geldt hier. `magPrijsVragen` geeft daarom een REDEN terug en niet
   alleen een ja of nee, want die reden is wat de mens te lezen krijgt. */
const SOORTEN = ['rechtspersoon', 'persoon'];

/* De leeftijd waarop een mens een uitgeversplek kan vragen. Publiceren is een
   verbintenis. Onder die grens blijft bouwen en uitproberen volledig mogelijk
   (rtg new, rtg dev) -- net als bij de progressielaag, waar het spel gewoon
   speelbaar blijft en alleen het BEWAREN buiten het potje stopt (CLAUDE.md). */
const UITGEVER_LEEFTIJD = 18;

/* MAG DEZE MENS EEN UITGEVERSPLEK VRAGEN? Een pure functie, en met opzet: de
   ROUTE weet wie er inlogt, maar de REGEL is een huisregel en hoort niet in een
   route te wonen waar geen toets bij kan. De route levert twee feiten aan (is de
   identiteit door RTG gezien, en hoe oud is deze mens); wat die feiten betekenen
   staat hier.

   `leeftijd` mag ontbreken en dat is dan GEEN ja: zonder geboortedatum is de
   leeftijd niet vast te stellen, en niet vast te stellen is in dit huis nooit
   hetzelfde als in orde (BESTUUR.md). */
function mensMagUitgeven({ geverifieerd, leeftijd } = {}) {
  if (!geverifieerd) {
    return { mag: false, status: 403, error: 'Publiceren in de App Store vraagt een door RTG geverifieerde identiteit. '
      + 'Laat eerst je paspoort zien; daarna kun je een uitgeversplek aanvragen.' };
  }
  /* `Number(null)` en `Number('')` zijn allebei 0, en nul is hier geen leeftijd
     maar een ontbrekend gegeven. Zonder deze regel leest een mens zonder
     geboortedatum de melding "vanaf 18 jaar", terwijl er in werkelijkheid niets
     te meten viel -- en dat is precies het verschil dat dit huis niet wegpoetst
     (BESTUUR.md: niet vast te stellen is een eigen uitslag). */
  const n = (leeftijd === null || leeftijd === undefined || leeftijd === '') ? NaN : Number(leeftijd);
  if (!Number.isFinite(n)) {
    return { mag: false, status: 403, error: 'Je leeftijd is hier niet vast te stellen, en dat is geen ja: '
      + 'een uitgeversplek is er vanaf ' + UITGEVER_LEEFTIJD + ' jaar.' };
  }
  if (n < UITGEVER_LEEFTIJD) {
    return { mag: false, status: 403, error: 'Een uitgeversplek is er vanaf ' + UITGEVER_LEEFTIJD + ' jaar: publiceren is een verbintenis. '
      + 'Bouwen en uitproberen kan gewoon -- met rtg new en rtg dev draait je app lokaal op de echte brug.' };
  }
  return { mag: true };
}

module.exports = { SOORTEN, UITGEVER_LEEFTIJD, mensMagUitgeven };
