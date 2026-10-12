/* Foundation OS, de vijf AFSPRAAKVELDEN en hun toets. Los van partners.js
   zodat dat bestand onder de omvanggrens blijft; partners.js exporteert ze
   ongewijzigd door, en daar lezen het partnerdossier en het verbond ze. */
'use strict';
/* DE VIJF AFSPRAAKVELDEN, en de toets erop. Ze staan hier en nergens anders,
   want het verbond tussen twee genootschappen (kern/verbond/) legt dezelfde vijf
   vragen vast met een andere woordenlijst ('a', 'b', 'samen'). Een tweede lijst
   daar zou de eerste plek zijn waar ze uit elkaar lopen (LAT.md regel 4).

   toetsAfspraken() is PUUR: hij muteert niets en geeft de geldige waarden terug,
   of de eerste fout. Een leeg veld is "niet meegegeven" en geen fout. Wie hem
   aanroept beslist zelf wat er met de waarden gebeurt -- en omdat er pas wordt
   samengevoegd als ALLES klopt, laat een fout bij het derde veld de eerste twee
   niet half veranderd achter. */
const AFSPRAAKVELDEN = Object.freeze(['geld', 'vrijwilligers', 'persoonsgegevens', 'aansprakelijk', 'rapportage']);
const ofLijst = (l) => l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' of ' + l[l.length - 1];
function toetsAfspraken(invoer, toegestaan) {
  const woorden = Array.isArray(toegestaan) ? toegestaan : [];
  const waarden = {};
  if (!invoer || typeof invoer !== 'object') return { ok: true, waarden };
  for (const k of AFSPRAAKVELDEN) {
    const v = String(invoer[k] || '');
    if (!v) continue;
    if (!woorden.includes(v)) return { ok: false, veld: k, error: 'Bij "' + k + '" hoort ' + ofLijst(woorden) + '.' };
    waarden[k] = v;
  }
  return { ok: true, waarden };
}

module.exports = { AFSPRAAKVELDEN, toetsAfspraken };
