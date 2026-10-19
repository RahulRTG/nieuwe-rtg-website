/* ============================================================================
   DE CONFIGWEIGERING -- wanneer een 503 een eerlijke "de omgeving mist iets"
   is, en geen kale fout. Op EEN plek, voor elk instrument.

   Dezelfde 503 kreeg in twee instrumenten twee oordelen (19 oktober 2026, door
   TravelOS gevonden): scripts/appwerkt.js las hem als GEBLOKKEERD_DOOR_CONFIG,
   scripts/voltooiproef.js telde elke status vanaf 500 als kaal. Navigatie ("Het
   Nederlandse wegennet is nog niet ingeladen", hoe: npm run navigatie:nederland)
   stond daardoor in het ene register als configblokkade en in het andere als
   defect. Twee plekken voor een waarheid lopen uiteen (LAT.md regel 4).

   DE REGEL, en hij is met opzet smal:
     - alleen status 503 (een 500 is een fout, ook met een nette zin erin);
     - EN een zin die zegt dat er iets in de omgeving ontbreekt (CONFIGZINNEN),
       OF een niet-leeg veld `hoe` met wat iemand moet doen.
   Een 503 zonder een van die twee blijft kaal. test/configweigering.test.js
   houdt beide richtingen vast.
   ========================================================================== */
'use strict';

const CONFIGZINNEN = /nog niet ingeladen|niet gemount|draait niet mee|is niet beschikbaar|geen model|nietGebouwd/i;

/* `lijf`: het geparste antwoord, of de tekst ervan. */
function isConfigWeigering(status, lijf) {
  if (status !== 503 || lijf === null || lijf === undefined) return false;
  if (typeof lijf === 'string') {
    if (CONFIGZINNEN.test(lijf)) return true;
    try { return isConfigWeigering(status, JSON.parse(lijf)); } catch (e) { return /"hoe"\s*:\s*"[^"\s][^"]*"/.test(lijf); }
  }
  if (typeof lijf !== 'object') return false;
  if (typeof lijf.hoe === 'string' && lijf.hoe.trim()) return true;
  return CONFIGZINNEN.test(JSON.stringify(lijf));
}

module.exports = { isConfigWeigering, CONFIGZINNEN };
