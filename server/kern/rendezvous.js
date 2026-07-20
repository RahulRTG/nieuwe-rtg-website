/* Kern-module "rendezvous": Rendez-vous -- de besloten AI-datingapp van de
   Lifestyle Pass. Leden zetten een discreet profiel op met hun wensen en de
   locaties waar zij openstaan voor een jetset-date. Twee leden die elkaar leuk
   vinden (wederzijdse like) hebben een match; Rahul stelt dan een date voor op een
   locatie die beiden hebben aangegeven of voor openstaan. De pool bestaat alleen
   uit Lifestyle- en Business-leden -- exclusief en op codenaam (privacy by design:
   echte namen blijven in de kluis). Rahul BELOOFT nooit een reservering; hij stelt
   voor en De Rechterhand regelt het pas als het rond is. Gedeelde context vanuit
   server.js. */
module.exports = ({ db, save, crypto, liveCodename, anthropic, notify }) => {
  const nu = () => new Date().toISOString();
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const lijstUit = (v, max, elk) => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => schoon(x, elk || 40)).filter(Boolean).slice(0, max || 12);

  function R() {
    if (!db.data.rendezvous || typeof db.data.rendezvous !== 'object') db.data.rendezvous = { profielen: {}, likes: {}, passes: {} };
    const r = db.data.rendezvous;
    for (const v of ['profielen', 'likes', 'passes']) if (!r[v] || typeof r[v] !== 'object') r[v] = {};
    return r;
  }
  const codenaam = key => (liveCodename ? liveCodename(key) : '') || 'Een lid';
  // overlap van twee locatielijsten, hoofdletterongevoelig, met de oorspronkelijke schrijfwijze
  function gedeeld(a, b) {
    const bl = (b || []).map(x => x.toLowerCase());
    return (a || []).filter(x => bl.includes(x.toLowerCase()));
  }

  function rvProfielGet(key) {
    const r = R();
    const p = r.profielen[key] || { aan: false, over: '', zoekt: '', wensen: [], locaties: [] };
    return { status: 200, profiel: { aan: !!p.aan, over: p.over || '', zoekt: p.zoekt || '', wensen: p.wensen || [], locaties: p.locaties || [] }, codenaam: codenaam(key) };
  }
  function rvProfiel(key, b) {
    const r = R();
    const p = r.profielen[key] || { at: nu() };
    if (b.aan !== undefined) p.aan = b.aan === true;
    if (b.over !== undefined) p.over = schoon(b.over, 600);
    if (b.zoekt !== undefined) p.zoekt = schoon(b.zoekt, 300);
    if (b.wensen !== undefined) p.wensen = lijstUit(b.wensen, 12, 40);
    if (b.locaties !== undefined) p.locaties = lijstUit(b.locaties, 12, 40);
    p.bij = nu();
    r.profielen[key] = p; save();
    return { status: 200, ok: true };
  }

  // wie mag ik zien: andere leden met een actief profiel, niet ikzelf, niet weggeveegd
  function rvKandidaten(key) {
    const r = R();
    const mij = r.profielen[key] || { locaties: [] };
    const mijnLikes = r.likes[key] || {};
    const mijnPasses = r.passes[key] || {};
    const uit = [];
    for (const [k, p] of Object.entries(r.profielen)) {
      if (k === key || !p.aan) continue;
      if (mijnPasses[k]) continue;
      const zijLikenMij = !!(r.likes[k] && r.likes[k][key]);
      const ikLikeHen = !!mijnLikes[k];
      uit.push({ id: k, codenaam: codenaam(k), over: p.over || '', zoekt: p.zoekt || '',
        wensen: p.wensen || [], locaties: p.locaties || [], gedeeldeLocaties: gedeeld(mij.locaties, p.locaties),
        likteMij: zijLikenMij && !ikLikeHen,
        status: ikLikeHen && zijLikenMij ? 'match' : ikLikeHen ? 'geliked' : 'nieuw' });
    }
    // eerst wie u al leuk vindt, dan de meeste gedeelde locaties
    uit.sort((a, b) => (b.likteMij - a.likteMij) || (b.gedeeldeLocaties.length - a.gedeeldeLocaties.length));
    return { status: 200, kandidaten: uit.slice(0, 60), profielAan: !!mij.aan };
  }

  function rvLike(key, targetKey) {
    const r = R();
    if (!targetKey || targetKey === key) return { status: 400, error: 'Onbekend lid.' };
    if (!r.profielen[key] || !r.profielen[key].aan) return { status: 400, error: 'Zet eerst uw eigen profiel aan.' };
    const doel = r.profielen[targetKey];
    if (!doel || !doel.aan) return { status: 404, error: 'Dit lid is niet (meer) beschikbaar.' };
    if (!r.likes[key]) r.likes[key] = {};
    if (r.passes[key]) delete r.passes[key][targetKey];
    r.likes[key][targetKey] = nu();
    const match = !!(r.likes[targetKey] && r.likes[targetKey][key]);
    save();
    if (match && notify) {
      const g = gedeeld(r.profielen[key].locaties, doel.locaties);
      const waar = g.length ? ' Denk aan een date in ' + g[0] + '.' : '';
      try { notify(key, { title: 'Rendez-vous', body: 'U heeft een match met ' + codenaam(targetKey) + '.' + waar, scope: 'lifestyle' }); } catch (e) {}
      try { notify(targetKey, { title: 'Rendez-vous', body: 'U heeft een match met ' + codenaam(key) + '.' + waar, scope: 'lifestyle' }); } catch (e) {}
    }
    return { status: 200, ok: true, match };
  }
  function rvPas(key, targetKey) {
    const r = R();
    if (!targetKey) return { status: 400, error: 'Onbekend lid.' };
    if (!r.passes[key]) r.passes[key] = {};
    r.passes[key][targetKey] = nu();
    if (r.likes[key]) delete r.likes[key][targetKey];
    save();
    return { status: 200, ok: true };
  }

  function matchesVan(key) {
    const r = R();
    const mijn = r.likes[key] || {};
    const mij = r.profielen[key] || { locaties: [] };
    const uit = [];
    for (const t of Object.keys(mijn)) {
      if (r.likes[t] && r.likes[t][key] && r.profielen[t]) {
        const g = gedeeld(mij.locaties, r.profielen[t].locaties);
        uit.push({ id: t, codenaam: codenaam(t), gedeeldeLocaties: g, voorstel: g[0] || null, sinds: mijn[t] });
      }
    }
    uit.sort((a, b) => String(b.sinds).localeCompare(String(a.sinds)));
    return uit;
  }
  function rvMatches(key) { return { status: 200, matches: matchesVan(key) }; }

  // Rahul stelt een jetset-date voor bij een match, op een gedeelde/openstaande locatie
  async function rvDate(key, targetKey, vraag) {
    const r = R();
    const m = matchesVan(key).find(x => x.id === targetKey);
    if (!m) return { status: 400, error: 'Dit is (nog) geen wederzijdse match.' };
    const mij = r.profielen[key] || { locaties: [], wensen: [] };
    const zij = r.profielen[targetKey] || { locaties: [], wensen: [] };
    const locatie = m.gedeeldeLocaties[0] || mij.locaties[0] || zij.locaties[0] || '';
    const opties = (m.gedeeldeLocaties.length ? m.gedeeldeLocaties : [...new Set([...(mij.locaties || []), ...(zij.locaties || [])])]).slice(0, 5);
    const q = schoon(vraag, 300);
    const ctxTekst = 'Match met ' + m.codenaam + '. Gedeelde locaties: ' + (m.gedeeldeLocaties.join(', ') || 'geen') +
      '. Locaties waar zij openstaan: ' + (opties.join(', ') || 'onbekend') + '. Wat u zoekt: ' + (mij.zoekt || 'niet opgegeven') + '.';
    if (anthropic) {
      try {
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 320,
          system: require('./rahul').RAHUL_LEAD + 'u bent de koppelaar van Rendez-vous, de besloten datingdienst van de Lifestyle Pass. ' +
            'Het lid heeft een match. Stel een smaakvolle jetset-date voor op een locatie die beiden hebben aangegeven of voor openstaan' +
            (locatie ? ' (bij voorkeur ' + locatie + ')' : '') + '. Spreek het lid aan met "u", warm maar ingetogen. ' +
            'Noem GEEN echte hotel- of restaurantnamen als bevestigde optie en beloof NOOIT een reservering: u schetst het idee en zegt dat De Rechterhand het regelt zodra beiden akkoord zijn. Context: ' + ctxTekst,
          messages: [{ role: 'user', content: q || 'Stel een date voor.' }]
        });
        const tekst = res.content && res.content[0] && res.content[0].text;
        if (tekst) return { status: 200, ok: true, locatie, opties, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    const demo = locatie
      ? 'Wat een mooie match. U staat allebei open voor ' + locatie + ' -- een uitgelezen plek voor een eerste ontmoeting. Denk aan een rustig diner met uitzicht, ruim de tijd, niets gehaast. Zegt u het woord, dan legt De Rechterhand het samen met ' + m.codenaam + ' vast; ik beloof niets voordat het rond is.'
      : 'Wat een mooie match met ' + m.codenaam + '. U heeft nog geen gedeelde locatie aangegeven; laat mij weten waar u openstaat voor een ontmoeting, dan schets ik een date en regelt De Rechterhand de rest.';
    return { status: 200, ok: true, demo: true, locatie, opties, antwoord: demo };
  }

  return { rvProfielGet, rvProfiel, rvKandidaten, rvLike, rvPas, rvMatches, rvDate };
};
