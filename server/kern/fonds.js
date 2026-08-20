/* RTFoundation-afdracht (kern/fonds.js).

   RTG's enige inkomsten zijn de abonnementen. Van elke maandelijkse betaling van
   een klant gaat automatisch 30% (ex btw) naar de RTFoundation. Die afdracht
   wordt geboekt op het moment dat de betaling bevestigd is, zodat het geld bij
   de bron wordt gereserveerd en niet achteraf wordt berekend.

   De bestemming (het IBAN van de foundation) komt uit de omgeving. Zolang die
   nog niet is ingevuld, staat de afdracht op 'te_storten' (gereserveerd, wacht
   op de rekening). Zodra het IBAN bekend is, wordt de afdracht via de betaal-naad
   ingepland als echte uitbetaling. Zo verandert er niets aan de rest van de code
   als het live gaat; alleen de omgevingsvariabele wordt gevuld.

   Alle 30%-rekenwerk staat hier, als enige bron van waarheid, zodat de leden-app,
   de backoffice en de website nooit uit elkaar lopen. */

const crypto = require('crypto');

const AANDEEL = 0.30;   // 30% van de abonnementsbijdrage
const BTW = 1.21;       // afdracht rekent over het bedrag ex btw

// Herkent een abonnements-/lidmaatschapsfactuur (alleen die dragen af).
function isAbonnement(desc) {
  return /lidmaatschap|jaarbijdrage|maandbijdrage/i.test(String(desc || ''));
}

// 30% ex btw van een incl-btw bijdrage, in hele centen (afgerond).
function aandeelCenten(bijdrageInclBtw) {
  return Math.round((Number(bijdrageInclBtw) || 0) / BTW * AANDEEL * 100);
}
// Zelfde bedrag in euro's (voor tonen).
function aandeelEuro(bijdrageInclBtw) {
  return aandeelCenten(bijdrageInclBtw) / 100;
}

function maakFonds(state) {
  const db = state.db;
  const save = state.save || (() => {});
  const allocatie = require('./commercie/allocatie').maakAllocatie({ db, save, nu: () => Date.now() });
  const log = state.log || null;
  const opdrachten = state.betaalOpdrachten || null;
  const env = state.env || process.env;

  /* De bank-naad (laat gebonden: de RTG Bank ontstaat pas na dit fonds).
     Draait de boardroom-knop op "eigen", dan gaat de afdracht als boeking door
     het eigen grootboek in plaats van via de externe betaal-naad. De functie
     zelf beslist (kijkt naar de effectieve clearing) en geeft null terug als
     de eigen rails niet aan de beurt zijn -- dan valt alles hieronder gewoon
     terug op de bestaande betaal-naad. */
  let bankAfdracht = null;
  function koppelBank(fn) { if (typeof fn === 'function') bankAfdracht = fn; }

  function bestemming() {
    return {
      iban: (env.RTF_IBAN || '').trim(),
      begunstigde: (env.RTF_BEGUNSTIGDE || 'Stichting RTFoundation').trim(),
      bank: (env.RTF_BANK || '').trim()
    };
  }

  function lijst() {
    if (!Array.isArray(db.data.fondsAfdrachten)) db.data.fondsAfdrachten = [];
    return db.data.fondsAfdrachten;
  }

  /* De teruggang van een afdracht, en die is met opzet anders dan die van de
     bank en van Pay: hier is GEEN dubbele boeking om terug te draaien. De
     afdracht is zelf de administratie, en het geld stond nog bij RTG. "Terug"
     betekent hier dus: zet hem op te_storten, met de reden erbij, zodat hij
     opnieuw kan worden ingepland zodra de rail het weer doet. Dat blijft
     zichtbaar in het fondsoverzicht in plaats van weg te vallen. */
  if (opdrachten) opdrachten.registreerTeruggang('rtf-afdracht', async (o) => {
    const a = lijst().find(x => x.id === o.ledgerRef);
    if (!a) return { error: 'De afdracht bij deze opdracht bestaat niet meer.' };
    a.status = 'te_storten';
    a.fout = o.laatsteFout || 'de uitbetaling is niet gelukt';
    save();
    if (log && log.warn) log.warn('rtf-afdracht terug op te_storten na een mislukte rail', { id: a.id, fout: a.fout });
    return { ok: true };
  });

  // Boek de 30%-afdracht voor een zojuist betaalde abonnementsfactuur. Idempotent
  // op (wie, invoiceId): dezelfde betaalde factuur levert nooit twee afdrachten.
  // Geeft de afdracht terug, of null als de factuur niet afdraagt.
  async function boekAfdracht({ invoiceId, wie, bijdrage, betaalId, omschrijving }) {
    if (!isAbonnement(omschrijving)) return null;
    const centen = aandeelCenten(bijdrage);
    if (centen <= 0) return null;

    const rijen = lijst();
    const bestaand = rijen.find(a => a.invoiceId === invoiceId && a.wie === wie);
    if (bestaand) return bestaand;

    const best = bestemming();
    const afdracht = {
      id: 'RTF-' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex'),
      invoiceId: invoiceId || null,
      wie: wie || null,
      betaalId: betaalId || null,
      brutoCenten: Math.round((Number(bijdrage) || 0) * 100), // incl btw
      centen,                                                 // 30% ex btw
      iban: best.iban,
      begunstigde: best.begunstigde,
      status: best.iban ? 'ingepland' : 'te_storten',
      at: new Date().toISOString()
    };

    /* HET SPOOR PER EURO. Naast de afdracht zelf komt een rij in de sociale
       allocatie (kern/commercie/allocatie.js): met de VERDELING erbij (20%
       lokaal, 10% de stichting), de REGELVERSIE waarmee gerekend is, en de
       tijdstempels van gereserveerd tot afgewikkeld.

       Waarom naast en niet in plaats van: deze lijst gaat over de BETALING aan
       de stichting (een rail, een IBAN, een opdracht), de allocatie over de
       VERDELING en de verantwoording. Ze beantwoorden verschillende vragen, en
       "waar ging deze euro heen" was er tot 20 augustus 2026 geen van beide.
       MARKT.md waarschuwt dat de 30% aantoonbaar moet zijn zodra hij in
       marketing staat; dit is dat bewijs. */
    try {
      const soc = allocatie.reserveer({
        bronSoort: 'lidmaatschap', bronId: invoiceId || afdracht.id, codenaam: wie,
        bedragCenten: Math.round(centen / AANDEEL)   // terug naar de basis ex btw
      });
      if (soc) afdracht.allocatieId = soc.id;
    } catch (e) { /* de verantwoording mag de afdracht nooit tegenhouden */ }
    /* METEEN in de lijst, voordat er een opdracht bestaat. De teruggang zoekt de
       afdracht op ledgerRef; stond de push onderaan, dan kon een opdracht die
       zijn pogingen opmaakt de afdracht nog niet vinden en verdween de reden. */
    rijen.push(afdracht);
    if (rijen.length > 100000) rijen.splice(0, rijen.length - 100000);

    // In de eigen-stand loopt de afdracht over de eigen rails: een boeking van
    // de reserve naar de foundation-tegenrekening, per direct afgewikkeld.
    if (bankAfdracht) {
      try {
        const eigen = bankAfdracht({ centen, referentie: afdracht.id, oms: 'RTFoundation-afdracht ' + (invoiceId || '') });
        if (eigen && eigen.ok) {
          afdracht.status = 'gestort';
          afdracht.via = 'eigen-bank';
          afdracht.boekingId = eigen.boeking ? eigen.boeking.id : null;
          save();
          return afdracht;
        }
      } catch (e) {
        if (log && log.warn) log.warn('rtf-afdracht: eigen-bank-boeking mislukt', { invoiceId, fout: e.message });
      }
    }

    /* Met een bekend IBAN gaat de afdracht de opdrachtenrij in, dezelfde als de
       bank-SEPA en de partneruitbetaling van Pay (kern/betaalopdracht/).

       Hier stond een rechtstreekse aanroep met een catch die de afdracht op
       'te_storten' zette en logde. Dat was niet stil, maar er kwam ook nooit
       iemand op terug: 'te_storten' wachtte op een mens die het opmerkte, en het
       foundation-deel bleef zolang liggen. Nu wordt hij herhaald, telt hij mee in
       hetzelfde reconciliatiegetal als de andere twee rails, en is 'te_storten'
       weer wat het hoort te zijn -- geen bestemming bekend -- in plaats van een
       verzamelbak voor mislukte inzendingen. */
    if (best.iban && opdrachten) {
      const op = opdrachten.maak({
        soort: 'rtf-afdracht', rail: 'betaalnaad', centen, bestemming: best.iban,
        begunstigde: best.begunstigde, oms: 'RTFoundation-afdracht ' + (invoiceId || ''),
        ledgerRef: afdracht.id,
        idemSleutel: 'rtf:' + (wie || '') + ':' + invoiceId
      });
      afdracht.opdrachtId = op.id;
      const na = await opdrachten.dienIn(op);
      afdracht.uitbetaalId = na.settlementRef || null;
      /* Alle vijf de standen uitschrijven en niet "afgewikkeld of anders
         ingepland". Geeft de rij het al bij deze eerste poging op, dan heeft de
         teruggang hierboven de afdracht al op te_storten gezet -- een binaire
         regel schreef daar 'ingepland' overheen en maakte van een mislukking
         weer een belofte. */
      if (na.status === 'AFGEWIKKELD') afdracht.status = 'gestort';
      else if (na.status === 'MISLUKT' || na.status === 'TERUGGEBOEKT') afdracht.status = 'te_storten';
      else afdracht.status = 'ingepland';
      if (na.laatsteFout) afdracht.fout = na.laatsteFout;
    }

    save();
    return afdracht;
  }

  // Totalen voor de backoffice.
  function overzicht() {
    const rijen = lijst();
    let totaal = 0, teStorten = 0, gestort = 0, ingepland = 0;
    for (const a of rijen) {
      totaal += a.centen || 0;
      if (a.status === 'gestort') gestort += a.centen || 0;
      else if (a.status === 'ingepland') ingepland += a.centen || 0;
      else teStorten += a.centen || 0;
    }
    return {
      aantal: rijen.length,
      totaalCenten: totaal,
      teStortenCenten: teStorten,
      ingeplandCenten: ingepland,
      gestortCenten: gestort,
      bestemming: bestemming(),
      recent: rijen.slice(-12).reverse().map(a => ({
        id: a.id, invoiceId: a.invoiceId, centen: a.centen, status: a.status, at: a.at
      }))
    };
  }

  /* De verantwoording: wat is gereserveerd, wat kan weg, wat is er uit -- per
     deel, want "30% is afgedragen" zegt niets als het lokale deel al twee jaar
     wacht. */
  function socialeStand(filter) { return { ok: true, ...allocatie.stand(filter) }; }

  return { isAbonnement, aandeelCenten, aandeelEuro, boekAfdracht, overzicht, bestemming,
    koppelBank, socialeStand, allocatie, AANDEEL };
}

module.exports = { maakFonds, isAbonnement, aandeelCenten, aandeelEuro, AANDEEL };
