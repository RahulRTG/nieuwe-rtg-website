/* Read projections voor de sociale waardestroom. De Economic Runtime bezit
   intents, claims en settlements; deze laag vertaalt ze alleen naar bestaande
   fonds- en backofficeschermen. */
'use strict';

module.exports = function maakFondsProjecties({ lijst, bestemming, runtime }) {
  function fondsOverzicht() {
    let totaal = 0, teStorten = 0, gestort = 0, ingepland = 0, afwikkelingNodig = 0;
    for (const a of lijst()) {
      totaal += a.centen || 0;
      if (Array.isArray(a.legs)) {
        for (const l of a.legs) {
          if (l.status === 'gestort') gestort += l.centen || 0;
          else if (l.status === 'ingepland' || l.status === 'gepland') ingepland += l.centen || 0;
          else {
            teStorten += l.centen || 0;
            if (l.status === 'afwikkeling_nodig') afwikkelingNodig += l.centen || 0;
          }
        }
      } else if (a.status === 'gestort') gestort += a.centen || 0;
      else if (a.status === 'ingepland') ingepland += a.centen || 0;
      else teStorten += a.centen || 0;
    }
    return { aantal: lijst().length, totaalCenten: totaal, teStortenCenten: teStorten,
      ingeplandCenten: ingepland, gestortCenten: gestort,
      afwikkelingNodigCenten: afwikkelingNodig, bestemming: bestemming(),
      economicRuntime: runtime.overzicht(),
      recent: lijst().slice(-12).reverse().map(a => ({ id: a.id,
        economicIntentId: a.economicIntentId || null, invoiceId: a.invoiceId,
        centen: a.centen, status: a.status, legs: a.legs || null, at: a.at })) };
  }

  function socialeEconomicStand() {
    const intents = runtime.intentsVoorPurpose('MEMBERSHIP.CONTRIBUTION');
    const claims = intents.flatMap(i => runtime.claimsVoorIntent(i.id))
      .filter(c => c.component === 'local-fund' || c.component === 'foundation');
    const settlements = claims.flatMap(c => runtime.settlementsVoorClaim(c.id));
    const perDeel = {};
    let open = 0, af = 0;
    for (const c of claims) {
      const p = perDeel[c.component] = perDeel[c.component] ||
        { label: c.component, gereserveerd: 0, betaalbaar: 0, afgewikkeld: 0 };
      const ss = settlements.filter(s => s.claimId === c.id);
      if (c.status === 'SETTLED' || c.status === 'SATISFIED') {
        p.afgewikkeld += c.amountMinor; af += c.amountMinor;
      } else if (ss.some(s => s.status === 'READY' || s.status === 'IN_PROGRESS')) {
        p.betaalbaar += c.amountMinor; open += c.amountMinor;
      } else {
        p.gereserveerd += c.amountMinor; open += c.amountMinor;
      }
    }
    return { ok: true, aantal: intents.length,
      basisCenten: intents.reduce((s, i) => s + i.requestedValue.amountMinor, 0),
      totaalCenten: claims.reduce((s, c) => s + c.amountMinor, 0),
      openCenten: open, afgewikkeldCenten: af, vervallenCenten: 0, perDeel,
      bewijs: runtime.overzicht() };
  }

  return { overzicht: fondsOverzicht, socialeStand: socialeEconomicStand };
};
