/* Facturatie (deelmodule): het loket: de publieke weergave, vinden en de
   lijsten per zaak en per lid, de inzagecheck, de pdf en de AI-opdrachten
   in gewone taal. boek en boekMetCodenaam komen via de context binnen
   nadat kern/facturatie.js de motor heeft gemount. */
module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, keyVanCodenaam, notify, notifySupplier, sseToCustomer, sseToSupplier, factuur, anthropic, schoon,
    SOORTEN, LAAG_BTW_TYPES, nu, scho, rond } = ctx;
  const { store, nummer, standaardBtw, verwerkRegels, boek, boekMetCodenaam } = ctx;
  function publiek(f) {
    return {
      id: f.id, nummer: f.nummer, soort: f.soort, datum: f.datum, at: f.at,
      verkoper: f.verkoper.naam, verkoperCode: f.verkoper.code,
      koper: f.koper.naam, koperCodenaam: f.koper.codenaam,
      regels: f.regels, subtotaal: f.subtotaal, btwBedrag: f.btwBedrag, totaal: f.totaal, methode: f.methode
    };
  }
  function vind(id) { return store().facturen.find(f => f.id === id) || null; }

  // Alle facturen van een leverancier: als verkoper (uitgaand) en als koper (inkomend).
  function voorSupplier(code, limit) {
    const alle = store().facturen;
    const verkocht = alle.filter(f => f.verkoper.code === code).slice(0, limit || 500).map(publiek);
    const gekocht = alle.filter(f => f.koper.supplierCode === code).slice(0, limit || 500).map(publiek);
    const omzet = verkocht.reduce((n, f) => n + f.totaal, 0);
    return { verkocht, gekocht, stats: { verkocht: verkocht.length, gekocht: gekocht.length, omzet: rond(omzet), btwAfdracht: rond(verkocht.reduce((n, f) => n + (alle.find(x => x.id === f.id).btwBedrag), 0)) } };
  }
  // Alle facturen van een lid (als koper).
  function voorLid(key, limit) {
    const mijn = store().facturen.filter(f => f.koper.key === key).slice(0, limit || 500).map(publiek);
    return { facturen: mijn, telling: store().facturen.filter(f => f.koper.key === key).length, besteed: rond(mijn.reduce((n, f) => n + f.totaal, 0)) };
  }
  function mag(f, ctx) {
    if (!f) return false;
    if (ctx.supplierCode && (f.verkoper.code === ctx.supplierCode || f.koper.supplierCode === ctx.supplierCode)) return true;
    if (ctx.key && f.koper.key === ctx.key) return true;
    return false;
  }

  // De PDF van een factuur (voor beide partijen dezelfde bon).
  function pdf(f) {
    if (factuur && factuur.transactieFactuur) return factuur.transactieFactuur(f);
    // eenvoudige terugval als de PDF-helper (nog) niet bestaat
    const regels = [{ x: 56, y: 64, text: 'FACTUUR ' + f.nummer, size: 14, font: 'F2' }];
    let y = 110;
    regels.push({ x: 56, y: 90, text: f.verkoper.naam + ' aan ' + f.koper.naam, size: 10 });
    for (const r of f.regels) { regels.push({ x: 56, y, text: r.aantal + 'x ' + r.omschrijving + '  EUR ' + r.incl.toFixed(2), size: 10 }); y += 18; }
    regels.push({ x: 56, y: y + 10, text: 'Totaal EUR ' + f.totaal.toFixed(2) + ' (incl. btw EUR ' + f.btwBedrag.toFixed(2) + ')', size: 11, font: 'F2' });
    return factuur.pdf({ regels, lijnen: [] });
  }

  /* ---- de AI-factuurtool ---- */
  function bedragUit(q) {
    const m = q.match(/(\d+[.,]?\d*)\s*(?:euro|eur|€)/i) || q.match(/(?:€|eur)\s*(\d+[.,]?\d*)/i) || q.match(/\ba\s+(\d+[.,]?\d*)/i);
    return m ? Number(m[1].replace(',', '.')) : null;
  }
  function aantalUit(q) { const m = q.match(/(\d+)\s*(?:x|stuks?|uur|uren|keer|dag(?:en)?)/i); return m ? parseInt(m[1], 10) : 1; }
  // alles tussen "voor" en de eerste komma is de koper (codenaam of naam)
  function codenaamUit(orig) { const m = orig.match(/\bvoor\s+([^,]{2,60})(?:,|$)/i); return m ? m[1].trim() : null; }
  async function ai(ctx, opdracht, aiAan) {
    opdracht = scho(opdracht, 400);
    if (!opdracht) return { antwoord: 'Vraag iets over uw facturen, of zeg bijv. "maak een factuur voor Gouden Vos, 3 uur consult a 80 euro".' };
    const q = opdracht.toLowerCase();
    // een factuur MAKEN (leverancier)
    if (ctx.supplierCode && /(maak|stuur|schrijf).*(factuur|rekening)/.test(q)) {
      const bedrag = bedragUit(opdracht);
      if (!bedrag) return { antwoord: 'Ik heb een bedrag nodig, bijv. "... a 80 euro".' };
      const aantal = aantalUit(q);
      const codenaam = codenaamUit(opdracht);
      let oms = opdracht.replace(/.*factuur\s+(voor\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*)?,?\s*/i, '').replace(/\b\d+[.,]?\d*\s*(euro|eur|€)\b/gi, '').replace(/\ba\b/gi, '').replace(/\b\d+\s*(x|stuks?|uur|uren|keer|dagen?)\b/gi, '').trim() || 'Dienst';
      const stuk = aantal > 1 ? rond(bedrag) : rond(bedrag);
      const r = await boekMetCodenaam({ soort: 'dienst', verkoperCode: ctx.supplierCode, verkoperNaam: ctx.supplierNaam, regels: [{ omschrijving: oms, aantal, stuk }], methode: 'factuur' }, codenaam);
      if (r.error) return { antwoord: r.error };
      return { antwoord: 'Factuur ' + r.factuur.nummer + ' gemaakt voor ' + r.factuur.koper + ': EUR ' + r.factuur.totaal.toFixed(2) + '. Beide partijen zien hem in de app.', gedaan: true };
    }
    // een VRAAG beantwoorden
    const set = ctx.supplierCode ? voorSupplier(ctx.supplierCode) : voorLid(ctx.key);
    if (aiAan && anthropic) {
      try {
        const kort = ctx.supplierCode
          ? 'Verkocht: ' + set.stats.verkocht + ' facturen, omzet EUR ' + set.stats.omzet + ', btw EUR ' + set.stats.btwAfdracht + '.'
          : 'Ontvangen: ' + set.telling + ' facturen, samen EUR ' + set.besteed + '.';
        const { RAHUL_LEAD } = require('../rahul');
        const sys = RAHUL_LEAD + 'je bent de facturen-assistent op RTG. Antwoord kort en concreet in het Nederlands. Situatie: ' + kort;
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 300, system: sys, messages: [{ role: 'user', content: opdracht }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) return { antwoord: t };
      } catch (e) { /* val terug */ }
    }
    if (ctx.supplierCode) return { antwoord: 'U heeft ' + set.stats.verkocht + ' facturen verstuurd (omzet EUR ' + set.stats.omzet.toFixed(2) + ', btw EUR ' + set.stats.btwAfdracht.toFixed(2) + '). Zeg "maak een factuur voor ..." om er een te maken.' };
    return { antwoord: 'U heeft ' + set.telling + ' facturen ontvangen, samen EUR ' + set.besteed.toFixed(2) + '. Tik een factuur aan om de PDF te downloaden.' };
  }
  return { publiek, vind, voorSupplier, voorLid, mag, pdf, bedragUit, aantalUit, codenaamUit, ai };
};
