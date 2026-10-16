/* DE RECHTEN VAN DE WERKRUIMTE -- wat de server per sessie toestaat te TONEN.

   De Dynamic Layer en het Second Screen (public/shared/interface/) vragen per
   module een permissie (`travel.read`, `safety.respond`, ...). Tot 12 oktober
   2026 beantwoordde de browser die vraag zelf, en omdat het Second Screen geen
   antwoordfunctie meegaf, was het antwoord altijd ja: workspace-policy.js liet
   alles door als er niemand was om het te vragen. De handelingen zelf liepen
   wel langs de server (elke route heeft `auth`), dus er lekte geen gegeven --
   maar het scherm toonde wat de server niet had toegestaan, en dat is precies
   de vorm waarin later een werkruimte per ROL zou gaan lekken.

   NU BESLIST DE SERVER EN PRESENTEERT DE BROWSER. Elke permissie staat hier met
   de deur waar hij bij hoort: een module mag tonen wat de route erachter de
   sessie ook zou geven, en niets meer. Er komt geen tweede rechtenmodel bij --
   de grond van elke regel is de bestaande deur, en dat staat er letterlijk.

   DRIE REGELS:
   1 ONBEKEND IS NEE. Een permissie die hier niet staat, wordt geweigerd en in
     `onbekend` genoemd. Een verzonnen of verkeerd gespelde naam opent niets.
   2 HET VERZOEK BEPAALT NIETS. Alleen de sessie telt; een rol, actor of
     rechtenlijst in het lichaam van het verzoek wordt niet gelezen.
   3 DE BROWSER BLIJFT EEN PRESENTATIE. Wie zijn eigen browser aanpast, kan een
     module tonen die hier nee kreeg -- maar de route erachter weigert dan nog
     steeds. Deze laag voorkomt dat het SCHERM meer belooft dan de server geeft;
     de toegang zelf blijft bij de deur. */
'use strict';

const heeftSleutel = (sess) => !!(sess && sess.key);

const PERMISSIES = Object.freeze({
  'travel.read': { mag: heeftSleutel, grond: 'dezelfde deur als /api/member/huis/dossier: een ledensessie' },
  'travel.manage': { mag: heeftSleutel, grond: 'het eigen reisdossier van de sessie; de route leest geen sleutel uit het verzoek' },
  'work.read': { mag: heeftSleutel, grond: 'dezelfde accountdeur als /api/bedrijf/mijn; WerkOS controleert daarna het actieve lidmaatschap opnieuw' },
  'coordination.read': { mag: heeftSleutel, grond: 'dezelfde ledensessie als de bestaande service- en Privékantoorprojecties; hun routes controleren de bronzaak opnieuw' },
  'safety.read': { mag: heeftSleutel, grond: 'dezelfde deur als /api/veiligheid: een ledensessie met een sleutel' },
  'safety.respond': { mag: heeftSleutel, grond: 'dezelfde deur als /api/veiligheid/wacht/start: een ledensessie met een sleutel' }
});

function rechtenVoor(sess, gevraagd) {
  const namen = Array.isArray(gevraagd) && gevraagd.length
    ? [...new Set(gevraagd.map(x => String(x).slice(0, 80)))].slice(0, 50)
    : Object.keys(PERMISSIES);
  const rechten = {}, grond = {}, onbekend = [];
  for (const p of namen) {
    const regel = Object.prototype.hasOwnProperty.call(PERMISSIES, p) ? PERMISSIES[p] : null;
    if (!regel) { rechten[p] = false; onbekend.push(p); continue; }
    rechten[p] = regel.mag(sess) === true;
    grond[p] = regel.grond;
  }
  return { bron: 'server', rechten, grond, onbekend };
}

module.exports = { PERMISSIES, rechtenVoor };
