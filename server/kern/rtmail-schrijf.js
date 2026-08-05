/* RTMAIL (deelmodule): de schrijfkant -- concepten, uitgesteld verzenden en
   de instellingen van een postvak (handtekening, afwezigheid, aliassen).

   DRIE DINGEN DIE HIER ANDERS ZIJN DAN IN EEN GEWONE MAILAPP:

   1. EEN CONCEPT IS GEEN BERICHT. Het staat in een eigen lade en niet als
      "bericht met map=concept" tussen de post. Dat scheelt niet alleen
      opruimwerk: een concept heeft geen ontvanger nodig, is nooit bezorgd, en
      mag dus nooit per ongeluk in een postvak, een zoekopdracht of een export
      opduiken alsof het verstuurd is.
   2. UITGESTELD VERZENDEN LEGT DE POST IN DE LADE MET EEN TIJDSTIP. Er loopt
      GEEN wekker die hem eruit haalt -- `losMaken()` wordt bij elke aanraking
      van het postvak gedraaid en verstuurt wat aan de beurt is. Een wekker die
      een keer niet loopt, verstuurt niets en zegt niets; deze manier haalt de
      achterstand vanzelf in zodra iemand kijkt.
   3. EEN AFWEZIGHEIDSBERICHT ANTWOORDT NOOIT TWEE KEER OP DEZELFDE AFZENDER,
      en nooit op het systeem of op een ander afwezigheidsbericht. Dat is geen
      beleefdheid maar de bekendste manier om twee mailservers eindeloos tegen
      elkaar te laten praten.

   Aliassen zijn hier BEPERKT en met opzet: een alias is een tweede naam voor
   HETZELFDE postvak, geen tweede identiteit. Het linkerdeel moet vrij zijn
   (kern/rtmail-vrij.js), zodat een alias nooit andermans post kan opvangen. */
const adresLaag = require('./rtmail-adres');

const MAX_CONCEPTEN = 200;
const MAX_ALIASSEN = 5;

module.exports = ({ db, save, crypto, rtmail, vrij }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(6).toString('hex');
  const kap = (s, n) => String(s == null ? '' : s).slice(0, n);
  const busVan = (adres) => {
    const o = adresLaag.ontleed(adres);
    return o.binnenshuis ? String(o.lokaal || '').replace(/[.-]/g, '') : String(o.adres || '');
  };

  function S() {
    if (!db.data.rtmailSchrijf || typeof db.data.rtmailSchrijf !== 'object')
      db.data.rtmailSchrijf = { concepten: [], vakken: {} };
    const s = db.data.rtmailSchrijf;
    if (!Array.isArray(s.concepten)) s.concepten = [];
    if (!s.vakken || typeof s.vakken !== 'object') s.vakken = {};
    return s;
  }
  // de instellingen van EEN postvak; leeg is de standaard, niet een fout
  function vakInst(adres, maken) {
    const k = busVan(adres);
    if (!k) return null;
    const s = S();
    if (!s.vakken[k]) {
      if (!maken) return { handtekening: '', afwezig: null, aliassen: [] };
      s.vakken[k] = { handtekening: '', afwezig: null, aliassen: [], beantwoord: {} };
    }
    return s.vakken[k];
  }

  /* ---------- concepten ---------- */
  function bewaar(adres, { id, naar, onderwerp, tekst, antwoordOp, plan } = {}) {
    const s = S();
    const eigen = busVan(adres);
    if (!eigen) return { error: 'Dit postvak is niet te bepalen.' };
    let c = id ? s.concepten.find(x => x.id === id && x.bus === eigen) : null;
    if (id && !c) return { error: 'Dit concept bestaat niet in dit postvak.' };
    if (!c) {
      if (s.concepten.filter(x => x.bus === eigen).length >= MAX_CONCEPTEN)
        return { error: 'U heeft ' + MAX_CONCEPTEN + ' concepten open staan; ruim er eerst een op.' };
      c = { id: rid(), bus: eigen, van: adres, at: nu() };
      s.concepten.unshift(c);
    }
    if (naar !== undefined) c.naar = rtmail.normAdres(naar);
    if (onderwerp !== undefined) c.onderwerp = kap(onderwerp, 160);
    if (tekst !== undefined) c.tekst = kap(tekst, 8000);
    if (antwoordOp !== undefined) c.antwoordOp = String(antwoordOp || '') || null;
    if (plan !== undefined) {
      if (!plan) c.plan = null;
      else {
        const t = new Date(plan);
        if (isNaN(t.getTime())) return { error: 'Dat is geen tijdstip.' };
        if (t.toISOString() <= nu()) return { error: 'Verzenden in het verleden kan niet; laat het weg om nu te versturen.' };
        c.plan = t.toISOString();
      }
    }
    c.gewijzigd = nu();
    save();
    return { ok: true, concept: publiekConcept(c) };
  }
  const publiekConcept = (c) => ({ id: c.id, naar: c.naar || '', onderwerp: c.onderwerp || '',
    tekst: c.tekst || '', antwoordOp: c.antwoordOp || null, plan: c.plan || null,
    at: c.at, gewijzigd: c.gewijzigd || c.at });

  const concepten = (adres) => S().concepten.filter(c => c.bus === busVan(adres)).map(publiekConcept);

  function gooiWeg(adres, id) {
    const s = S();
    const i = s.concepten.findIndex(c => c.id === id && c.bus === busVan(adres));
    if (i < 0) return { error: 'Dit concept bestaat niet in dit postvak.' };
    s.concepten.splice(i, 1);
    save();
    return { ok: true, id };
  }

  /* Een concept versturen. De handtekening gaat er hier onder -- op EEN plek,
     zodat een bericht uit de app en een bericht uit een gepland concept
     dezelfde ondertekening dragen. */
  function verstuur(adres, id, bron) {
    const s = S();
    const c = s.concepten.find(x => x.id === id && x.bus === busVan(adres));
    if (!c) return { error: 'Dit concept bestaat niet in dit postvak.' };
    if (!c.naar) return { error: 'Aan wie moet dit bericht?' };
    const inst = vakInst(adres, false);
    const tekst = (c.tekst || '') + (inst.handtekening ? '\n\n-- \n' + inst.handtekening : '');
    const m = rtmail.stuur({ van: adres, naar: c.naar, onderwerp: c.onderwerp || '',
      tekst, soort: 'bericht', bron: bron || 'lid', antwoordOp: c.antwoordOp || undefined });
    if (m.error) return m;
    s.concepten.splice(s.concepten.indexOf(c), 1);
    save();
    return { ok: true, bericht: m };
  }

  /* Wat gepland stond en aan de beurt is, gaat nu de deur uit. Geeft terug wat
     er verstuurd is, zodat de aanroeper het kan MELDEN -- stilzwijgend
     verzenden zou betekenen dat niemand ziet dat het gebeurd is. */
  function losMaken(adres, bron) {
    const eigen = busVan(adres);
    const t = nu();
    const klaar = S().concepten.filter(c => c.bus === eigen && c.plan && c.plan <= t);
    const uit = [];
    for (const c of klaar) {
      const r = verstuur(adres, c.id, bron);
      if (r.ok) uit.push(r.bericht);
    }
    return uit;
  }

  /* ---------- instellingen ---------- */
  /* De instellingen van een postvak (handtekening, afwezig, aliassen) staan in
     ./rtmail-inst.js. Dit bestand gaat over concepten; dat over hoe een postvak
     zich gedraagt. De gedeelde hulpjes gaan mee naar binnen, zodat er geen
     tweede versie van busVan of vakInst ontstaat (LAT.md regel 4). */
  const inst = require('./rtmail-inst')({ save, rtmail, vrij, nu, busVan, vakInst, kap });
  const { instellingen, zetHandtekening, zetAfwezig, zetAlias, afwezigAntwoord } = inst;

  return { bewaar, concepten, gooiWeg, verstuur, losMaken,
    instellingen, zetHandtekening, zetAfwezig, zetAlias, afwezigAntwoord, aliassenVan: (a) => instellingen(a).aliassen };
};
