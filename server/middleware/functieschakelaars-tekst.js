/* DE ZINNEN EN DE LANDafleiding van de functieschakelaars -- de TEKST, apart
   van de machine.

   Waarom apart: ./functieschakelaars.js beslist WELKE deur dicht is, dit bestand
   zegt WAT de gebruiker dan leest. Die twee veranderen om verschillende redenen.
   Er komt een reden bij als er een nieuwe manier van dichtstaan bijkomt (dat
   gebeurde bij de canary en bij de beschermstand); de zinnen zelf worden
   herschreven omdat een supportvraag laat zien dat iemand ze verkeerd las. Wie
   ze in een bestand zet, leest bij elke zin ook de hele beslisboom door.

   En de tweede reden is de harde: het bestand liep tegen de 10 kB. Dit is de
   naad die er al lag. */
'use strict';

/* Landcode van een lid voor de "per land"-regels: het bij registratie gekozen
   land wint, anders leiden we het af uit de nationaliteit op het geverifieerde
   paspoort (bijvoorbeeld "Duitse" -> DE). */
function natieNaarLand(nat) {
  const s = String(nat || '').toLowerCase();
  if (!s) return null;
  if (/nederland|dutch|holland/.test(s)) return 'NL';
  if (/belg/.test(s)) return 'BE';
  if (/duits|german|deutsch/.test(s)) return 'DE';
  if (/frans|french|franc/.test(s)) return 'FR';
  if (/spaan|spanish|espa/.test(s)) return 'ES';
  if (/japan/.test(s)) return 'JP';
  return null;
}

const ZIN = {
  globaal: 'Deze functie is tijdelijk uitgeschakeld door de beheerder.',
  pas: 'Deze functie is voor jouw pas uitgeschakeld door de beheerder.',
  land: 'Deze functie is in jouw land uitgeschakeld door de beheerder.',
  plaats: 'Deze functie is in jouw woonplaats uitgeschakeld door de beheerder.',
  persoon: 'Deze functie is voor jouw account uitgeschakeld door de beheerder.',
  genre: 'Deze functie is voor dit genre zaken uitgeschakeld door RTG.',
  /* De canary is geen storing en geen straf: de functie wordt uitgerold en is
     nog niet aan iedereen toe. Dat hoort er ook zo te staan -- "uitgeschakeld
     door de beheerder" zou een supportvraag opleveren die nergens over gaat. */
  canary: 'Deze functie wordt stap voor stap uitgerold en staat nog niet voor iedereen open.',
  /* De beschermstand is geen storing en geen beheerbesluit over DEZE functie:
     het platform houdt tijdelijk alle nieuwe rechten, betalingen en mutaties
     van derden tegen. Dat hoort er ook zo te staan -- "uitgeschakeld door de
     beheerder" zou de lezer laten zoeken naar een knop die niemand omzette. */
  bescherming: 'Het platform staat tijdelijk in de veilige noodstand: lezen gaat door, maar nieuwe ' +
    'rechten, betalingen en wijzigingen van buitenaf worden even niet aangenomen.'
};

module.exports = { natieNaarLand, ZIN };
