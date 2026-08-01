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

function maakSettlement({ db, save, accounts, fonds, log, dpRegistreerMunt }) {
  return async function settleFactuur(ctx, betaling) {
  if (!ctx) return;
  // Een rechtstreekse betaling aan een partner met munten: de leverancier wordt
  // gecrediteerd (het geld is al binnen en omgezet naar euro).
  if (ctx.soort === 'direct') {
    try { dpRegistreerMunt({ key: ctx.key, codename: ctx.codename, supplierCode: ctx.supplierCode, bedragCenten: betaling.centen, omschrijving: ctx.omschrijving }); }
    catch (e) { /* de afdracht mag de settlement nooit blokkeren */ }
    return;
  }
  if (ctx.soort !== 'factuur') return;
  const md = ctx.own ? accounts.getMemberState(ctx.accountId) : db.data;
  if (!md) return;
  const inv = (md.invoices || []).find(i => i.id === ctx.invoiceId);
  if (!inv || inv.status === 'paid') return;
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
    return;
  }
  inv.status = 'paid';
  inv.date = betaling.hoe;
  inv.betaalId = betaling.id;
  if (fonds.isAbonnement(inv.desc)) {
    try { await fonds.boekAfdracht({ invoiceId: inv.id, wie: ctx.wie, bijdrage: inv.bijdrage, betaalId: betaling.id, omschrijving: inv.desc }); }
    catch (e) { /* de afdracht mag de settlement nooit blokkeren */ }
  }
  if (ctx.own) accounts.saveMemberState(ctx.accountId, md); else save();
}
}
