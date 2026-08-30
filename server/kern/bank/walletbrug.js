/* RTG Bank, deel "walletbrug": geld van een eigen betaalrekening naar de RTG
   Pay-wallet (lid:<codenaam>), plus de dekking die Pay vraagt als de wallet
   tekortkomt.

   DE BRUG IS EENRICHTINGSVERKEER, EN DAT IS EEN BESLUIT (20 augustus 2026).
   Geld mag van de bank NAAR de wallet, niet andersom. De reden staat in
   kern/bevoegdheid/lijst.js: RTG mag walletsaldo aanhouden op grond van een
   BESLUIT en niet van een vergunning, en dat besluit rust op drie voorwaarden
   waarvan de tweede is dat het saldo NIET WORDT UITBETAALD AAN HET LID.

   Die voorwaarde was een belofte zolang de leden-bank uit stond. Zodra die live
   gaat, bestaat de keten wallet -> walletbrug -> eigen rekening -> SEPA naar
   buiten, en dan is walletsaldo wel degelijk uitbetaalbaar -- precies het geval
   dat het besluit zelf benoemt als "dan hoort dit vermogen van soort te
   wisselen". In plaats van het besluit te laten sneuvelen is de deur dicht
   gedaan: walletNaarBank weigert, met de reden erbij.

   Wat dit KOST, want dat hoort erbij: een lid kan zijn walletsaldo niet naar
   zijn eigen rekening halen. Dat is geen functie die verdwijnt maar een belofte
   die waar wordt gemaakt -- het besluit zei dit al, alleen deed de code het
   niet. Wie hem weer opent, opent daarmee de vergunningsvraag.

   De oude implementatie is WEGGEHAALD en niet uitgecommentarieerd blijven
   staan: git heeft hem, en dode code die alleen als naslag dient veroudert
   stil mee met de code eromheen. Wat hij deed staat hierboven beschreven;
   hoe hij het deed staat in de historie van dit bestand.

   Waarom apart van ./overboeken: dit is het enige pad in de bank dat TWEE
   grootboeken tegelijk raakt. Elk blijft apart sluiten -- de wallet-kant boekt
   naar extern:bank, de bank-kant vanaf extern:pay -- en juist daarom moet de
   tweede boeking, als hij faalt, de eerste met de hand terugdraaien. Die regel
   staat nergens anders in de bank en verdient een eigen bestand.

   Krijgt de gedeelde ctx van kern/bank/index.js. */
module.exports = (ctx) => {
  const { boekAsync, rekMeta, saldoVan, pay, seintje, metIdem } = ctx;

  /* De dichte kant. Hij blijft BESTAAN in plaats van te verdwijnen, en de route
     erboven blijft hangen: een oude app hoort te lezen waarom het niet meer kan,
     niet een 404 te krijgen die op een storing lijkt. */
  async function walletNaarBank({ iban, codenaam, centen }) {
    return { status: 409, code: 'wallet-eenrichting',
      error: 'Saldo in RTG Pay besteedt u binnen RTG; het gaat niet naar een bankrekening. ' +
        'Andersom kan wel: geld van uw rekening naar uw wallet.' };
  }
  /* `internDek` zegt: dit is een stap binnen een andere handeling, geen eigen
     verzoek. Zie dekWallet hieronder voor waarom die stand bestaat en wat hij
     kost. Hij komt NIET van buiten: geen route leest hem uit een verzoek. */
  async function bankNaarWallet({ iban, codenaam, centen, idem, internDek }) {
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
    }, internDek ? null : { geld: 'verplaatst saldo van een rekening naar de wallet' });
  }

  /* De wallet-dekking: RTG Pay komt saldo tekort en vraagt de eigen bank om
     dekking. We zoeken de eerste betaalrekening van het lid die het bedrag
     (binnen zijn bodem, dus incl. rood-staan-ruimte) kan dragen en verhuizen
     precies het tekort naar de wallet. Zo draait Pay op de eigen bank zodra
     die er is, en pas daarna op de kaart-naad. */
  /* DE SLEUTEL REIST MEE, en dat moest hij worden.

     Deze functie dekt een tekort in de wallet vanaf de eigen betaalrekening, en
     riep bankNaarWallet aan ZONDER idem-sleutel. Toen de geldgrens in
     ../../lib/idem.js kwam (geen sleutel, geen geldhandeling), weigerde die
     aanroep -- en de `catch` een laag hoger in ../pay/opladen.js slikte dat stil
     op: het lid kreeg `bijgeladen: 0` en niemand zei waarom.

     De sleutel bestond wel degelijk: pay/opladen.js krijgt hem van de aanroeper
     en gaf hem alleen niet door. Hij reist nu de hele keten mee, zodat een
     dubbeltik op `pay/stuur` ook de DEKKING niet twee keer doet. */
  async function dekWallet({ codenaam, centen, idem }) {
    const c = String(codenaam || '').trim();
    const bedrag = Math.round(Number(centen));
    if (!Number.isFinite(bedrag) || bedrag < 1) return { status: 400, error: 'Dat bedrag kan niet.' };
    const { rekeningen, bodem } = ctx;
    const kandidaat = Object.values(rekeningen()).find(m =>
      m.codenaam === c && m.soort === 'betaal' && !m.bevroren && saldoVan(m.iban) - bedrag >= bodem(m.iban));
    if (!kandidaat) return { status: 402, error: 'Geen betaalrekening met genoeg ruimte.' };
    /* EN ALS ER GEEN SLEUTEL VAN BOVEN KOMT. Dan gaat de dekking toch door, en
       dat is een grens die het uitschrijven waard is.

       Deze dekking is geen zelfstandig verzoek maar een STAP BINNEN een andere
       handeling (een betaling die de wallet niet vol genoeg vindt). De
       idempotentie van die handeling hoort bij die handeling: `pay.huisIn` of
       `pay.stuur` dragen hem, en als die geen sleutel kreeg, is dat daar het
       gebrek en niet hier. Deze stap alsnog weigeren maakt van een ontbrekende
       bescherming een STORING -- gemeten in test/zorgwallet.test.js, waar het
       kopen van feestmunten er in zijn geheel op afketste terwijl niemand om een
       tweede boeking had gevraagd.

       Wat dat kost, want dat hoort erbij: een aanroeper die zelf geen sleutel
       stuurt, kan door een dubbeltik twee keer laten dekken. Die aanroepers zijn
       te tellen (pay/huisIn en pay/huisUit zonder idem) en horen er een te
       krijgen; tot die tijd staat het hier zichtbaar in plaats van dat de
       dekking stil uitvalt. */
    if (!idem) return bankNaarWallet({ iban: kandidaat.iban, codenaam: c, centen: bedrag, internDek: true });
    return bankNaarWallet({ iban: kandidaat.iban, codenaam: c, centen: bedrag, idem: 'dek:' + idem });
  }

  return { bankWalletNaarBank: walletNaarBank, bankBankNaarWallet: bankNaarWallet, bankDekWallet: dekWallet };
};
