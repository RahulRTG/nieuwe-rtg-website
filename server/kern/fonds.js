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
  const betaal = state.betaal || null;
  const log = state.log || null;
  const env = state.env || process.env;

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
  async function boekAfdracht({ invoiceId, wie, bijdrage, betaalId, omschrijving }) {
    if (!isAbonnement(omschrijving)) return null;
    const centen = aandeelCenten(bijdrage);
    if (centen <= 0) return null;

    const rijen = lijst();
    const bestaand = rijen.find(a => a.invoiceId === invoiceId && a.wie === wie);
    if (bestaand) return bestaand;

    const best = bestemming();
    const afdracht = {
      id: 'RTF-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
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

    // Met een bekend IBAN meteen als uitbetaling wegzetten via de betaal-naad.
    if (best.iban && betaal && typeof betaal.maakUitbetaling === 'function') {
      try {
        const uit = await betaal.maakUitbetaling({
          bedrag: centen, valuta: 'eur', iban: best.iban, begunstigde: best.begunstigde,
          referentie: afdracht.id,
          idempotentieSleutel: 'rtf:' + (wie || '') + ':' + invoiceId,
          omschrijving: 'RTFoundation-afdracht ' + (invoiceId || '')
        });
        afdracht.uitbetaalId = uit.id;
        if (uit.status) afdracht.status = uit.status === 'te_storten' ? 'te_storten' : 'ingepland';
      } catch (e) {
        // Uitbetaling kon niet starten: bewaar de afdracht toch (gereserveerd),
        // zodat het foundation-deel niet zoekraakt en later ingepland kan worden.
        afdracht.status = 'te_storten';
        afdracht.fout = e.message;
        if (log && log.warn) log.warn('rtf-afdracht: uitbetaling niet gestart', { invoiceId, fout: e.message });
      }
    }

    rijen.push(afdracht);
    // Ruimte houden: bewaar hooguit de laatste 100.000 boekingen in het geheugen
    // van de embedded store (de durende waarheid zit in de betalingen zelf).
    if (rijen.length > 100000) rijen.splice(0, rijen.length - 100000);
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

  return { isAbonnement, aandeelCenten, aandeelEuro, boekAfdracht, overzicht, bestemming, AANDEEL };
}

module.exports = { maakFonds, isAbonnement, aandeelCenten, aandeelEuro, AANDEEL };
