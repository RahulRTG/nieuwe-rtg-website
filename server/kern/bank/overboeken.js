/* RTG Bank, deel "overboeken": geld in beweging. Interne overboekingen tussen
   rekeningen (direct), storten (waar de 3-standen knop van de boardroom bijt: via
   de externe kaart-naad of als eigen emissie), de brug van/naar de RTG Pay-wallet
   (de infrastructuur die de bank OP Pay bouwt) en uitgaande SEPA achter de
   betaal-naad. Idempotent op de clearende paden: dubbeltikken kan nooit dubbel
   afschrijven of dubbel storten. Krijgt de gedeelde ctx van kern/bank/index.js. */
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

  /* De brug met RTG Pay: geld tussen de wallet (lid:<codenaam>) en de eigen
     betaalrekening. Beide grootboeken blijven sluiten (elk een eigen extern-
     tegenrekening). Begrensd door de wallet-cap van Pay per overboeking. */
  async function walletNaarBank({ iban, codenaam, centen }) {
    const c = String(codenaam || '').trim();
    const m = rekMeta(iban);
    if (!m || m.codenaam !== c) return { status: 404, error: 'De rekening bestaat niet.' };
    const bedrag = Math.round(Number(centen));
    if (!Number.isFinite(bedrag) || bedrag < 1 || bedrag > pay.MAX_CENTEN) return { status: 400, error: 'Kies een bedrag tot ' + (pay.MAX_CENTEN / 100) + ' euro per keer.' };
    // De wallet-kant loopt via het pay-grootboek (in motor-modus dus geguard langs
    // de motor); de bank-kant is het eigen bank-grootboek. Elk sluit apart.
    const uit = await pay.boekAsync({ van: 'lid:' + c, naar: 'extern:bank', centen: bedrag, soort: 'naar-bank', oms: 'Naar RTG Bank' });
    if (uit.error) return uit;
    const in_ = await boekAsync({ van: 'extern:pay', naar: iban, centen: bedrag, soort: 'van-wallet', oms: 'Van RTG Pay' });
    if (in_.error) { await pay.boekAsync({ van: 'extern:bank', naar: 'lid:' + c, centen: bedrag, soort: 'terug', oms: 'Terugboeking' }); return in_; }
    seintje(c);
    return { ok: true, saldoCenten: saldoVan(iban) };
  }
  async function bankNaarWallet({ iban, codenaam, centen }) {
    const c = String(codenaam || '').trim();
    const m = rekMeta(iban);
    if (!m || m.codenaam !== c) return { status: 404, error: 'De rekening bestaat niet.' };
    const bedrag = Math.round(Number(centen));
    if (!Number.isFinite(bedrag) || bedrag < 1 || bedrag > pay.MAX_CENTEN) return { status: 400, error: 'Kies een bedrag tot ' + (pay.MAX_CENTEN / 100) + ' euro per keer.' };
    const uit = await boekAsync({ van: iban, naar: 'extern:pay', centen: bedrag, soort: 'naar-wallet', oms: 'Naar RTG Pay' });
    if (uit.error) return uit;
    const in_ = await pay.boekAsync({ van: 'extern:bank', naar: 'lid:' + c, centen: bedrag, soort: 'van-bank', oms: 'Van RTG Bank' });
    if (in_.error) { await boekAsync({ van: 'extern:pay', naar: iban, centen: bedrag, soort: 'terug', oms: 'Terugboeking' }); return in_; }
    seintje(c);
    return { ok: true, saldoCenten: saldoVan(iban) };
  }

  /* De wallet-dekking: RTG Pay komt saldo tekort en vraagt de eigen bank om
     dekking. We zoeken de eerste betaalrekening van het lid die het bedrag
     (binnen zijn bodem, dus incl. rood-staan-ruimte) kan dragen en verhuizen
     precies het tekort naar de wallet. Zo draait Pay op de eigen bank zodra
     die er is, en pas daarna op de kaart-naad. */
  async function dekWallet({ codenaam, centen }) {
    const c = String(codenaam || '').trim();
    const bedrag = Math.round(Number(centen));
    if (!Number.isFinite(bedrag) || bedrag < 1) return { status: 400, error: 'Dat bedrag kan niet.' };
    const { rekeningen, bodem } = ctx;
    const kandidaat = Object.values(rekeningen()).find(m =>
      m.codenaam === c && m.soort === 'betaal' && !m.bevroren && saldoVan(m.iban) - bedrag >= bodem(m.iban));
    if (!kandidaat) return { status: 402, error: 'Geen betaalrekening met genoeg ruimte.' };
    return bankNaarWallet({ iban: kandidaat.iban, codenaam: c, centen: bedrag });
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
      if (fooi > 0) await boekAsync({ van: iban, naar: 'rtg:reserve', centen: fooi, soort: 'tarief', oms: 'SEPA-tarief' });
      try { await betaal.maakUitbetaling({ bedrag: c, iban: dest, begunstigde: begunstigde || '', referentie: b.boeking.id, idempotentieSleutel: idem ? 'bank-sepa:' + iban + ':' + idem : undefined, omschrijving: oms || 'RTG Bank SEPA' }); }
      catch (e) { /* eventueel-consistent: de payout kan later opnieuw; de boeking staat al */ }
      seintje(rekMeta(iban).codenaam);
      return { ok: true, saldoCenten: saldoVan(iban), overgemaakt: c, tarief: fooi, naar: dest };
    });
  }

  return { bankStorten: storten, bankOverboek: overboek, bankWalletNaarBank: walletNaarBank, bankBankNaarWallet: bankNaarWallet, bankDekWallet: dekWallet, bankSepaUit: sepaUit };
};
