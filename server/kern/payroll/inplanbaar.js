/* Payroll OS: MAG EEN PLANNER DEZE MENS OP DEZE DAG INPLANNEN?

   De vraag die geen roostermotor stelde (PLANNING.md par. 6): een zieke of
   vrije medewerker kon gewoon worden ingepland, terwijl het verzuimregister
   het al wist. Deze module is de EEN regel die de planners delen -- het
   AI-weekrooster (kern/agent.js), de autoplanner van de beveiliging
   (kern/beveiliging/rooster/aanvragen.js) en het getoonde weekrooster
   (kern/personeel.js).

   DE REGEL. Automatisch inplannen alleen wie er volledig is. Wie deels of
   aangepast inzetbaar is, plant een MENS in: een machine weet niet welk werk
   "aangepast" is, en raden is precies de fout. De reden die meegaat is die van
   voorPlanning (bij ziekte "afwezig", nooit wat iemand heeft).

   EEN REGISTER DAT NIET TE LEZEN IS, is geen "niemand afwezig". Dan mag er
   gepland worden -- anders staat elk rooster stil door een storing -- maar met
   `onbekend: true`, en de planner zegt erbij dat afwezigheid niet is
   meegewogen. */
'use strict';

function maakInplanbaar(afwezigOp) {
  return function inplanbaar(code, staffId, datum) {
    let a;
    try { a = typeof afwezigOp === 'function' ? afwezigOp(code, staffId, datum) : { onbekend: true }; }
    catch (e) { a = { onbekend: true }; }
    if (!a) return { plan: true };
    if (a.onbekend) return { plan: true, onbekend: true };
    if (a.inzetbaarheid === 'volledig') return { plan: true };
    /* "Plan dit zelf in" alleen bij deels of aangepast: wie NIETS kan, plant
       ook een mens niet in. */
    const zelf = a.inzetbaarheid === 'deels' || a.inzetbaarheid === 'aangepast';
    return { plan: false, wat: a.wat, inzetbaarheid: a.inzetbaarheid || null,
      zin: zelf ? a.wat + ', ' + a.inzetbaarheid + ' inzetbaar: plan dit zelf in.' : a.wat + '.' };
  };
}

/* De zin die een planner meegeeft als het register niet te lezen was. */
const NIET_GELEZEN = 'Het verzuimregister was niet te lezen; afwezigheid is in dit rooster NIET meegewogen.';

/* Een rooster dat een MENS vaststelt, opnieuw nakijken (PERSONEEL.md par. 4):
   tussen voorstel en akkoord kan iemand zich ziek melden of verlof krijgen.
   Per dag wie er op een dienst staat terwijl hij niet inplanbaar is -- een
   waarschuwing en geen weigering, want vaststellen is het besluit van die
   mens. null als het register niet te lezen was: niet nagekeken. */
function naKijken(inplanbaar, code, dagen, vrij) {
  const uit = [];
  for (const dag of dagen || []) for (const m of dag.staff || []) {
    if (m.shift === vrij) continue;
    const ip = inplanbaar(code, m.id, dag.date);
    if (ip.onbekend) return null;
    if (!ip.plan) uit.push({ datum: dag.date, id: m.id, naam: m.name, wat: ip.wat, inzetbaarheid: ip.inzetbaarheid });
  }
  return uit;
}

module.exports = { maakInplanbaar, naKijken, NIET_GELEZEN };
