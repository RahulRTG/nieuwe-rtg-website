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

  /* Een rooster dat een MENS vaststelt, opnieuw nakijken: tussen voorstel en
     akkoord kan iemand zich ziek melden. Geeft per dag wie er ingepland staat
     terwijl hij afwezig is -- een waarschuwing, geen weigering, want vaststellen
     is het besluit van die mens. `vrij` is de naam van de vrije dienst. De
     aanroeper geeft null als er geen verzuimlaag is: niet nagekeken. */
  function naKijken(code, dagen, vrij) {
    const uit = [];
    for (const dag of dagen || []) for (const m of dag.staff || []) {
      if (m.shift === vrij) continue;
      const v = stand(code, m.id, dag.date);
      if (v.stand === 'afwezig') uit.push({ datum: dag.date, id: m.id, naam: m.name, wat: v.wat, inzetbaarheid: v.inzetbaarheid });
    }
    return uit;
  }

  /* HET WEEKROOSTER VAN DE TEAM ROOM, TEGEN DE VERZUIMLAAG GELEGD (PERSONEEL.md
     par. 4). Zonder dit stond een zieke collega er gewoon op zijn dienst.

     Het rooster is een lijst NAMEN die elke collega ziet, dus de reden blijft
     eruit: wie afwezig is heet voor iedereen "Afwezig" -- niet ziek, niet
     vakantie. Alleen de MANAGER krijgt `afwezig` (wat) en `inzetbaarheid`
     erbij, want die plant, en bij 'deels' of 'aangepast' is dat een mens.
     Wie vrij stond, blijft vrij: daar valt niets te melden, en een wijziging
     zou alleen verraden dat er iets speelt. Het geplande rooster wordt niet
     aangeraakt; dit geeft een nieuw object. Zonder verzuimlaag staat er
     `verzuimNagekeken: false`, want stil doorlaten leest als "niemand ziek". */
  function legOp(code, week, { manager } = {}, vrij) {
    let onbekend = 0;
    const days = (week.days || []).map(dag => ({ ...dag, staff: (dag.staff || []).map(m => {
      if (m.shift === vrij) return m;
      const v = stand(code, m.id, dag.date);
      if (v.stand === 'onbekend') onbekend++;
      if (v.stand !== 'afwezig') return m;
      return manager ? { ...m, shift: 'Afwezig', gepland: m.shift, afwezig: v.wat, inzetbaarheid: v.inzetbaarheid }
        : { ...m, shift: 'Afwezig' };
    }) }));
    return { ...week, days, verzuimNagekeken: onbekend === 0 };
  }

  return { stand, verzuimZin, naKijken, legOp };
}

/* De verzuimlaag (kern.payrollOS, opzet/kernlaag2.js) bestaat pas ruim nadat
   server.js de planners bouwt; daarom wordt hij pas bij de vraag opgezocht.
   Ontbreekt hij, dan is het antwoord null en zeggen de planners dat ze niet
   konden nakijken. `haalKern` is een functie: in server.js bestaat `kern` op
   dat moment nog niet eens als naam. */
function uitKern(haalKern) {
  return maakVerzuimRooster((code, staffId, van, tot) => {
    const p = haalKern().payrollOS;
    return p && p.verzuim ? p.verzuim.voorPlanning(code, staffId, van, tot) : null;
  });
}

module.exports = { maakVerzuimRooster, uitKern };
