/* HET BEGINSCHERM VAN RTG COMMAND IN ÉÉN AANROEP.

   Vier losse verzoeken op een beginscherm zijn vier momenten waarop het scherm
   half gevuld kan blijven staan. Dit is er één, en hij slaagt of faalt in zijn
   geheel.

   ELKE TEGEL DIE ERIN STAAT, STAAT ER OM DEZELFDE REDEN: een meter die je moet
   opzoeken is geen meter. Een alarm dat je moet opzoeken is geen alarm, een
   foutbudget dat je moet opzoeken is geen rem, en een klant die op RTG wacht
   hoort niet in een lijst te staan die niemand opent.

   EN EEN TEGEL DIE OMVALT, VALT ALLEEN. `ingepakt()` maakt van een fout een
   WAARDE en geen worp: ontbreekt SLO.json, dan hoort dat één luide tegel te
   zijn en niet een leeg beginscherm. Een beginscherm dat in zijn geheel
   omvalt omdat één laag hapert, is precies het scherm dat je op de verkeerde
   dag niet kunt openen.

   Dit stond in ./index.js en is eruit gehaald toen dat bestand door zijn
   omvangsgrens ging. De naad lag er al: index.js HANGT de lagen op, dit leest
   ze uit. */
'use strict';

function maakBeginscherm(k) {
  const ingepakt = (doe) => {
    try { return doe(); }
    catch (e) { return { fout: String(e.message).slice(0, 200) }; }
  };

  function start() {
    return {
      puls: k.puls.beeld(),
      zaken: k.zaken.lijst({ status: 'open', max: 12 }),
      runbooks: k.runbooks.lijst(),
      werk: k.werkbesparing.bord(30),
      rechten: k.toegang.graaf(),
      plannen: k.operator.recent(5),
      runs: k.runbooks.runs(8),
      kwaliteit: k.kwaliteit.meet().tel,
      slo: ingepakt(() => { const s = k.slo.stand(); return { tel: s.tel, uitrol: s.uitrol }; }),
      /* De lopende uitrollen, want een canary die niemand meer bekijkt is
         precies het geval waarvoor de terugroldrempel bestaat. */
      canary: ingepakt(() => k.canary.stand().tel),
      alarm: ingepakt(() => k.alarm.stand().tel),
      /* De puls hierboven zegt hoe de GEGEVENS ervoor staan; dit zegt of de
         diensten het doen. Twee vragen, twee tegels. */
      gezondheid: ingepakt(() => { const g = k.gezondheid.stand(); return { oordeel: g.oordeel, tel: g.tel }; }),
      incidenten: ingepakt(() => k.incident.tel()),
      bijstand: ingepakt(() => k.bijstand.tel())
    };
  }

  return { start };
}

module.exports = { maakBeginscherm };
