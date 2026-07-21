/* RTG Redactie (kern/redactie): het persbureau van RTG -- krant, magazine en
   drukkerij in een huis. Journalisten schrijven artikelen per rubriek met een
   nette statusketen (concept -> eindredactie -> gepubliceerd; PUBLICEREN
   beslist altijd een mens). Via de Ideeenkamer doet de Redactie mee als
   volwaardig bureau (ontwerpMaak-contract) en het gepubliceerde nieuws
   verschijnt voor iedereen in de eigen Nieuws-app.

   Dit is de spil: de staat, de seed en de schrijftafel. Wat waar woont:
     ./pers            de drukkerij (edities, drukstraat, drukproef) en het
                       overzicht + het gepubliceerde nieuws voor de app
     ./hoofdredacteur  de nieuwstips-wand uit het hele platform en de
                       AI-hoofdredacteur (schrijft mee, publiceert NOOIT)
   Volgt het vaste kern-patroon maakRedactie(state) -> { redactie: api }. */

const RUBRIEKEN = ['nieuws', 'reizen', 'lifestyle', 'zaken', 'cultuur', 'sport'];
const ARTIKEL_STATUS = ['concept', 'eindredactie', 'gepubliceerd'];
const EDITIE_STATUS = ['samenstellen', 'ter-perse', 'gedrukt'];

function maakRedactie({ db, save, crypto, anthropic, schoon }) {
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const id = p => p + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();

  function R() {
    if (!db.data.redactie || typeof db.data.redactie !== 'object') db.data.redactie = { artikelen: [], edities: [] };
    const r = db.data.redactie;
    if (!Array.isArray(r.artikelen)) r.artikelen = [];
    if (!Array.isArray(r.edities)) r.edities = [];
    if (!r._seed) {
      r._seed = true;
      r.artikelen.push({ id: id('art'), kop: 'RTG opent het seizoen op het eiland', rubriek: 'nieuws',
        intro: 'Het nieuwe seizoen is begonnen; de partners staan klaar.',
        tekst: 'Met de eerste zomeravond opent het platform het seizoen. De redactie volgt de opening op de voet.',
        auteur: 'Redactie', status: 'gepubliceerd', at: nu(), publicatieAt: nu() });
      save();
    }
    return r;
  }
  const vind = aid => R().artikelen.find(a => a.id === aid);

  /* ---------- de schrijftafel: artikelen met een statusketen ---------- */
  function artikelMaak(data) {
    data = data || {};
    const kop = scho(data.kop || data.naam, 120);
    if (!kop) return { status: 400, error: 'Geef het artikel een kop.' };
    const a = { id: id('art'), kop, rubriek: RUBRIEKEN.includes(data.rubriek) ? data.rubriek : 'nieuws',
      intro: scho(data.intro, 300), tekst: scho(data.tekst || data.brief, 8000),
      auteur: scho(data.auteur || data.huis, 60) || 'Redactie', status: 'concept', at: nu(), publicatieAt: null };
    R().artikelen.unshift(a);
    R().artikelen = R().artikelen.slice(0, 20000);
    save();
    return { ok: true, artikel: a };
  }
  // het Ideeenkamer-contract: een idee wordt een concept-artikel op de schrijftafel
  // (de spin-off leest r.ontwerp.id, dus het artikel gaat ook onder die naam mee terug)
  const ontwerpMaak = data => { const r = artikelMaak(data); return r.error ? r : { ...r, ontwerp: r.artikel }; };
  function artikelZet(aid, data) {
    const a = vind(aid);
    if (!a) return { status: 404, error: 'Artikel niet gevonden.' };
    if (a.status === 'gepubliceerd') return { status: 409, error: 'Een gepubliceerd artikel wijzig je niet meer; maak een vervolgstuk.' };
    for (const v of ['kop', 'intro', 'auteur']) if (data[v] !== undefined) a[v] = scho(data[v], v === 'kop' ? 120 : v === 'intro' ? 300 : 60);
    if (data.tekst !== undefined) a.tekst = scho(data.tekst, 8000);
    if (data.rubriek !== undefined && RUBRIEKEN.includes(data.rubriek)) a.rubriek = data.rubriek;
    save();
    return { ok: true, artikel: a };
  }
  function artikelStatus(aid, status) {
    const a = vind(aid);
    if (!a) return { status: 404, error: 'Artikel niet gevonden.' };
    if (!ARTIKEL_STATUS.includes(status)) return { status: 400, error: 'Onbekende status.' };
    if (status === 'gepubliceerd' && !a.tekst) return { status: 400, error: 'Een artikel zonder tekst publiceer je niet.' };
    a.status = status;
    a.publicatieAt = status === 'gepubliceerd' ? nu() : a.publicatieAt;
    save();
    return { ok: true, artikel: a };
  }
  function artikelVerwijder(aid) {
    const r = R();
    r.artikelen = r.artikelen.filter(a => a.id !== aid);
    save();
    return { ok: true };
  }

  // de gedeelde ctx voor de deelbestanden
  const ctx = { db, save, anthropic, scho, id, nu, R, vind, RUBRIEKEN, ARTIKEL_STATUS, EDITIE_STATUS };
  const api = { artikelMaak, ontwerpMaak, artikelZet, artikelStatus, artikelVerwijder,
    RUBRIEKEN, ARTIKEL_STATUS, EDITIE_STATUS };
  Object.assign(api, require('./pers')(ctx));
  Object.assign(api, require('./hoofdredacteur')(ctx));
  return { redactie: api };
}

module.exports = { maakRedactie };
