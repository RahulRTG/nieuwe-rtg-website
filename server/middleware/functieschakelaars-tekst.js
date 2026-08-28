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

/* ZIN woonde hier ook; hij staat nu alleen in ./schakelaar-antwoord.js --
   beide takken hadden dezelfde teksten uitgeplaatst, elk naar een eigen
   module, en twee bronnen voor dezelfde zin lopen uiteen (LAT-regel 4). */

module.exports = { natieNaarLand };
