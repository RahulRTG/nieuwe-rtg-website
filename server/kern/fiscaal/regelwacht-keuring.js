/* De Regelwacht (deelmodule): DE KEURING -- wat mag een bron leveren.

   Afgesplitst van ./regelwacht.js op de omvanglat toen het bronnenregister
   erbij kwam, en de snede loopt langs dezelfde grens als bij payroll tussen
   regelpakket en regelpakket-keuring -- het model waar de Regelwacht zich al op
   beroept. Hiernaast staat hoe een update wordt VASTGELEGD en doorgevoerd, hier
   staat wanneer een waarde uberhaupt een waarde IS.

   DE KEURING IS DE ENIGE MUUR tussen een slechte bron en de tabellen waarmee
   dit hele huis rekent. Een tarief van 300%, een minimumloon van 3 cent, een
   veld dat niemand kent: dat hoort niet binnen te komen, ook niet uit een bron
   die verder betrouwbaar is. Bronnen veranderen van vorm zonder het te zeggen.

   PUUR: geen database, geen opslag. Hij krijgt de huidige waarden mee en geeft
   terug WAT ER ECHT VERANDERT -- niet wat er is aangeboden. Een bron die elke
   dag dezelfde tabel levert, levert hier dus niets op, en dan stapelen er ook
   geen jaargangen. */
'use strict';

const GETALLEN = { lasten: [0, 0.6], vakantiegeld: [0, 0.25], uurloonMin: [1, 100], alcoholLeeftijd: [16, 25] };
const TEKSTEN = ['aangifte', 'extra'];
/* De reisregels (kern/reis.js zet ze op LANDEN[cc].reis) zijn net zo
   automatisch bij te werken als de belastingen: streng gevalideerd. */
const REIS_ENUM = { visum: ['geen', 'vrij', 'toestemming', 'aankomst', 'evisum', 'visum'], rijden: ['links', 'rechts'] };
const REIS_TEKST = { alarm: [2, 8], fooi: [1, 200], letOp: [0, 400] };

/* Keur de aangeboden velden voor EEN land tegen wat er nu geldt. Geeft de
   wijzigingenset terug (leeg als er niets verandert of niets deugt). */
function keur(nu, velden) {
  const wijz = {};
  for (const [veld, waarde] of Object.entries(velden || {})) {
    if (GETALLEN[veld]) {
      const n = Number(waarde);
      const [min, max] = GETALLEN[veld];
      if (Number.isFinite(n) && n >= min && n <= max && nu[veld] !== n) wijz[veld] = n;
    } else if (veld === 'tarieven' && typeof waarde === 'object') {
      for (const [t, w] of Object.entries(waarde)) {
        const n = Number(w);
        /* `t in nu.tarieven`: er komt NOOIT een nieuw tarief bij via een
           update. Een bron die een categorie verzint die wij niet kennen, zou
           anders een tarief neerzetten waar geen enkele rekenplek naar kijkt. */
        if (nu.tarieven && t in nu.tarieven && Number.isFinite(n) && n >= 0 && n <= 30 && nu.tarieven[t] !== n) {
          (wijz.tarieven = wijz.tarieven || {})[t] = n;
        }
      }
    } else if (TEKSTEN.includes(veld) && typeof waarde === 'string' && waarde.trim()) {
      const s = waarde.replace(/[<>]/g, '').slice(0, 400);
      if (nu[veld] !== s) wijz[veld] = s;
    } else if (veld === 'reis' && typeof waarde === 'object' && nu.reis) {
      const rs = nu.reis;
      for (const [rv, rw] of Object.entries(waarde)) {
        if (REIS_ENUM[rv] && REIS_ENUM[rv].includes(rw) && rs[rv] !== rw) (wijz.reis = wijz.reis || {})[rv] = rw;
        else if (rv === 'dagen') { const n = Number(rw); if (Number.isFinite(n) && n >= 0 && n <= 365 && rs.dagen !== n) (wijz.reis = wijz.reis || {}).dagen = n; }
        else if (rv === 'water') { const b = rw === true; if (typeof rw === 'boolean' && rs.water !== b) (wijz.reis = wijz.reis || {}).water = b; }
        else if (REIS_TEKST[rv] && typeof rw === 'string') {
          const [min, max] = REIS_TEKST[rv];
          const s = rw.replace(/[<>]/g, '').trim().slice(0, max);
          if (s.length >= min && rs[rv] !== s) (wijz.reis = wijz.reis || {})[rv] = s;
        }
      }
      if (wijz.reis && !Object.keys(wijz.reis).length) delete wijz.reis;
    }
  }
  return wijz;
}

module.exports = { keur, GETALLEN, TEKSTEN, REIS_ENUM, REIS_TEKST };
