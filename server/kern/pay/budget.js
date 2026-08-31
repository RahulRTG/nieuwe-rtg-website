/* EEN BUDGET GEVEN: de uitgifte, met de euro's erbij.

   kern/waarde/uitgifte.js maakt alleen de POSITIE -- de rekening, de klasse, de
   eigenaar, het beleid, de vervaldatum. Dit bestand zet er geld op, en dat geld
   komt van de rekening van de uitgever via het gewone grootboek. Een werkgever
   die 500 euro maaltijdbudget uitdeelt, is 500 euro kwijt: dat is geen
   boekhoudkundige formaliteit maar de kernregel uit ./index.js -- geld ontstaat
   nooit uit het niets.

   DE VOLGORDE. Eerst de positie klaarzetten, dan boeken. Andersom -- eerst
   boeken, dan de positie maken -- zou geld op een rekening zetten die nog geen
   klasse heeft, en dan staat er tussen die twee stappen saldo zonder regels.
   Dat is precies wat deze hele laag moet voorkomen. Die volgorde blijft dus.

   MAAR DE LEGE POSITIE MAG NIET BLIJVEN STAAN, en hier stond tot 31 augustus
   2026 het tegenovergestelde: "een lege positie is zichtbaar, verwarrend
   hooguit, en kost niemand geld". Dat eerste klopt en het tweede ook -- alleen
   ontbrak er een regel in de redenering. kern/waarde/uitgifte.js laat
   MAX_PER_LID = 25 open posities per lid toe, met als reden "meer open
   budgetten per lid is een lek, geen gebruik".

   Gemeten: 24 mislukte pogingen van EEN werkgever met te weinig saldo (402,
   "Onvoldoende saldo") laten 24 lege posities achter, en bij de 25e krijgt het
   LID 429 "Dit lid heeft te veel open posities" -- van iedereen, niet alleen
   van die werkgever. Twee besluiten die elk apart kloppen en samen een lid
   buitensluiten, zonder dat er iets kwaadwilligs gebeurt: een werkgever die
   het even niet heeft en het opnieuw probeert, doet dit.

   Faalt de boeking, dan neemt deze module de registratie dus terug. Dat is
   geen vergeten grootboek: er is nooit geld op geweest, en de waardelaag
   weigert de terugname als dat niet is aangetoond (registratieTerug in
   kern/waarde/index.js). Lukt de terugname niet, dan blijft de oude toestand
   staan en zegt het antwoord dat erbij -- stil opruimen is erger dan niet
   opruimen.

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
      if (b.error) {
        /* De positie terugnemen -- zie de kop. Het saldo komt van HIER, want
           de waardelaag houdt er zelf geen bij en neemt niets terug op gezag. */
        const terug = waarde.uitgifteTerug
          ? waarde.uitgifteTerug(v.rek, { saldoCenten: saldoVan(v.rek) })
          : { status: 501, error: 'terugnemen bestaat niet in deze opstelling' };
        if (terug && terug.error) {
          return { ...b, legePositie: v.rek, legePositieReden: terug.error };
        }
        return b;
      }
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
