/* Mobility OS (deelmodule): de controle van een kaartje door het personeel.
   De verkoop staat in ./kaartje, de storing en de teruggave in ./storing.

   DIT IS DE ENIGE PLEK WAAR EEN KAARTJE WORDT OPGEBRUIKT. Er is geen tweede weg
   om `validaties` te vullen -- ook niet voor de reiziger zelf, want dan kon
   iemand zijn eigen retour "gebruiken" om de terugweg vrij te spelen.

   WAT DE CONDUCTEUR TE ZIEN KRIJGT IS BEWUST WEINIG. Geldig of niet, welk
   product, en tot wanneer. GEEN naam, geen reisgeschiedenis, geen wallet: hij
   controleert een vervoerbewijs, hij doet geen persoonsonderzoek. De codenaam
   staat er wel bij, want anders kan hij twee reizigers met hetzelfde product
   niet uit elkaar houden bij een geschil. */

module.exports = (ctx) => {
  const { save, schoon, nu, logActivity, kaartMet, kaartStand, ensureKaartjes } = ctx;

  /* De controle. Het personeel tikt of scant de code; het antwoord is kort en
     eenduidig, want een conducteur staat in een rijdende bus. */
  function kaartControle(supplier, actor, body = {}) {
    ensureKaartjes();
    const code = schoon(body.code, 40).toUpperCase();
    if (!code) return { status: 400, error: 'Geen code.' };
    const k = kaartMet(code);
    if (!k) return { status: 404, error: 'Dit vervoerbewijs kennen wij niet.', geldig: false };
    if (k.vervoerder !== supplier.code)
      return { status: 403, error: 'Dit kaartje is van een andere vervoerder (' + k.vervoerderNaam + ').', geldig: false };

    const st = kaartStand(k);
    if (st.stand !== 'geldig')
      return { status: 409, error: 'Niet geldig: ' + st.reden, geldig: false, stand: st.stand, kaartje: kort(k, st) };

    /* Een lijn mag meegegeven worden (de conducteur zit op lijn X); staat het
       kaartje op een andere lijn, dan is het hier niet geldig. Zonder deze
       controle is een goedkoop kaartje op de stadslijn ook geldig op de ferry.
       Een ABONNEMENT hangt niet aan een lijn maar aan de lijnen die de
       overeenkomst dekte toen het werd gekocht; die lijst beslist. */
    const lijnId = schoon(body.lijnId, 40);
    const past = k.product === 'abonnement'
      ? (!lijnId || (ctx.aboGeldtOp && ctx.aboGeldtOp(k, lijnId)))
      : (!lijnId || lijnId === k.lijnId);
    if (!past)
      return { status: 409, error: k.product === 'abonnement'
        ? 'Dit abonnement geldt niet op deze lijn.'
        : 'Dit kaartje geldt voor ' + k.lijnNaam + ', niet voor deze lijn.',
        geldig: false, kaartje: kort(k, st) };

    k.validaties = (k.validaties || []).concat([{ at: nu(), door: schoon(actor, 60) || 'personeel',
      lijnId: k.lijnId, lijnNaam: k.lijnNaam }]);
    save();
    const na = kaartStand(k);
    logActivity(supplier.code, actor, 'controleerde een ' + k.product + ' op ' + k.lijnNaam);
    return { ok: true, geldig: true, kaartje: kort(k, na),
      melding: k.product === 'abonnement'
        ? 'Geldig abonnement. ' + na.reden + '.'
        : 'Geldig. ' + (na.rittenOver ? na.rittenOver + ' rit(ten) over.' : 'Dit was de laatste rit op dit kaartje.') };
  }

  // wat de conducteur ziet: het bewijs, niet de persoon
  const kort = (k, st) => ({ product: k.product, lijnNaam: k.lijnNaam,
    van: k.van ? k.van.naam : null, naar: k.naar ? k.naar.naam : null,
    geldigTot: k.geldigTot, stand: st.stand, reden: st.reden,
    rittenOver: st.rittenOver != null ? st.rittenOver : 0, codenaam: k.codenaam });
  return { kaartControle };
};
