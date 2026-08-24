/* BETALEN UIT MEERDERE POTJES: één tik van het lid, één of meer boekingen.

   Tot nu toe was betalen uit een wallet één boeking, want er was één wallet.
   Sinds een lid ook een maaltijdbudget of een gemeentetegoed kan hebben, is een
   betaling van 72 euro soms 25 + 12 + 35. Het lid hoort daar niets van te
   merken behalve de regel "€ 72 betaald" en, als hij doorklikt, waaruit.

   WAT HIER GEEN VRIJHEID IS. Elk deel gaat langs boekAsync en dus langs de
   waardepoort -- ook de delen die uit een budget komen. Dat lijkt dubbelop
   omdat de samensteller het beleid al toetste, en het is het niet: de
   samensteller rekent uit wat er zou moeten gebeuren, de poort bepaalt wat er
   mag gebeuren. Zou dit bestand rechtstreeks boeken, dan omzeilde het de poort
   precies bij de betalingen waar het beleid het strengst is.

   DE TERUGDRAAI, en waarom die HIER wel mag en bij een uitbetaling niet.
   kern/pay/kassa.js beschrijft in zijn eigen kop waarom een compensatie bij een
   partneruitbetaling gevaarlijk is: bij een timeout van een externe rail weet
   je juist niet of de betaling is aangekomen, dus terugboeken kan betekenen dat
   je twee keer betaalt. Hier is daar geen sprake van. Alle delen zijn INTERNE
   boekingen in hetzelfde grootboek, synchroon, zonder externe partij en zonder
   timeout: als deel drie weigert, is deel drie niet gebeurd -- daar bestaat geen
   twijfel over. Dan zijn de eerste twee terugdraaien de enige juiste uitkomst,
   want een half betaalde rekening is voor niemand een uitkomst.

   De enige echte I/O (het bijladen van de eigen wallet) gebeurt daarom VOORAF,
   vóór er iets geboekt is. Faalt dat, dan is er nog niets gebeurd.

   Krijgt de gedeelde ctx van kern/pay/index.js. */
module.exports = (ctx) => {
  const { grootboek, rekLid, saldoVan, boekAsync, zorgSaldo, waarde, schoon } = ctx;

  /* Wat is er vandaag al van deze positie afgegaan? Zonder dit getal is een
     dagmaximum in het beleid een regel die nooit bijt -- en een regel die nooit
     bijt, is erger dan geen regel, want er staat wel een belofte tegenover. */
  function dagBestedVan(rek) {
    const dag = new Date().toISOString().slice(0, 10);
    let som = 0;
    for (const r of grootboek()) {
      if (r.van !== rek) continue;
      if (new Date(r.at || 0).toISOString().slice(0, 10) !== dag) break; // het grootboek is nieuwste-eerst
      if (r.soort === 'terug') continue;
      som += r.centen;
    }
    return som;
  }

  /* De samenstelling opvragen. Zonder waardelaag is er per definitie één potje
     en is dit exact wat er altijd gebeurde: alles uit de eigen wallet. */
  function stelSamen({ codenaam, centen, genre, ontvanger, soort }) {
    if (!waarde) return { ok: true, delen: [{ rek: rekLid(codenaam), centen: Math.round(Number(centen)), eigen: true }] };
    return waarde.samenstellen({ codenaam, centen, genre, ontvanger, soort,
      saldoVan, dagBestedVan, nu: Date.now() });
  }

  async function betaalUit({ codenaam, naar, centen, genre, oms, ref, idem, soort }) {
    const c = Math.round(Number(centen));
    const s = stelSamen({ codenaam, centen: c, genre, ontvanger: String(naar || '').replace(/^partner:/, ''), soort });
    if (s.error) return s;

    // eerst de eigen wallet op peil brengen: de enige stap met echte I/O
    let bijgeladen = 0;
    const eigenDeel = s.delen.find(d => d.eigen);
    if (eigenDeel) {
      const z = await zorgSaldo({ codenaam, centen: eigenDeel.centen, idem });
      if (z.error) return z;
      bijgeladen = z.bijgeladen || 0;
    }

    const geboekt = [];
    for (const deel of s.delen) {
      /* Het genre en het al-bestede-vandaag reizen mee: de poort toetst
         hetzelfde beleid als de samensteller, dus hij moet dezelfde gegevens
         hebben. Zonder deze twee weigert de poort precies de delen die de
         samensteller zorgvuldig had uitgekozen. */
      const b = await boekAsync({ van: deel.rek, naar, centen: deel.centen, genre,
        dagBesteed: dagBestedVan(deel.rek),
        soort: soort || 'kassa', oms: schoon(oms, 120) || 'Betaling', ref: ref || null });
      if (b.error) {
        // interne boekingen, synchroon, geen twijfel: draai terug wat er staat
        for (const g of geboekt.reverse()) {
          await boekAsync({ van: naar, naar: g.rek, centen: g.centen, soort: 'terug',
            oms: 'Deelbetaling teruggedraaid', ref: ref || null });
        }
        return b;
      }
      geboekt.push({ rek: deel.rek, centen: deel.centen, klasse: deel.klasse, boeking: b.boeking.id });
    }
    return { ok: true, centen: c, bijgeladen, delen: geboekt,
      gebonden: geboekt.filter(g => g.rek !== rekLid(codenaam)).reduce((x, g) => x + g.centen, 0) };
  }

  return { betaalUit, dagBestedVan, stelSamen };
};
