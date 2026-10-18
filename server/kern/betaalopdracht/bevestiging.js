/* DE BEVESTIGING VAN BUITEN -- het enige punt waarop een betaalopdracht van
   "aangenomen" naar "definitief" gaat.

   Stond tot 18 oktober 2026 in ./rij.js. Die kant weet wat RTG zelf over de
   verzameling weet (wie aan de beurt is, wat openstaat); deze kant verwerkt wat
   de RAIL ons vertelt. Dat is een eigen grens: hier komt een uitspraak van
   buiten binnen, en hier wordt besloten of RTG mag zeggen dat het geld er is.
   Het knippen gebeurde toen de rij een vergelijking op de idem-sleutel kreeg en
   over de 10 kB-grens van keuringsregel 13 ging. Krijgt de gedeelde ctx van
   ./index en de twee opzoekers van ./rij. */
'use strict';

module.exports = (ctx, { vind, vindOpSettlement }) => {
  const { save, STATUS, publiek, zet } = ctx;

  /* DE BEVESTIGING VAN BUITEN (de provider-webhook): pas hier gaat een opdracht
     van "aangenomen" naar "definitief". Dit is het enige punt waarop RTG mag
     zeggen dat het geld er is, want tot dan weten we alleen dat de rail hem
     heeft aangenomen.

     Aanroepen kan op twee manieren: met onze eigen `id` (het kantoor), of met de
     `settlementRef` van de provider. Dat tweede is de payout-webhook in
     server/opzet/webhooks.js: die kent onze id niet, alleen zijn eigen.

     Meldt de rail een MISLUKKING, dan is de status zetten niet genoeg -- het
     geld staat van de klant af en komt nergens aan. Dan draait dezelfde
     terugboeking als bij opgeven. Zonder dat zou hier precies het gat terugkomen
     dat deze hele module dichtzet, alleen een dag later in de tijdlijn. */
  async function bevestig({ id, settlementRef, gelukt = true, reden }) {
    const o = id ? vind(id) : vindOpSettlement(settlementRef);
    if (!o) return { status: 404, error: 'Die betaalopdracht bestaat niet.' };
    if (gelukt) {
      const voor = Object.assign({}, o);
      zet(o, STATUS.AFGEWIKKELD, { settlementRef: settlementRef || o.settlementRef });
      try { save(); }
      catch (e) {
        /* Een mislukte persist mag niet alleen in RAM definitief worden. Een
           providerretry moet dezelfde overgang opnieuw kunnen vastleggen. */
        for (const sleutel of Object.keys(o)) if (!Object.prototype.hasOwnProperty.call(voor, sleutel)) delete o[sleutel];
        Object.assign(o, voor);
        throw e;
      }
      /* Een late `paid` na een al teruggeboekte mislukking is een conflict,
         geen toestemming om alsnog de interne claim/ledgerfinalisatie te
         draaien. Alleen de werkelijk afgewikkelde staat mag die haak bereiken. */
      if (o.status !== STATUS.AFGEWIKKELD) return publiek(o);
      const klaar = await ctx.verwerkAfwikkeling(o);
      if (!klaar) {
        const e = new Error('De payout is extern bevestigd, maar intern nog niet volledig afgehandeld.');
        e.code = 'PAYOUT_AFHANDELING_MISLUKT';
        throw e;
      }
      return publiek(o);
    }
    if (o.status === STATUS.TERUGGEBOEKT) return publiek(o);
    const voor = Object.assign({}, o);
    zet(o, STATUS.MISLUKT, { laatsteFout: String(reden || 'de rail meldde een mislukking').slice(0, 300), volgendeAt: null });
    try { save(); }
    catch (e) {
      for (const sleutel of Object.keys(o)) if (!Object.prototype.hasOwnProperty.call(voor, sleutel)) delete o[sleutel];
      Object.assign(o, voor);
      throw e;
    }
    /* Ook een al eerder als MISLUKT vastgelegde payout moet hier terugkomen:
       het proces kan precies tussen die save en de teruggang zijn gestopt. */
    if (o.status === STATUS.MISLUKT && !(await ctx.draaiTerug(o))) {
      const e = new Error('De mislukte payout kon nog niet veilig worden teruggeboekt.');
      e.code = 'PAYOUT_TERUGBOEKING_MISLUKT';
      throw e;
    }
    return publiek(o);
  }

  return { bevestig };
};
