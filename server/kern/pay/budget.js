/* EEN BUDGET GEVEN: de uitgifte, met de euro's erbij.

   kern/waarde/uitgifte.js maakt alleen de POSITIE -- de rekening, de klasse, de
   eigenaar, het beleid, de vervaldatum. Dit bestand zet er geld op, en dat geld
   komt van de rekening van de uitgever via het gewone grootboek. Een werkgever
   die 500 euro maaltijdbudget uitdeelt, is 500 euro kwijt: dat is geen
   boekhoudkundige formaliteit maar de kernregel uit ./index.js -- geld ontstaat
   nooit uit het niets.

   DE VOLGORDE. Eerst de positie klaarzetten, dan boeken. Faalt de boeking (de
   werkgever heeft het niet, of het plafond van de klasse zit in de weg), dan
   blijft er een lege positie achter. Dat is bewust de goede kant om op te
   falen: een lege positie is zichtbaar, verwarrend hooguit, en kost niemand
   geld. Andersom -- eerst boeken, dan de positie maken -- zou geld op een
   rekening zetten die nog geen klasse heeft, en dan staat er tussen die twee
   stappen saldo zonder regels. Dat is precies wat deze hele laag moet
   voorkomen.

   WIE MAG DIT. Niet deze module: hij kent geen sessies en geen rollen. De
   aanroeper (server/routes/pay.js) bepaalt wie de uitgever is en boekt van
   diens eigen rekening. Zo kan een werkgever nooit uitdelen uit de pot van een
   ander -- niet omdat dit bestand dat tegenhoudt, maar omdat er geen manier is
   om het te vragen.

   Krijgt de gedeelde ctx van kern/pay/index.js. */
module.exports = (ctx) => {
  const { metIdem, boekAsync, seintje, waarde, saldoVan, schoon } = ctx;

  async function budgetGeef({ uitgeverRek, uitgever, aanCodenaam, klasse, centen, beleid, vervaltOp, oms, idem }) {
    if (!waarde) return { status: 501, error: 'Budgetten zijn hier niet ingeschakeld.' };
    const c = Math.round(Number(centen));
    return metIdem(idem ? 'budget:' + uitgeverRek + ':' + idem : null,
      'budget|' + uitgeverRek + '|' + aanCodenaam + '|' + klasse + '|' + c, async () => {
      const v = waarde.uitgifteVoorbereiden({ klasse, aanCodenaam, centen: c,
        uitgever, beleid, vervaltOp, oms });
      if (v.error) return v;
      const b = await boekAsync({ van: uitgeverRek, naar: v.rek, centen: c,
        soort: 'budget', oms: schoon(oms, 120) || v.oms, ref: v.id });
      if (b.error) return b;
      seintje(aanCodenaam);
      return { ok: true, positie: v.rek, id: v.id, klasse: v.klasse, aan: aanCodenaam,
        centen: c, vervaltOp: v.vervaltOp, restantUitgever: saldoVan(uitgeverRek) };
    });
  }

  /* Wat deze uitgever heeft uitstaan: de posities die hij heeft gegeven en wat
     daar nog op staat. Voor een werkgever is dat een ander getal dan wat hij
     heeft uitgedeeld -- er is intussen van uitgegeven, en er kan van vervallen
     zijn. */
  function budgettenVan(uitgever) {
    if (!waarde) return { ok: true, posities: [] };
    const uit = [];
    for (const rek of waarde.SOORTEN.length ? Object.keys(ctx.d().waardePosities || {}) : []) {
      const p = waarde.positie(rek);
      if (!p || p.uitgever !== uitgever) continue;
      uit.push({ rek, klasse: p.klasse, aan: p.eigenaar, saldo: saldoVan(rek),
        vervaltOp: p.vervaltOp, beleid: p.beleid });
    }
    return { ok: true, posities: uit, uitstaandCenten: uit.reduce((s, x) => s + x.saldo, 0) };
  }

  return { budgetGeef, budgettenVan };
};
