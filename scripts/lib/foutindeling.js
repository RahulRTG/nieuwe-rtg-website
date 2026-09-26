/* ============================================================================
   WAT IS EEN FOUTANTWOORD -- een deur, de omgeving, een weigering, of stuk?

   Gebruikt door scripts/appwerkt.js, die in een echte browser op knoppen tikt
   en elk antwoord van 400 of hoger moet indelen. Tot 24 september 2026 kende hij
   drie bakken: een deur (401/403/404, bewijs 6 gaat daarover), de omgeving (een
   503 die zichzelf uitlegt) en DEFECT voor al het andere.

   DE VIERDE BAK, en waarom. De proef vult geen formulieren in. Tikt hij op
   "Aan mijn loopbaan toevoegen" met een leeg veld, dan antwoordt de server
   400 {"error":"Schrijf op wat er gebeurde."} -- en het scherm toont die zin.
   Dat is de server die een lege invoer terecht weigert, met een reden in
   gewone taal: GRAMMATICA.md noemt dat precies zo ("een verhindering draagt
   altijd een reden"). Het als DEFECT tellen liet de ratel `appwerktDefecten`
   stijgen op iets wat geen mens hoeft te repareren.

   DE GRENS, en die is smal met opzet. Een weigering is:
     - status 400, 409 of 422 (ongeldige invoer, een conflict, onverwerkbaar),
     - met een JSON-lijf waarin `error` een ZIN is: minstens acht tekens en
       minstens twee woorden. Een code als "BAD_REQUEST" of "invalid" is geen
       reden die een mens kan lezen, en blijft een defect.
   Alles daarbuiten blijft wat het was. Een 500 met een nette zin is nog steeds
   een 500: de server heeft niet geweigerd, hij is omgevallen.

   WAT DEZE INDELING NIET WEET. Of het SCHERM de zin werkelijk toont, ziet deze
   functie niet; zij krijgt alleen het antwoord. Een scherm dat de reden
   inslikt, komt hier dus als weigering door. Dat is het restrisico, en het is
   de reden dat de weigeringen per rij geteld blijven in plaats van te
   verdwijnen: wie een scherm verdenkt, ziet hoe vaak het gebeurde.
   ========================================================================== */
'use strict';

const CONFIGZINNEN = /nog niet ingeladen|niet gemount|draait niet mee|is niet beschikbaar|geen model|nietGebouwd/i;
const WEIGERSTATUS = new Set([400, 409, 422]);

function isZin(t) {
  if (typeof t !== 'string') return false;
  const s = t.trim();
  return s.length >= 8 && /\p{L}/u.test(s) && s.split(/\s+/).length >= 2;
}

/* `lijf` is de ruwe tekst van het antwoord (eventueel afgekapt). Geeft een van
   'deur', 'config', 'weigering', 'serverfout'. */
function deelFoutIn(status, lijf) {
  if (status === 401 || status === 403 || status === 404) return 'deur';
  const tekst = String(lijf || '');
  if (status === 503 && (CONFIGZINNEN.test(tekst) || /"hoe"/.test(tekst))) return 'config';
  if (WEIGERSTATUS.has(status)) {
    let d = null;
    try { d = JSON.parse(tekst); } catch (e) { d = null; }
    if (d && typeof d === 'object' && isZin(d.error)) return 'weigering';
  }
  return 'serverfout';
}

module.exports = { deelFoutIn, isZin, CONFIGZINNEN, WEIGERSTATUS };
