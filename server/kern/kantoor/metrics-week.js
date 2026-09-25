/* De backoffice-laag, deelbestand "metrics-week": de weektrend en de dagcijfers
   van het live-overzicht (transactievolume van zaken, de afdracht aan de
   RTFoundation en de munt-ontvangsten). Afgesplitst van ./metrics.js toen de
   groepspoort erbij kwam (besluit van de eigenaar, 25 september 2026) en dat
   bestand tegen de omvangsgrens aan liep. Het raakt de opslag NIET zelf: de drie
   collecties komen als lezers uit ./metrics.js, dat al een deur naar de opslag is. */
const { TE_KLEINE_GROEP, KLASSEN } = require('../bedrijfsmaat/poort');
const ZAKEN_GRENS = KLASSEN.zaken.grens;

module.exports = ({ invoices, fondsAfdrachten, muntOntvangsten }) => {
  const dagVan = iso => String(iso || '').slice(0, 10);

  // de weektrend en de dagcijfers, plus foundation-afdracht en munt-ontvangsten
  function weekEnStats(betaaldeOrders, betaaldeRitten, live, nu) {
    /* De groepspoort (bedrijfsmaat/poort.js, besluit 25 sept 2026): een totaal
       over minder dan vijf zaken is de omzet van een aanwijsbare zaak. Dan geen
       bedrag en geen aantal, en geen nul. De lijst per zaak blijft (mens op naam). */
    const zaakVan = (x) => x.supplierCode || null;
    const dicht = (dag) => Object.assign(dag, { omzet: null, aantal: null, stand: TE_KLEINE_GROEP, grens: ZAKEN_GRENS });
    const week = [];
    const zakenWeek = new Set();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(nu - i * 86400000).toISOString().slice(0, 10);
      const dagOrders = betaaldeOrders.filter(o => dagVan(o.paidAt || o.at) === d);
      const dagRitten = betaaldeRitten.filter(r => dagVan(r.paidAt || r.at) === d);
      const zaken = new Set(dagOrders.concat(dagRitten).map(zaakVan).filter(Boolean));
      zaken.forEach(z => zakenWeek.add(z));
      const dag = {
        date: d,
        label: new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'short' }),
        omzet: dagOrders.reduce((s2, o) => s2 + (o.total || 0), 0) + dagRitten.reduce((s2, r) => s2 + (r.quote || 0), 0),
        aantal: dagOrders.length + dagRitten.length
      };
      week.push(zaken.size > 0 && zaken.size < ZAKEN_GRENS ? dicht(dag) : dag);
    }
    // De RTFoundation krijgt 30% van de abonnementsbijdragen (ex btw); RTG
    // verdient niets aan boekingen, dus die tellen hier niet mee.
    const fonds = invoices()
      .filter(i => (i.status === 'paid' || i.status === 'betaald') && /lidmaatschap|jaarbijdrage|maandbijdrage/i.test(i.desc || ''))
      .reduce((s2, i) => s2 + Math.round((i.bijdrage || 0) / 1.21 * 0.3), 0);
    // Het echte afdracht-grootboek (kern/fonds.js boekt hier per betaling).
    const afdrachten = Array.isArray(fondsAfdrachten()) ? fondsAfdrachten() : [];
    let afTotaal = 0, afTeStorten = 0, afIngepland = 0, afGestort = 0;
    for (const a of afdrachten) {
      const c = a.centen || 0;
      afTotaal += c;
      if (a.status === 'gestort') afGestort += c;
      else if (a.status === 'ingepland') afIngepland += c;
      else afTeStorten += c;
    }
    const fondsAfdracht = {
      aantal: afdrachten.length,
      totaal: Math.round(afTotaal) / 100,
      teStorten: Math.round(afTeStorten) / 100,
      ingepland: Math.round(afIngepland) / 100,
      gestort: Math.round(afGestort) / 100,
      iban: (process.env.RTF_IBAN || '').trim(),
      begunstigde: (process.env.RTF_BEGUNSTIGDE || 'Stichting RTFoundation').trim()
    };
    // Munt-ontvangsten (crypto meteen omgezet naar euro).
    const muntRijen = Array.isArray(muntOntvangsten()) ? muntOntvangsten() : [];
    let muntEuroCenten = 0, muntWacht = 0;
    for (const r of muntRijen) {
      if (r.status === 'ontvangen') muntEuroCenten += (r.settledEuroCenten || r.euroCenten || 0);
      else muntWacht++;
    }
    const muntOntvangst = {
      aan: process.env.MUNT_AAN === '1',
      aantal: muntRijen.length, wacht: muntWacht,
      ontvangen: Math.round(muntEuroCenten) / 100
    };
    const weekDicht = zakenWeek.size > 0 && zakenWeek.size < ZAKEN_GRENS;
    const stats = {
      omzetVandaag: week[6].omzet, aantalVandaag: week[6].aantal,
      omzetWeek: weekDicht || week.some(d => d.omzet == null) ? null : week.reduce((s2, d) => s2 + d.omzet, 0),
      omzetStand: weekDicht || week.some(d => d.omzet == null) ? TE_KLEINE_GROEP : null, omzetGrens: ZAKEN_GRENS,
      foundation: fonds, fondsAfdracht, muntOntvangst, liveNu: live.length
    };
    return { week, stats };
  }

  return { weekEnStats };
};
