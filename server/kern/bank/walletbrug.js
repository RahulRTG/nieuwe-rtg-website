/* RTG Bank, deel "walletbrug": geld tussen de RTG Pay-wallet (lid:<codenaam>)
   en een eigen betaalrekening, plus de dekking die Pay vraagt als de wallet
   tekortkomt.

   Waarom apart van ./overboeken: dit is het enige pad in de bank dat TWEE
   grootboeken tegelijk raakt. Elk blijft apart sluiten -- de wallet-kant boekt
   naar extern:bank, de bank-kant vanaf extern:pay -- en juist daarom moet de
   tweede boeking, als hij faalt, de eerste met de hand terugdraaien. Die regel
   staat nergens anders in de bank en verdient een eigen bestand.

   Krijgt de gedeelde ctx van kern/bank/index.js. */
module.exports = (ctx) => {
  const { boekAsync, rekMeta, saldoVan, pay, seintje, metIdem } = ctx;

  /* DE IDEM-SLEUTEL WEEGT HIER ZWAARDER DAN ELDERS IN DE BANK, en dat komt door
     de twee grootboeken. Een herhaling boekt niet een keer te veel op EEN plek
     maar twee keer op twee plekken, en tussen die twee boekingen zit de
     handmatige terugdraai hieronder. Twee gelijktijdige retries konden elkaars
     terugboeking kruisen; de sleutel houdt de tweede tegen voordat er iets
     beweegt (TAKEN.md 4.57). Anders dan bij de vier routes die geld het huis
     UIT sturen blijft het geld hier bij hetzelfde lid -- het staat alleen op de
     verkeerde plek -- maar dat maakt het een hersteltaak en geen non-issue. */
  async function walletNaarBank({ iban, codenaam, centen, idem }) {
    const c = String(codenaam || '').trim();
    const m = rekMeta(iban);
    if (!m || m.codenaam !== c) return { status: 404, error: 'De rekening bestaat niet.' };
    const bedrag = Math.round(Number(centen));
    if (!Number.isFinite(bedrag) || bedrag < 1 || bedrag > pay.MAX_CENTEN) return { status: 400, error: 'Kies een bedrag tot ' + (pay.MAX_CENTEN / 100) + ' euro per keer.' };
    return metIdem(idem ? 'vanwallet:' + iban + ':' + idem : null, 'vanwallet|' + iban + '|' + bedrag, async () => {
      // De wallet-kant loopt via het pay-grootboek (in motor-modus dus geguard langs
      // de motor); de bank-kant is het eigen bank-grootboek. Elk sluit apart.
      const uit = await pay.boekAsync({ van: 'lid:' + c, naar: 'extern:bank', centen: bedrag, soort: 'naar-bank', oms: 'Naar RTG Bank' });
      if (uit.error) return uit;
      const in_ = await boekAsync({ van: 'extern:pay', naar: iban, centen: bedrag, soort: 'van-wallet', oms: 'Van RTG Pay' });
      if (in_.error) { await pay.boekAsync({ van: 'extern:bank', naar: 'lid:' + c, centen: bedrag, soort: 'terug', oms: 'Terugboeking' }); return in_; }
      seintje(c);
      return { ok: true, saldoCenten: saldoVan(iban) };
    });
  }
  async function bankNaarWallet({ iban, codenaam, centen, idem }) {
    const c = String(codenaam || '').trim();
    const m = rekMeta(iban);
    if (!m || m.codenaam !== c) return { status: 404, error: 'De rekening bestaat niet.' };
    const bedrag = Math.round(Number(centen));
    if (!Number.isFinite(bedrag) || bedrag < 1 || bedrag > pay.MAX_CENTEN) return { status: 400, error: 'Kies een bedrag tot ' + (pay.MAX_CENTEN / 100) + ' euro per keer.' };
    return metIdem(idem ? 'naarwallet:' + iban + ':' + idem : null, 'naarwallet|' + iban + '|' + bedrag, async () => {
      const uit = await boekAsync({ van: iban, naar: 'extern:pay', centen: bedrag, soort: 'naar-wallet', oms: 'Naar RTG Pay' });
      if (uit.error) return uit;
      const in_ = await pay.boekAsync({ van: 'extern:bank', naar: 'lid:' + c, centen: bedrag, soort: 'van-bank', oms: 'Van RTG Bank' });
      if (in_.error) { await boekAsync({ van: 'extern:pay', naar: iban, centen: bedrag, soort: 'terug', oms: 'Terugboeking' }); return in_; }
      seintje(c);
      return { ok: true, saldoCenten: saldoVan(iban) };
    });
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

  return { bankWalletNaarBank: walletNaarBank, bankBankNaarWallet: bankNaarWallet, bankDekWallet: dekWallet };
};
