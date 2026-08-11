/* Spellen (deelmodule): DE PROGRESSIEGRENS.

   Alles wat een prestatie BUITEN het potje bewaart -- highscores, ranglijsten,
   standen, prestaties, later niveaus -- bestaat alleen voor geverifieerd
   volwassen leden. Dat is dezelfde poort als die van Proost: `volwassen()`
   betekent "RTG heeft de paspoort-geboortedatum gecontroleerd EN die is 18+",
   dus een lid zonder gecontroleerd paspoort valt er ook buiten tot dat gedaan
   is.

   WAAROM DIE GRENS ER IS. `CLAUDE.md` verbiedt verslavende
   engagement-patronen, De Arena belooft tieners met zoveel woorden "alles telt
   alleen binnen het potje; er bestaat geen ranglijst", en de School-lat zegt
   "leren is geen wedstrijd". Een scorebord onder vrienden in dezelfde RTF-app
   sprak dat tegen. Onder de grens blijft elk spel gewoon volledig speelbaar --
   er wordt alleen niets van bewaard, en dat is iets anders dan een verbod.

   DIT BESTAND IS EEN BESTAND VAN TWEE REGELS, en dat is de bedoeling. De grens
   is de enige regel waar de hele spellenlaag aan hangt: de uitslagen, de stand,
   de prestaties en de arcade vragen het hier en nergens anders. Zou hij als
   twee losse regels middenin de bedrading staan, dan is hij niet te vinden voor
   wie een ZESDE progressievorm toevoegt -- en die schrijft dan zijn eigen
   kopie. Een eigen bestand met een eigen naam is het verschil tussen "hier
   hangt het aan" en "ergens stond een regel".

   WAT ER BEWUST NIET ONDER VALT: een toernooi (begrensd evenement, laat geen
   stand na), een replay (je eigen partij terugkijken telt niets op) en de
   dagtelling (daar staat geen persoon in). Die drie staan met hun reden in hun
   eigen module. */
module.exports = ({ volwassen }) => ({
  progressieMag: (handle) => volwassen(handle),
  GEEN_PROGRESSIE: 'Scores en ranglijsten bestaan alleen voor leden met een geverifieerde volwassen leeftijd. Het spel zelf speel je gewoon.'
});
