/* RTG Bank, deel "hart": de bank-app als het FINANCIELE HART voor iedereen.
   Zolang RTG niet officieel de eigen bank mag zijn, lopen stortingen en
   uitbetalingen via de derde-partij-kaartnaad (Stripe/Adyen/Mollie achter
   server/betaal.js) -- maar het lid ziet ALLES in een afschrift, in dezelfde
   opmaak, met alleen een klein bronlabel: RTG Bank, RTG Pay of de provider.
   Daarbovenop de premium-functies die elders geld kosten, hier gratis:
   - INZICHTEN: uitgaven per maand, per soort, met de grootste posten;
   - de VASTE-LASTEN-RADAR: terugkerende afschrijvingen automatisch herkend;
   - WISSELGELD SPAREN: elke uitgave rond af naar de hele euro; een veeg
     boekt het wisselgeld van de maand in een keer naar de spaarrekening
     (die er zo nodig automatisch bij komt). Krijgt de gedeelde ctx van
     kern/bank/index.js. */
module.exports = (ctx) => {
  const { d, boekAsync, rekeningen, rekMeta, saldoVan, betaal } = ctx;

  const PROVIDERS = { stripe: 'Stripe', adyen: 'Adyen', mollie: 'Mollie',
    demo: 'Kaartnaad (demo)', uit: 'Geen externe betaalrail' };
  const providerLabel = () => PROVIDERS[(betaal && betaal.AANBIEDER) || 'demo'] || 'Kaartprovider';
  const mijnIbans = c => Object.values(rekeningen()).filter(m => m.codenaam === c).map(m => m.iban);

  /* Het hart-afschrift: bankboekingen over ALLE eigen rekeningen plus de
     RTG Pay-wallet, samen gesorteerd; extern geld draagt het providerlabel
     maar staat er verder bij zoals elke eigen betaling. */
  function hartVan(codenaam, limit = 60) {
    const c = String(codenaam || '').trim();
    const ibans = new Set(mijnIbans(c));
    const uit = [];
    for (const r of (d().bankBoekingen || [])) {
      const af = ibans.has(r.van), bij = ibans.has(r.naar);
      if (!af && !bij) continue;
      const extern = String(r.van).startsWith('extern:') || String(r.naar).startsWith('extern:');
      uit.push({ at: r.at, af: af && !bij, centen: r.centen, soort: r.soort, oms: r.oms || '',
        tegen: af && !bij ? r.naar : r.van, bron: extern ? providerLabel() : 'RTG Rekening' });
      if (uit.length >= 400) break;
    }
    const wallet = 'lid:' + c;
    for (const r of (d().payBoekingen || [])) {
      if (r.van !== wallet && r.naar !== wallet) continue;
      uit.push({ at: r.at, af: r.van === wallet, centen: r.centen, soort: r.soort, oms: r.oms || '',
        tegen: r.van === wallet ? r.naar : r.van,
        bron: String(r.van).startsWith('extern:') || String(r.naar).startsWith('extern:') ? providerLabel() : 'RTG Pay' });
      if (uit.length >= 800) break;
    }
    uit.sort((a, b) => (b.at || 0) - (a.at || 0));
    return { regels: uit.slice(0, limit), provider: providerLabel() };
  }

  /* Inzichten: de uitgaven van een maand (YYYY-MM), per soort opgeteld. */
  function inzichten(codenaam, maand) {
    const m = /^\d{4}-\d{2}$/.test(String(maand || '')) ? maand : new Date().toISOString().slice(0, 7);
    const alles = hartVan(codenaam, 800).regels
      .filter(r => r.af && new Date(r.at).toISOString().slice(0, 7) === m);
    const perSoort = {};
    for (const r of alles) perSoort[r.soort] = (perSoort[r.soort] || 0) + r.centen;
    return { maand: m, uitgavenCenten: alles.reduce((s, r) => s + r.centen, 0), posten: alles.length,
      perSoort: Object.entries(perSoort).sort((a, b) => b[1] - a[1]).map(([soort, centen]) => ({ soort, centen })),
      grootste: alles.sort((a, b) => b.centen - a.centen).slice(0, 5)
        .map(r => ({ centen: r.centen, oms: r.oms, soort: r.soort, bron: r.bron, at: r.at })) };
  }

  /* De vaste-lasten-radar: dezelfde tegenrekening en hetzelfde bedrag in
     minstens twee verschillende maanden = een vaste last. */
  function vasteLasten(codenaam) {
    const groepen = {};
    for (const r of hartVan(codenaam, 800).regels) {
      if (!r.af) continue;
      const k = r.tegen + '|' + r.centen;
      (groepen[k] = groepen[k] || { tegen: r.tegen, centen: r.centen, oms: r.oms, maanden: new Set() })
        .maanden.add(new Date(r.at).toISOString().slice(0, 7));
    }
    return Object.values(groepen).filter(g => g.maanden.size >= 2)
      .map(g => ({ tegen: g.tegen, centen: g.centen, oms: g.oms, maanden: g.maanden.size }))
      .sort((a, b) => b.centen - a.centen).slice(0, 12);
  }

  /* Wisselgeld sparen: het afrondverschil naar de hele euro van elke uitgave
     van deze maand, in een keer van de betaalrekening naar de spaarrekening.
     Geen spaarrekening? Dan komt die er automatisch bij (premium, gratis). */
  async function veegWisselgeld(codenaam) {
    const c = String(codenaam || '').trim();
    const eigen = Object.values(rekeningen()).filter(m => m.codenaam === c);
    const betaalRek = eigen.find(m => m.soort === 'betaal');
    if (!betaalRek) return { status: 404, error: 'Geen betaalrekening; geef eerst akkoord voor de bank.' };
    let spaar = eigen.find(m => m.soort === 'spaar');
    if (!spaar) {
      const r = await ctx.rekeningOpen({ codenaam: c, soort: 'spaar', naam: 'RTG Wisselgeld-spaarpot', wie: 'lid' });
      if (r.error) return r;
      spaar = r.rekening ? rekMeta(r.rekening.iban) : null;
      if (!spaar) return { status: 500, error: 'De spaarrekening kon niet worden geopend.' };
    }
    const maand = new Date().toISOString().slice(0, 7);
    const st = (d().bankWisselgeld = d().bankWisselgeld || {});
    const alGeveegd = st[c + ':' + maand] || 0;
    let rest = 0;
    for (const r of (d().bankBoekingen || [])) {
      if (r.van !== betaalRek.iban || String(r.soort) === 'wisselgeld') continue;
      if (new Date(r.at).toISOString().slice(0, 7) !== maand) continue;
      rest += (100 - (r.centen % 100)) % 100;
    }
    const teVegen = Math.max(0, rest - alGeveegd);
    if (!teVegen) return { ok: true, geveegdCenten: 0, spaarIban: spaar.iban, melding: 'Geen nieuw wisselgeld deze maand.' };
    if (saldoVan(betaalRek.iban) < teVegen) return { status: 402, error: 'Onvoldoende saldo om het wisselgeld te vegen.' };
    const b = await boekAsync({ van: betaalRek.iban, naar: spaar.iban, centen: teVegen, soort: 'wisselgeld', oms: 'Wisselgeld gespaard (' + maand + ')' });
    if (b.error) return b;
    st[c + ':' + maand] = alGeveegd + teVegen;
    ctx.save();
    return { ok: true, geveegdCenten: teVegen, spaarIban: spaar.iban, spaarSaldo: saldoVan(spaar.iban) };
  }

  return { bankHart: hartVan, bankInzichten: inzichten, bankVasteLasten: vasteLasten, bankVeegWisselgeld: veegWisselgeld };
};
