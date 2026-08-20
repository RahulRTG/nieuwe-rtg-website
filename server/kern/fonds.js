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

const btw = require('./commercie/btw');

const AANDEEL = 0.30;   // 30% van de abonnementsbijdrage
/* Het btw-tarief kwam hier als constante `1.21` binnen, terwijl dit platform
   landen kent (kern/commercie/btw.js). Een lid buiten Nederland kreeg zo 21%
   Nederlandse btw van zijn bijdrage afgehaald voordat de 30% werd gerekend --
   en bij een Lifestyle Pass van 20.000 euro per maand is dat geen
   afrondingsfout. Het profiel komt van het contract; zonder profiel geldt de
   standaard, en dat is nog steeds NL 21%. */

// Herkent een abonnements-/lidmaatschapsfactuur (alleen die dragen af).
function isAbonnement(desc) {
  return /lidmaatschap|jaarbijdrage|maandbijdrage/i.test(String(desc || ''));
}

/* 30% ex btw van een incl-btw bijdrage, in hele centen (afgerond).
   `btwProfiel` komt van het contract van het lid; laat je hem weg, dan geldt
   NL 21% -- hetzelfde antwoord als vroeger, maar nu als expliciete standaard in
   plaats van als enige mogelijkheid. */
function aandeelCenten(bijdrageInclBtw, btwProfiel) {
  const centenIncl = Math.round((Number(bijdrageInclBtw) || 0) * 100);
  const o = btw.overBruto(centenIncl, btwProfiel);
  return Math.round(o.nettoCenten * AANDEEL);
}
// Zelfde bedrag in euro's (voor tonen).
function aandeelEuro(bijdrageInclBtw, btwProfiel) {
  return aandeelCenten(bijdrageInclBtw, btwProfiel) / 100;
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

  /* De rails staan apart: dit bestand beslist DAT er 30% afgaat en HOEVEEL, dat
     brengt het bedrag naar buiten. Zie ./fonds/uitbetalen.js. */
  const { verstuur } = require('./fonds/uitbetalen').maakUitbetaling({
    opdrachten, save, log, lijst: () => lijst(), bankGeef: () => bankAfdracht });

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

  // Boek de 30%-afdracht voor een zojuist betaalde abonnementsfactuur. Idempotent
  // op (wie, invoiceId): dezelfde betaalde factuur levert nooit twee afdrachten.
  // Geeft de afdracht terug, of null als de factuur niet afdraagt.
  async function boekAfdracht({ invoiceId, wie, bijdrage, betaalId, omschrijving, btwProfiel }) {
    if (!isAbonnement(omschrijving)) return null;
    const centen = aandeelCenten(bijdrage, btwProfiel);
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

    await verstuur(afdracht, { centen, invoiceId, wie, best });

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
