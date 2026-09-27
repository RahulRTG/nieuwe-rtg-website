/* VERZUIM IN HET ROOSTER -- de regel die een autoplanner leest voordat hij iemand
   inplant.

   HET GEBREK (PLANNING.md par. 7, PERSONEEL.md par. 4). Geen enkele roostermotor
   las verzuim. `kern/payroll/verzuim.js` wist al dat iemand er niet was en wat
   hij nog kon, en `voorPlanning()` was er precies voor gebouwd -- maar de
   beveiligingsplanner en het AI-weekrooster van de zaak zetten een zieke
   medewerker gewoon op een dienst.

   DRIE UITKOMSTEN, EN DE DERDE IS GEEN JA.
     inplanbaar   niets gemeld op deze dag, of gemeld en volledig inzetbaar
     afwezig      gemeld en niet (of niet volledig) inzetbaar -- de machine
                  plant hem niet. Bij 'deels' en 'aangepast' is dat met opzet
                  ook zo: welk werk nog past is een oordeel over een mens, en dat
                  zet een leidinggevende en geen planner. De stand gaat mee in de
                  uitslag, zodat die mens het ziet.
     onbekend     de verzuimlaag is er niet (een kaal proces zonder payroll). Dan
                  wordt er gepland zoals voorheen, maar de uitslag ZEGT dat er
                  niet is nagekeken -- stil doorplannen zou lezen als "niemand
                  is ziek".

   WAT HIER NIET STAAT: een reden. `voorPlanning()` geeft bij ziekte "afwezig"
   en nooit "ziek", en deze module geeft door wat hij krijgt. */
'use strict';

function maakVerzuimRooster(lezer) {
  /* `lezer` is (code, staffId, van, tot) => [{ wat, inzetbaarheid }] of null
     als de verzuimlaag ontbreekt. Een functie en geen module, omdat de planners
     in server.js worden gebouwd ruim voordat payrollOS bestaat. */
  function stand(code, staffId, datum) {
    let regels = null;
    try { regels = typeof lezer === 'function' ? lezer(code, staffId, datum, datum) : null; } catch (e) { regels = null; }
    if (!Array.isArray(regels)) return { stand: 'onbekend' };
    const r = regels.find(x => x.inzetbaarheid !== 'volledig');
    if (!r) return { stand: 'inplanbaar' };
    return { stand: 'afwezig', wat: r.wat || 'afwezig', inzetbaarheid: r.inzetbaarheid || null };
  }

  /* De zin voor de uitslag van een planner. Leeg als er niets te melden is. */
  function verzuimZin(afwezig, onbekend) {
    const delen = [];
    if (afwezig) delen.push(afwezig + ' medewerker(s) niet ingepland omdat er verzuim of verlof loopt' +
      ' (wie deels of aangepast inzetbaar is, plant een mens in)');
    if (onbekend) delen.push('verzuim kon niet worden nagekeken');
    return delen.length ? delen.join('; ') + '.' : '';
  }

  return { stand, verzuimZin };
}

module.exports = { maakVerzuimRooster };
