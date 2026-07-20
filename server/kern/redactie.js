/* RTG Redactie: het persbureau van RTG -- krant, magazine en drukkerij in een
   huis, de meest complete studio van de kantorenlaag. Journalisten schrijven
   artikelen per rubriek met een nette statusketen (concept -> eindredactie ->
   gepubliceerd; PUBLICEREN beslist altijd een mens), de drukkerij stelt edities
   samen (krant of magazine, met oplage en een drukproef als tekstblad), en de
   AI-hoofdredacteur (Rahul) schrijft mee en redigeert -- maar drukt nooit zelf
   op de knop.

   De samenwerking met de andere kantoren zit ingebouwd: de nieuwstips-wand
   haalt verhaal-ideeen uit het hele platform (Pulse-trends, de bekendmakingen
   van het Rijk en de uitgewerkte ideeen van de ontwerpbureaus), en via de
   Ideeenkamer doet de Redactie mee als volwaardig bureau: een idee kan als
   concept-artikel de redactie in (ontwerpMaak-contract). Het gepubliceerde
   nieuws verschijnt voor iedereen in de eigen Nieuws-app (routes/member).
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

  /* ---------- de drukkerij: edities samenstellen en drukken ---------- */
  function editieMaak(data) {
    data = data || {};
    const titel = scho(data.titel, 100);
    if (!titel) return { status: 400, error: 'Geef de editie een titel.' };
    const soort = data.soort === 'magazine' ? 'magazine' : 'krant';
    const ids = (Array.isArray(data.artikelIds) ? data.artikelIds : [])
      .filter(aid => { const a = vind(aid); return a && a.status === 'gepubliceerd'; }).slice(0, 60);
    if (!ids.length) return { status: 400, error: 'Kies minstens een GEPUBLICEERD artikel voor de editie.' };
    const e = { id: id('ed'), soort, titel, datum: nu().slice(0, 10), artikelIds: ids,
      oplage: Math.max(1, Math.min(1000000, Math.round(Number(data.oplage) || 1000))), status: 'samenstellen', at: nu() };
    R().edities.unshift(e);
    R().edities = R().edities.slice(0, 2000);
    save();
    return { ok: true, editie: e };
  }
  function editieStatus(eid, status) {
    const e = R().edities.find(x => x.id === eid);
    if (!e) return { status: 404, error: 'Editie niet gevonden.' };
    if (!EDITIE_STATUS.includes(status)) return { status: 400, error: 'Onbekende status.' };
    // de drukstraat gaat een kant op: samenstellen -> ter-perse -> gedrukt
    if (EDITIE_STATUS.indexOf(status) < EDITIE_STATUS.indexOf(e.status)) return { status: 409, error: 'De drukstraat draait niet achteruit.' };
    e.status = status;
    if (status === 'gedrukt') e.gedruktAt = nu();
    save();
    return { ok: true, editie: e };
  }
  // de drukproef: de hele editie als tekstblad (zoals het lookbook van de studio)
  function drukproef(eid) {
    const e = R().edities.find(x => x.id === eid);
    if (!e) return { status: 404, error: 'Editie niet gevonden.' };
    const regels = ['=== ' + (e.soort === 'magazine' ? 'RTG MAGAZINE' : 'RTG COURANT') + ' · ' + e.titel + ' · ' + e.datum + ' ===',
      'Oplage: ' + e.oplage + ' · status: ' + e.status, ''];
    for (const aid of e.artikelIds) {
      const a = vind(aid);
      if (!a) continue;
      regels.push('[' + a.rubriek.toUpperCase() + '] ' + a.kop, 'door ' + a.auteur, a.intro || '', a.tekst, '', '---', '');
    }
    return { ok: true, blad: regels.join('\n') };
  }

  /* ---------- het overzicht + het gepubliceerde nieuws (voor de Nieuws-app) ---------- */
  function overzicht() {
    const r = R();
    const perStatus = {}, perRubriek = {};
    for (const a of r.artikelen) {
      perStatus[a.status] = (perStatus[a.status] || 0) + 1;
      perRubriek[a.rubriek] = (perRubriek[a.rubriek] || 0) + 1;
    }
    return { ok: true, artikelen: r.artikelen.slice(0, 200), edities: r.edities.slice(0, 40),
      perStatus, perRubriek, rubrieken: RUBRIEKEN, artikelStatus: ARTIKEL_STATUS, editieStatus: EDITIE_STATUS };
  }
  function nieuws(rubriek) {
    let lijst = R().artikelen.filter(a => a.status === 'gepubliceerd');
    if (rubriek && RUBRIEKEN.includes(rubriek)) lijst = lijst.filter(a => a.rubriek === rubriek);
    lijst = lijst.slice().sort((a, b) => String(b.publicatieAt).localeCompare(String(a.publicatieAt)));
    return { ok: true, rubrieken: RUBRIEKEN, artikelen: lijst.slice(0, 60).map(a => ({
      id: a.id, kop: a.kop, rubriek: a.rubriek, intro: a.intro, auteur: a.auteur, at: a.publicatieAt })) };
  }
  function nieuwsArtikel(aid) {
    const a = vind(aid);
    if (!a || a.status !== 'gepubliceerd') return { status: 404, error: 'Dit artikel is er niet (meer).' };
    return { ok: true, artikel: { id: a.id, kop: a.kop, rubriek: a.rubriek, intro: a.intro, tekst: a.tekst, auteur: a.auteur, at: a.publicatieAt } };
  }

  /* ---------- de samenwerking: de nieuwstips-wand uit het hele platform ---------- */
  function nieuwstips() {
    const tips = [];
    // wat leeft er bij de leden (Pulse: de trending hashtags van de week)
    const grens = new Date(Date.now() - 7 * 86400000).toISOString();
    const tel = {};
    for (const p of ((db.data.pulse || {}).posts || [])) {
      if (p.weg || p.verborgen || p.at <= grens) continue;
      for (const t of (p.tags || [])) tel[t] = (tel[t] || 0) + 1;
    }
    for (const [tag, n] of Object.entries(tel).sort((a, b) => b[1] - a[1]).slice(0, 4))
      tips.push({ bron: 'Pulse', icoon: '⚡', tip: '#' + tag + ' leeft deze week onder de leden (' + n + ' berichten). Wat zit erachter?' });
    // wat kondigt het Rijk aan (de bekendmakingen van De Overheid)
    for (const b of (db.data.rijkBekend || []).slice(0, 3))
      tips.push({ bron: 'Rijksoverheid', icoon: '🏛️', tip: b.titel + ' -- goed voor een uitlegstuk.' });
    // wat hebben de ontwerpbureaus uitgewerkt (de Ideeenkamer)
    for (const o of ((db.data.ideeen || {}).lijst || []).filter(x => x.status === 'uitgewerkt').slice(0, 3))
      tips.push({ bron: 'Ideeenkamer', icoon: '💡', tip: '"' + o.titel + '" is uitgewerkt door de bureaus -- een makingsverhaal.' });
    return { ok: true, tips: tips.slice(0, 10) };
  }

  /* ---------- de AI-hoofdredacteur: schrijft mee, redigeert, publiceert NOOIT ---------- */
  async function aiSchrijf(onderwerp, rubriek) {
    const q = scho(onderwerp, 200);
    if (!q) return { status: 400, error: 'Waar moet het stuk over gaan?' };
    const rub = RUBRIEKEN.includes(rubriek) ? rubriek : 'nieuws';
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 700,
          system: require('./rahul').RAHUL_LEAD + 'je bent de AI-hoofdredacteur van RTG Redactie. Schrijf een CONCEPT voor de rubriek ' + rub +
            ': een pakkende kop, een intro van twee zinnen en een artikel van drie korte alinea\'s, in helder Nederlands. ' +
            'Verzin GEEN feiten, namen of cijfers die je niet zeker weet; markeer open plekken met [check]. ' +
            'Antwoord uitsluitend als JSON: {"kop":"...","intro":"...","tekst":"..."}.',
          messages: [{ role: 'user', content: q }]
        });
        const m = ((r.content.find(c => c.type === 'text') || {}).text || '').match(/\{[\s\S]*\}/);
        if (m) { const j = JSON.parse(m[0]); if (j.kop) return { ok: true, kop: scho(j.kop, 120), intro: scho(j.intro, 300), tekst: scho(j.tekst, 8000), bron: 'ai' }; }
      } catch (e) { /* val terug */ }
    }
    return { ok: true, bron: 'demo', kop: q.slice(0, 1).toUpperCase() + q.slice(1),
      intro: 'De redactie duikt in ' + q + '. Wat er speelt en waarom het ertoe doet.',
      tekst: 'Eerste alinea: wat is er gebeurd rond ' + q + '? [check de feiten]\n\nTweede alinea: wat betekent het voor de leden en partners? [check]\n\nDerde alinea: hoe gaat dit verder? De redactie volgt het.' };
  }
  async function aiRedactie(aid) {
    const a = vind(aid);
    if (!a) return { status: 404, error: 'Artikel niet gevonden.' };
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 400,
          system: require('./rahul').RAHUL_LEAD + 'je bent de eindredacteur van RTG Redactie. Geef korte, scherpe maar respectvolle redactie op dit stuk: ' +
            'de kop, de eerste zin, de opbouw, spelfouten en welke feiten nog gecheckt moeten worden. Sluit af met een helder oordeel: klaar voor publicatie of nog niet. ' +
            'Publiceren beslist ALTIJD een mens, nooit jij.',
          messages: [{ role: 'user', content: 'KOP: ' + a.kop + '\nINTRO: ' + (a.intro || '-') + '\nTEKST:\n' + (a.tekst || '-') }]
        });
        const tekst = (r.content.find(c => c.type === 'text') || {}).text;
        if (tekst) return { ok: true, redactie: tekst };
      } catch (e) { /* val terug */ }
    }
    const punten = [];
    if (!a.intro) punten.push('Er is nog geen intro; twee zinnen die de lezer vastpakken.');
    if ((a.tekst || '').length < 200) punten.push('Het stuk is nog dun; werk het uit naar minstens drie alinea\'s.');
    if (/\[check\]/i.test(a.tekst || '')) punten.push('Er staan nog [check]-plekken open; eerst de feiten rond maken.');
    punten.push('Lees de kop hardop: dekt hij de lading in acht woorden?');
    return { ok: true, redactie: 'Redactie op "' + a.kop + '":\n- ' + punten.join('\n- ') + '\n\nOordeel: ' + (punten.length > 2 ? 'nog niet klaar voor publicatie.' : 'bijna klaar; publiceren blijft uw besluit.') };
  }

  return { redactie: { overzicht, artikelMaak, ontwerpMaak, artikelZet, artikelStatus, artikelVerwijder,
    editieMaak, editieStatus, drukproef, nieuws, nieuwsArtikel, nieuwstips, aiSchrijf, aiRedactie,
    RUBRIEKEN, ARTIKEL_STATUS, EDITIE_STATUS } };
}

module.exports = { maakRedactie };
