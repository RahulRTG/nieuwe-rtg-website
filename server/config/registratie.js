/* RTG_REGISTRATIE_DICHT LEZEN -- fail-closed, op een plek.

   De grendel zelf staat in ../accounts/registratie.js (de accountgevel weigert
   createUser). Het LEZEN staat hier, omdat config.valideer bij het opstarten op
   precies dezelfde regel moet waarschuwen en de configuratielaag de kluis niet
   mag binnenlopen.

   De regel: leeg of ontbrekend is open, een expliciete `0` is open, en ELKE
   andere waarde is dicht. De eerste versie las alleen een letterlijke `1` als
   dicht, en daarmee lieten `true`, `yes`, `ja`, `01` en `1 # dicht tot #587` de
   registratie OPEN -- de envlezers van golive.js en scripts/docker/start.js
   houden een commentaar achter de waarde gewoon vast. Een commentaar dat met
   witruimte en # begint telt niet mee; een # zonder witruimte ervoor (`#1`) is
   een vreemde waarde en blijft dus dicht. */
'use strict';

const VLAG = 'RTG_REGISTRATIE_DICHT';

function waarde(env = process.env) {
  return String(env[VLAG] == null ? '' : env[VLAG]).replace(/\s+#.*$/, '').trim();
}

function dicht(env = process.env) {
  const w = waarde(env);
  return w !== '' && w !== '0';
}

/* Is de waarde een die we kennen? Alles behalve leeg, 0 en 1 is een
   waarschuwing waard -- hij telt als dicht, maar dat moet iemand zien. */
function onbekend(env = process.env) {
  const w = waarde(env);
  return w !== '' && w !== '0' && w !== '1';
}

/* Voor config.valideer: een zin bij een onbekende waarde, anders niets. */
function keur(env, waarschuwingen) {
  if (onbekend(env)) {
    waarschuwingen.push(VLAG + '="' + String(env[VLAG]).slice(0, 40) + '" is geen 0 of 1. ' +
      'Hij telt als DICHT (fail-closed): er ontstaan geen nieuwe accounts. Bedoelt u open, zet hem op 0 of haal hem weg.');
  }
}

module.exports = { VLAG, waarde, dicht, onbekend, keur };
