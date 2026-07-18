/* De centrale facturatielaag: bij ELKE transactie (verkoop van een product of
   dienst, of een verhuur) maakt EGn functie automatisch EGn factuur die BEIDE
   partijen in hun app zien: de verkoper/verhuurder EN de koper/huurder.

   Alle apps haken hierop in via boek(): de kassa, de retail-verkoop, de
   boerderij-verkoop via de Salon, de verhuur, enzovoort. De koper wordt aan een
   RTG-lid gekoppeld als er een codenaam bij de betaling zat; anders krijgt alleen
   de verkoper een bon.

   Er is ook een AI-factuurtool: die beantwoordt vragen over de facturen EN maakt
   in gewone taal een nieuwe factuur ("maak een factuur voor Gouden Vos, 3 uur
   consult a 80 euro"). Met Claude slim, anders via de ingebouwde parser.

   maakFacturatie(state) volgt het vaste kern-patroon. Bedragen zijn in euro's
   (inclusief btw); de btw wordt teruggerekend. */

const SOORTEN = ['verkoop', 'dienst', 'huur'];
// Standaard-btw per genre: eten/drinken en agrarisch 9%, de rest 21%.
const LAAG_BTW_TYPES = ['restaurant', 'bar', 'hotel', 'groothandel', 'boerderij'];

function maakFacturatie({ db, save, crypto, findSupplier, keyVanCodenaam, notify, notifySupplier, sseToCustomer, sseToSupplier, factuur, anthropic, schoon }) {
  const nu = () => new Date().toISOString();
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const rond = n => Math.round((Number(n) || 0) * 100) / 100;

  function store() {
    if (!Array.isArray(db.data.facturen)) db.data.facturen = [];
    if (typeof db.data.factuurTeller !== 'number') db.data.factuurTeller = 0;
    return db.data;
  }
  function nummer() {
    const s = store();
    s.factuurTeller += 1;
    return 'RTG-' + new Date().getFullYear() + '-' + String(s.factuurTeller).padStart(6, '0');
  }
  function standaardBtw(supplier) {
    if (!supplier) return 21;
    return LAAG_BTW_TYPES.includes(supplier.type) ? 9 : 21;
  }

  // Reken de regels door: elk stuk is een prijs INCLUSIEF btw.
  function verwerkRegels(regels, btwStandaard) {
    let subtotaal = 0, btwBedrag = 0, totaal = 0;
    const uit = (Array.isArray(regels) ? regels : []).slice(0, 60).map(r => {
      const aantal = Math.max(1, Number(r.aantal) || 1);
      const stuk = rond(r.stuk);
      const btw = Number.isFinite(Number(r.btw)) ? Number(r.btw) : btwStandaard;
      const regelIncl = rond(aantal * stuk);
      const regelExcl = rond(regelIncl / (1 + btw / 100));
      subtotaal += regelExcl; btwBedrag += rond(regelIncl - regelExcl); totaal += regelIncl;
      return { omschrijving: scho(r.omschrijving, 120) || 'Post', aantal, stuk, btw, incl: regelIncl };
    });
    return { regels: uit, subtotaal: rond(subtotaal), btwBedrag: rond(btwBedrag), totaal: rond(totaal) };
  }

  /* De kern: boek EGn transactie -> EGn tweezijdige factuur.
     data: { soort, verkoperCode, verkoperNaam, koper:{key,naam,codenaam,supplierCode},
             regels:[{omschrijving,aantal,stuk,btw}], totaal?, btw?, methode, ref } */
  function boek(data) {
    const s = store();
    const verkoper = data.verkoperCode ? findSupplier(data.verkoperCode) : null;
    const btwStd = data.btw != null ? Number(data.btw) : standaardBtw(verkoper);
    let regels = data.regels;
    if ((!regels || !regels.length) && data.totaal != null) regels = [{ omschrijving: data.omschrijving || 'Transactie', aantal: 1, stuk: data.totaal, btw: btwStd }];
    const v = verwerkRegels(regels, btwStd);
    if (!(v.totaal > 0)) return { error: 'Geen bedrag om te factureren.' };
    const koper = data.koper || {};
    const f = {
      id: 'f' + crypto.randomBytes(5).toString('hex'),
      nummer: nummer(),
      soort: SOORTEN.includes(data.soort) ? data.soort : 'verkoop',
      verkoper: { code: data.verkoperCode || null, naam: scho(data.verkoperNaam || (verkoper && verkoper.name), 80) || 'RTG-partner' },
      koper: {
        key: koper.key || null,
        supplierCode: koper.supplierCode || null,
        naam: scho(koper.naam, 80) || (koper.codenaam ? scho(koper.codenaam, 80) : 'Klant'),
        codenaam: koper.codenaam ? scho(koper.codenaam, 80) : null
      },
      regels: v.regels, subtotaal: v.subtotaal, btwBedrag: v.btwBedrag, totaal: v.totaal,
      methode: scho(data.methode, 20) || null, ref: scho(data.ref, 60) || null,
      at: nu(), datum: nu().slice(0, 10)
    };
    s.facturen.unshift(f);
    s.facturen = s.facturen.slice(0, 100000);
    save();
    // beide partijen seinen: de verkoper en (indien lid) de koper
    if (f.verkoper.code && sseToSupplier) sseToSupplier(f.verkoper.code, 'sync', { scope: 'facturen' });
    if (f.koper.supplierCode && sseToSupplier) sseToSupplier(f.koper.supplierCode, 'sync', { scope: 'facturen' });
    if (f.koper.key) {
      if (sseToCustomer) sseToCustomer(f.koper.key, 'sync', { scope: 'facturen' });
      if (notify) notify(f.koper.key, { icon: '🧾', title: 'Nieuwe factuur', body: f.verkoper.naam + ': € ' + f.totaal.toFixed(2), scope: 'facturen' });
    }
    return { ok: true, factuur: publiek(f) };
  }

  // Async variant die een codenaam naar een lidsleutel oplost.
  async function boekMetCodenaam(data, codenaam) {
    codenaam = scho(codenaam, 80);
    if (codenaam && keyVanCodenaam) {
      try {
        const t = await keyVanCodenaam(codenaam); // { key, tier, codename } of null
        const key = t && t.key;
        data.koper = Object.assign({}, data.koper, key ? { key, codenaam: (t.codename || codenaam) } : { codenaam });
      } catch (e) { data.koper = Object.assign({}, data.koper, { codenaam }); }
    }
    return boek(data);
  }

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
        const { RAHUL_LEAD } = require('./rahul');
        const sys = RAHUL_LEAD + 'je bent de facturen-assistent op RTG. Antwoord kort en concreet in het Nederlands. Situatie: ' + kort;
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 300, system: sys, messages: [{ role: 'user', content: opdracht }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) return { antwoord: t };
      } catch (e) { /* val terug */ }
    }
    if (ctx.supplierCode) return { antwoord: 'U heeft ' + set.stats.verkocht + ' facturen verstuurd (omzet EUR ' + set.stats.omzet.toFixed(2) + ', btw EUR ' + set.stats.btwAfdracht.toFixed(2) + '). Zeg "maak een factuur voor ..." om er een te maken.' };
    return { antwoord: 'U heeft ' + set.telling + ' facturen ontvangen, samen EUR ' + set.besteed.toFixed(2) + '. Tik een factuur aan om de PDF te downloaden.' };
  }

  return { SOORTEN, boek, boekMetCodenaam, voorSupplier, voorLid, vind, mag, pdf, publiek, standaardBtw, ai };
}

module.exports = { maakFacturatie };
