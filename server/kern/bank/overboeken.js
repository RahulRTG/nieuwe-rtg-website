/* RTG Bank, deel "overboeken": geld in beweging. Interne overboekingen tussen
   rekeningen (direct), storten (waar de 3-standen knop van de boardroom bijt: via
   de externe kaart-naad of als eigen emissie), de brug van/naar de RTG Pay-wallet
   en uitgaande SEPA achter de betaal-naad. Idempotent op de clearende paden:
   dubbeltikken kan nooit dubbel afschrijven of dubbel storten.

   De brug met de RTG Pay-wallet staat in ./walletbrug: dat is het enige pad dat
   twee grootboeken tegelijk raakt, en die regel hoort niet tussen deze.
   Krijgt de gedeelde ctx van kern/bank/index.js. */
module.exports = (ctx) => {
  const { db, save, bijeen, crypto, nu, d, boekAsync, rekMeta, saldoVan, betaal, pay, bankregie, seintje } = ctx;

  const eigenaar = (iban, codenaam) => { const m = rekMeta(iban); return m && (!codenaam || m.codenaam === String(codenaam).trim()); };

  /* Idempotentie die een herstart overleeft: dezelfde sleutel geeft exact
     hetzelfde antwoord terug en clearet nooit twee keer. */
  // met verzoek-binding; dezelfde module als RTG Pay, zie ../../lib/idem.js.
  // De save-bundel legt boeking en idem-sleutel als EEN commit vast; de kaart-
  // wacht in het werk raakt door de context-binding geen andere verzoeken.
  const metIdem = require('../../lib/idem')({ d, save, naam: 'bankIdem', bijeen });

  /* Storten: extern geld op een rekening zetten. De knop bepaalt hoe het clearet:
     - partner/hybride: via de kaart-naad (Apple Pay/kaart), tegenrekening extern:kaart;
     - eigen:           als eigen emissie van de bank, tegenrekening extern:emissie.
     Route 'auto' kiest de eigen bank zodra die meedraait, anders de kaart. */
  async function storten({ iban, centen, route = 'auto', codenaam, idem, oms }) {
    if (!eigenaar(iban, codenaam)) return { status: 404, error: 'De rekening bestaat niet.' };
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < 100) return { status: 400, error: 'Storten kan vanaf 1 euro.' };
    const cl = bankregie.bankClearing();
    let via = route;
    if (via === 'auto') via = cl.eigen ? 'eigen' : 'kaart';
    if (via === 'eigen' && !cl.eigen) return { status: 409, error: 'De eigen bank clearet nu niet; zet de knop verder.' };
    if (via === 'kaart' && !cl.kaart) return { status: 409, error: 'De kaart-rails staan uit; de eigen bank clearet.' };
    return metIdem(idem ? 'stort:' + iban + ':' + idem : null, 'stort|' + iban + '|' + c + '|' + via, async () => {
      let ref = 'eigen';
      if (via === 'kaart') {
        let betaling;
        try { betaling = await betaal.maakBetaling({ bedrag: c, referentie: 'bank-stort-' + iban + '-' + nu(), idempotentieSleutel: idem ? 'bank-stort:' + iban + ':' + idem : undefined, omschrijving: oms || 'RTG Bank storten' }); }
        catch (e) { return { status: 502, error: 'De betaling lukte niet: ' + e.message }; }
        if (betaling.status !== 'betaald' && betaling.status !== 'succeeded') return { status: 402, error: 'De betaling wacht op bevestiging.', betaalStatus: betaling.status };
        ref = betaling.id;
      }
      const van = via === 'eigen' ? 'extern:emissie' : 'extern:kaart';
      const b = await boekAsync({ van, naar: iban, centen: c, soort: 'storting', oms: oms || 'Storting', ref });
      if (b.error) { if (via === 'eigen') bankregie.bankClearingMislukt('emissie-boek'); return b; }
      if (via === 'eigen') bankregie.bankClearingGelukt(); // een geslaagde eigen-clearing wist de mislukt-teller
      seintje(rekMeta(iban).codenaam);
      return { ok: true, iban, via, saldoCenten: saldoVan(iban), gestort: c };
    });
  }

  // interne overboeking tussen twee rekeningen (direct, geen kosten)
  async function overboek({ vanIban, naarIban, centen, oms, codenaam }) {
    if (!eigenaar(vanIban, codenaam)) return { status: 404, error: 'De bronrekening bestaat niet.' };
    if (!rekMeta(naarIban)) return { status: 404, error: 'De tegenrekening bestaat niet.' };
    const b = await boekAsync({ van: vanIban, naar: naarIban, centen: Math.round(Number(centen)), soort: 'overboeking', oms: oms || 'Overboeking' });
    if (b.error) return b;
    seintje(rekMeta(vanIban).codenaam);
    seintje(rekMeta(naarIban).codenaam);
    return { ok: true, saldoCenten: saldoVan(vanIban), boeking: b.boeking };
  }

  /* Uitgaande SEPA naar een externe bank, achter de betaal-naad (payout). Een
     eventueel tarief (boardroom) gaat naar rtg:reserve. */
  async function sepaUit({ iban, codenaam, centen, naarIban, begunstigde, oms, idem }) {
    if (!eigenaar(iban, codenaam)) return { status: 404, error: 'De rekening bestaat niet.' };
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < 100) return { status: 400, error: 'Een SEPA-overboeking is minimaal 1 euro.' };
    const dest = String(naarIban || '').replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(dest)) return { status: 400, error: 'Vul een geldig IBAN in.' };
    const fooi = bankregie.bankTarief('sepaUitCenten');
    return metIdem(idem ? 'sepa:' + iban + ':' + idem : null, 'sepa|' + iban + '|' + c + '|' + dest, async () => {
      const b = await boekAsync({ van: iban, naar: 'extern:sepa', centen: c, soort: 'sepa-uit', oms: oms || ('SEPA naar ' + dest), ref: dest });
      if (b.error) return b;
      let tariefRef = null;
      if (fooi > 0) {
        const t = await boekAsync({ van: iban, naar: 'rtg:reserve', centen: fooi, soort: 'tarief', oms: 'SEPA-tarief' });
        if (!t.error) tariefRef = t.boeking.id;
      }
      /* Eerst de opdracht VASTLEGGEN, dan pas de rail bellen. Hier stond een
         aanroep met een lege catch eronder: mislukte de payout, dan was het
         geld van de rekening af, stond het op extern:sepa, sloot het grootboek
         netjes en gebeurde er buiten RTG nooit meer iets. Nu overleeft de
         opdracht de mislukking en zelfs een herstart; ../betaalopdracht.js
         probeert hem opnieuw met dezelfde sleutel en boekt terug als de rail
         het blijft weigeren. */
      const op = ctx.opdrachten.maak({
        soort: 'sepa-uit', rail: 'betaalnaad', centen: c, bron: iban, bestemming: dest,
        begunstigde: begunstigde || '', oms: oms || 'RTG Bank SEPA', ledgerRef: b.boeking.id,
        tariefCenten: fooi, tariefRef,
        idemSleutel: 'bank-sepa:' + iban + ':' + (idem || b.boeking.id)
      });
      const na = await ctx.opdrachten.dienIn(op);
      seintje(rekMeta(iban).codenaam);
      /* Wat het lid te horen krijgt is nu de waarheid en niet "gelukt": de
         opdracht staat, maar of hij bij de bank van de ontvanger is aangekomen
         weten we hier nog niet. Vandaar de status erbij. */
      return { ok: true, saldoCenten: saldoVan(iban), overgemaakt: c, tarief: fooi, naar: dest,
        opdrachtId: op.id, opdrachtStatus: na.status };
    });
  }

  return { bankStorten: storten, bankOverboek: overboek, bankSepaUit: sepaUit };
};
