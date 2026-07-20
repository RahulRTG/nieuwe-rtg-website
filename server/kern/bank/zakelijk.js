/* RTG Bank, deel "zakelijk": zakelijk bankieren. Bulkbetalingen (veel begunstigden
   in één opdracht) en een salarisrun (hetzelfde, met loonstroken-semantiek). Vooraf
   controleren we de hele batch: past het totaal binnen het saldo + de rood-staan-
   ruimte, en bestaan alle tegenrekeningen? Pas dan boeken we, zodat een run nooit
   half blijft steken. Krijgt de gedeelde ctx van kern/bank/index.js. */
module.exports = (ctx) => {
  const { schoon, d, boek, rekMeta, saldoVan, bodem } = ctx;

  const MAX_POSTEN = 5000;

  function batch({ vanIban, posten, codenaam, oms, soort }) {
    const m = rekMeta(vanIban);
    if (!m || (codenaam && m.codenaam !== String(codenaam).trim())) return { status: 404, error: 'De bronrekening bestaat niet.' };
    if (m.bevroren) return { status: 423, error: 'Deze rekening is bevroren.' };
    if (!Array.isArray(posten) || !posten.length) return { status: 400, error: 'Voeg minstens één begunstigde toe.' };
    if (posten.length > MAX_POSTEN) return { status: 400, error: 'Maximaal ' + MAX_POSTEN + ' begunstigden per opdracht.' };
    // eerst valideren: bedragen, tegenrekeningen en het totaal
    const schoonPosten = [];
    let totaal = 0;
    for (const p of posten) {
      const c = Math.round(Number(p && p.centen));
      if (!Number.isFinite(c) || c < 1) return { status: 400, error: 'Elk bedrag moet groter dan nul zijn.' };
      const naar = String((p && p.naarIban) || '');
      if (!rekMeta(naar)) return { status: 404, error: 'Onbekende tegenrekening: ' + naar };
      if (naar === vanIban) return { status: 400, error: 'Een post kan niet naar de bronrekening zelf.' };
      totaal += c;
      schoonPosten.push({ naar, centen: c, oms: schoon((p && p.oms) || oms, 120) || (soort === 'salaris' ? 'Salaris' : 'Betaling') });
    }
    if (saldoVan(vanIban) - totaal < bodem(vanIban)) return { status: 402, error: 'Onvoldoende saldo of rood-staan-ruimte voor de hele batch.' };
    // en dan pas boeken (de voorcontrole maakt dat dit niet half blijft steken)
    let geboekt = 0;
    for (const p of schoonPosten) {
      const b = boek({ van: vanIban, naar: p.naar, centen: p.centen, soort: soort || 'bulk', oms: p.oms });
      if (b.ok) geboekt++;
    }
    return { ok: true, geboekt, aantal: schoonPosten.length, totaalCenten: totaal, saldoCenten: saldoVan(vanIban) };
  }

  return {
    bankBulkBetaal: (a) => batch({ ...a, soort: 'bulk' }),
    bankSalarisRun: (a) => batch({ ...a, soort: 'salaris' })
  };
};
