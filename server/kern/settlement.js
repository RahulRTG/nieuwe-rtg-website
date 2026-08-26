/* DE AFWIKKELING VAN EEN BEVESTIGDE BETALING -- voor munten EN voor de kaart.

   Hij heette settleMuntFactuur, stond middenin server.js en kende alleen de
   muntkant. De kaartkant werd NOOIT afgewikkeld: /api/betaal/webhook
   verifieerde de handtekening en LOGDE de gebeurtenis, meer niet. In demostand
   viel dat niet op omdat de demo-provider meteen 'betaald' antwoordt en
   routes/member/betalen.js de factuur dan zelf afboekt. Met een ECHTE
   Stripe-sleutel gebeurt dat juist niet -- daar staat letterlijk "de
   definitieve bevestiging komt via de webhook, en markeren we hier nog niets
   als betaald" -- en die bevestiging kwam nooit aan. In productie werd dus geen
   enkele factuur ooit betaald.

   Een GEDEELDE afwikkeling en niet twee: anders krijgt de kaartkant ooit wel de
   bedragcontrole en de muntkant niet, of andersom. En een EIGEN MODULE, want in
   server.js was dit niet los te toetsen -- en precies daar zat de fout die
   jarenlang niemand opviel.

   De afhankelijkheden komen binnen via de fabriek, zodat een toets een eigen
   db, accounts en fonds kan meegeven. */
module.exports = { maakSettlement };

function maakSettlement({ db, save, accounts, fonds, log, dpRegistreerMunt, dpRegistreerBevestigd, payOplaadAfronden, payIbanBevestigd }) {
  return async function settleFactuur(ctx, betaling) {
  if (!ctx) return { status: 400, error: 'Settlementcontext ontbreekt.' };
  // Een rechtstreekse betaling aan een partner: pas na een geverifieerde
  // providerbevestiging en alleen voor exact het aangevraagde bedrag.
  if (ctx.soort === 'direct') {
    const binnen = Math.round(Number(betaling && betaling.centen) || 0);
    const verwacht = Math.round(Number(ctx.centen) || binnen);
    if (binnen <= 0 || binnen !== verwacht) {
      if (log && log.error) log.error('settlement: directe betaling niet geboekt; bedrag wijkt af',
        { betaalId: betaling && betaling.id, verwacht, binnen });
      return { status: 409, error: 'Het bevestigde bedrag wijkt af van de betaalopdracht.' };
    }
    const registreer = ctx.betaalwijze === 'munt' ? dpRegistreerMunt : dpRegistreerBevestigd;
    if (typeof registreer !== 'function')
      return { status: 500, error: 'De bevestigde directe betaalroute is niet aangesloten.' };
    try {
      const r = registreer({ key: ctx.key, codename: ctx.codename, supplierCode: ctx.supplierCode,
        bedragCenten: binnen, omschrijving: ctx.omschrijving, bron: ctx.bron,
        providerId: betaling && betaling.id, idem: ctx.idem,
        aanbieder: ctx.betaalwijze === 'munt' ? 'munt' : 'stripe', betaalwijze: ctx.betaalwijze || 'kaart' });
      return r && r.error ? r : { ok: true, betaling: r && r.betaling };
    } catch (e) {
      if (log && log.error) log.error('settlement: directe betaling NIET geboekt: ' + e.message,
        { betaalId: betaling && betaling.id });
      return { status: 500, error: 'De bevestigde betaling kon niet worden geboekt.' };
    }
  }
  /* Een OPLADING van de RTG Pay-wallet. Deze tak ontbrak, en daarmee viel de
     hele oplaad-stroom bij een echte aanbieder in het niets: de kaart werd
     afgeschreven, de wallet nooit bijgeschreven, en de webhook antwoordde
     200 ok. Zelfde blinde vlek als hierboven bij de facturen -- in demostand
     is een betaling meteen 'betaald' en komt de code hier niet eens langs.

     Het bijschrijven gaat door DEZELFDE boeking als de directe oplading
     (payOplaadAfronden in kern/pay), zodat er geen tweede boekingsregel
     ontstaat die ooit uit de pas gaat lopen met de eerste. De webhook heeft de
     regel al uit kaartWachtend gehaald voor hij ons aanroept, dus een herhaalde
     webhook boekt niets dubbel. */
  if (ctx.soort === 'oplaad') {
    if (!payOplaadAfronden) { (log && log.error || console.error)('[settlement] oplading kan niet worden bijgeschreven: de betaalkern ontbreekt', { id: betaling && betaling.id }); return { status: 500, error: 'Betaalkern ontbreekt.' }; }
    try {
      const r = await payOplaadAfronden({ codenaam: ctx.codenaam, centen: betaling.centen, oms: ctx.oms, ref: betaling.id });
      if (r && r.error) { (log && log.error || console.error)('[settlement] oplading NIET bijgeschreven: ' + r.error, { id: betaling && betaling.id }); return r; }
      /* HET BETALER-IBAN BEVESTIGEN, als de aanbieder het meestuurde. Heeft dit
         lid dezelfde rekening als uitbetaalrekening ingesteld, dan is die
         daarmee bewezen van hem en vervalt de wachttijd: hij haalt zijn geld
         terug naar de rekening waarvandaan het kwam.

         Dit ZET geen rekening -- het bevestigt er alleen een die het lid zelf
         heeft ingevoerd (kern/pay/uitbetaalrekening.js weigert als het IBAN niet
         overeenkomt). Zou een providerantwoord een bestemming kunnen aanmaken,
         dan is een nagebootste melding genoeg om geld om te leiden.

         Buiten de foutafhandeling van de boeking om, en met opzet: een mislukte
         bevestiging is een gemiste versnelling, geen verloren cent. De oplading
         laten mislukken omdat een comfortstap niet lukte, zou het lid zijn geld
         kosten voor een detail. */
      if (payIbanBevestigd && betaling.betalerIban && ctx.userId) {
        try { payIbanBevestigd({ userId: ctx.userId, iban: betaling.betalerIban }); }
        catch (e) { /* comfort, geen geld */ }
      }
      return { ok: true };
    } catch (e) {
      (log && log.error || console.error)('[settlement] oplading NIET bijgeschreven: ' + e.message, { id: betaling && betaling.id });
      return { status: 500, error: 'Oplading kon niet worden bijgeschreven.' };
    }
  }
  if (ctx.soort !== 'factuur') return { ok: true };
  const md = ctx.own ? accounts.getMemberState(ctx.accountId) : db.data;
  if (!md) return { status: 404, error: 'Ledenstaat ontbreekt.' };
  const inv = (md.invoices || []).find(i => i.id === ctx.invoiceId);
  if (!inv || inv.status === 'paid') return { ok: true };
  /* BETAALD MAG ALLEEN BETAALD HETEN ALS HET HELE BEDRAG ER IS.

     Hier stond `inv.status = 'paid'` onvoorwaardelijk, met alleen de vraag OF er
     een bevestiging was -- niet voor hoeveel. Het bedrag komt uit het bericht van
     de aanbieder (kern/munten.js bevestig), dus een bevestiging van een cent
     sloot een factuur van EUR 78,65. De handtekening beschermt tegen een vreemde
     afzender; tegen een te laag bedrag beschermde niets.

     Wat er te weinig binnenkomt gooien we NIET weg -- het is echt geld van een
     lid. Het wordt geboekt als deelbetaling, de factuur blijft open, en zodra de
     som het gevraagde dekt gaat hij alsnog dicht. */
  const gevraagd = Math.round((inv.bijdrage || 0) * 100);
  const binnen = Math.round(betaling.centen || 0);
  inv.deelbetaald = Math.round((inv.deelbetaald || 0) + binnen);
  if (gevraagd > 0 && inv.deelbetaald < gevraagd) {
    log.warn('settlement: te weinig ontvangen, factuur blijft open',
      { factuur: inv.id, gevraagd, binnen, totaal: inv.deelbetaald, betaalId: betaling.id, hoe: betaling.hoe });
    if (ctx.own) accounts.saveMemberState(ctx.accountId, md); else save();
    return { ok: true, gedeeltelijk: true };
  }
  inv.status = 'paid';
  inv.date = betaling.hoe;
  inv.betaalId = betaling.id;
  if (fonds.isAbonnement(inv.desc)) {
    try { await fonds.boekAfdracht({ invoiceId: inv.id, wie: ctx.wie, bijdrage: inv.bijdrage, betaalId: betaling.id, omschrijving: inv.desc }); }
    catch (e) { /* de afdracht mag de settlement nooit blokkeren */ }
  }
  if (ctx.own) accounts.saveMemberState(ctx.accountId, md); else save();
  return { ok: true };
}
}
