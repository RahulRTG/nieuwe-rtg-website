/* RTG Pulse: het eigen microblog van RTG -- een soort Twitter, maar 9+ en
   zonder de donkere kanten. Korte berichten (280 tekens) op CODENAAM (privacy
   by design: echte namen blijven in de kluis), volgen per codenaam, liken,
   reageren en hashtags. De feed is BEWUST chronologisch: geen algoritme dat
   je vasthoudt, geen oneindige trucs, geen "voor jou" -- je volgt wie je
   volgt en je bent klaar als je bij bent (de merkregel: geen verslavende
   patronen). Alles door de 9+-poort (kern/veilig.js); de meldknop verbergt
   een bericht automatisch na drie unieke melders, waarna het kantoor het
   laatste woord heeft. Gedeelde context vanuit server.js. */
module.exports = ({ db, save, crypto, liveCodename, notify }) => {
  const { keur } = require('./veilig');
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(5).toString('hex');

  function P() {
    if (!db.data.pulse || typeof db.data.pulse !== 'object') db.data.pulse = { posts: [], volgt: {}, laatstePost: {} };
    const p = db.data.pulse;
    if (!Array.isArray(p.posts)) p.posts = [];
    if (!p.volgt || typeof p.volgt !== 'object') p.volgt = {};
    if (!p.laatstePost || typeof p.laatstePost !== 'object') p.laatstePost = {};
    return p;
  }
  const codenaam = sessieOfKey => typeof sessieOfKey === 'string'
    ? (liveCodename ? liveCodename(sessieOfKey) : '') || 'Een lid'
    : (liveCodename ? liveCodename(sessieOfKey) : '') || 'Een lid';
  const tags = t => [...new Set((String(t).match(/#([a-z0-9_]{2,30})/gi) || []).map(x => x.slice(1).toLowerCase()))].slice(0, 6);
  const zichtbaar = x => !x.weg && !x.verborgen;

  function pulsePost(key, naam, tekst) {
    const t = String(tekst || '').trim().slice(0, 280);
    if (!t) return { status: 400, error: 'Schrijf eerst iets.' };
    const k = keur(t);
    if (!k.ok) return { status: 400, error: k.reden };
    const p = P();
    // rustig aan: minimaal tien seconden tussen twee berichten (geen spampomp)
    const vorige = p.laatstePost[key];
    if (vorige && Date.now() - new Date(vorige).getTime() < 10000)
      return { status: 429, error: 'Rustig aan; wacht heel even tussen twee berichten.' };
    p.laatstePost[key] = nu();
    const post = { id: rid(), key, codenaam: naam, tekst: t, tags: tags(t), at: nu(), likes: {}, reacties: [], melders: {} };
    p.posts.unshift(post);
    p.posts = p.posts.slice(0, 100000);
    save();
    return { status: 200, ok: true, post: publiek(post, key) };
  }
  function pulseWeg(key, id) {
    const p = P();
    const post = p.posts.find(x => x.id === id);
    if (!post || post.key !== key) return { status: 404, error: 'Dit bericht is niet van jou of bestaat niet.' };
    post.weg = true; save();
    return { status: 200, ok: true };
  }
  function pulseLike(key, id) {
    const post = P().posts.find(x => x.id === id && zichtbaar(x));
    if (!post) return { status: 404, error: 'Bericht niet gevonden.' };
    if (post.likes[key]) delete post.likes[key]; else post.likes[key] = true;
    save();
    return { status: 200, ok: true, likes: Object.keys(post.likes).length, mijn: !!post.likes[key] };
  }
  function pulseReactie(key, naam, id, tekst) {
    const post = P().posts.find(x => x.id === id && zichtbaar(x));
    if (!post) return { status: 404, error: 'Bericht niet gevonden.' };
    const t = String(tekst || '').trim().slice(0, 280);
    if (!t) return { status: 400, error: 'Schrijf eerst iets.' };
    const k = keur(t);
    if (!k.ok) return { status: 400, error: k.reden };
    if (post.reacties.length >= 500) return { status: 400, error: 'Dit gesprek zit vol.' };
    post.reacties.push({ id: rid(), key, codenaam: naam, tekst: t, at: nu() });
    save();
    if (notify && post.key !== key) { try { notify(post.key, { icon: '💬', title: 'Pulse', body: naam + ' reageerde op je bericht.', scope: 'pulse' }); } catch (e) {} }
    return { status: 200, ok: true };
  }
  function pulseVolg(key, anderKey) {
    if (!anderKey || anderKey === key) return { status: 400, error: 'Die codenaam kun je niet volgen.' };
    const p = P();
    if (!p.volgt[key]) p.volgt[key] = {};
    const al = !!p.volgt[key][anderKey];
    if (al) delete p.volgt[key][anderKey]; else p.volgt[key][anderKey] = nu();
    save();
    return { status: 200, ok: true, volgIk: !al };
  }
  /* melden: drie unieke melders verbergen het bericht automatisch (9+ houdt
     zichzelf schoon); het kantoor kan het daarna terugzetten of weghalen */
  function pulseMeld(key, id, reden) {
    const post = P().posts.find(x => x.id === id && !x.weg);
    if (!post) return { status: 404, error: 'Bericht niet gevonden.' };
    if (post.key === key) return { status: 400, error: 'Je eigen bericht meld je niet; haal het gewoon weg.' };
    post.melders[key] = { reden: String(reden || '').slice(0, 120), at: nu() };
    if (Object.keys(post.melders).length >= 3) post.verborgen = true;
    save();
    return { status: 200, ok: true, verborgen: !!post.verborgen };
  }

  function publiek(x, mij) {
    return { id: x.id, codenaam: x.codenaam, van: x.key === mij ? 'ik' : x.key, tekst: x.tekst, tags: x.tags, at: x.at,
      likes: Object.keys(x.likes).length, mijnLike: !!x.likes[mij],
      reacties: x.reacties.slice(-30).map(r => ({ codenaam: r.codenaam, tekst: r.tekst, at: r.at, eigen: r.key === mij })),
      eigen: x.key === mij };
  }
  /* de feed: 'volgend' (wie je volgt + jezelf) of 'ontdek' (iedereen), altijd
     gewoon op tijd. Paginatie met een simpele cursor (voor dit tijdstip). */
  function pulseFeed(key, soort, voor) {
    const p = P();
    const mijnVolgt = p.volgt[key] || {};
    let lijst = p.posts.filter(zichtbaar);
    if (soort !== 'ontdek') lijst = lijst.filter(x => x.key === key || mijnVolgt[x.key]);
    if (voor) lijst = lijst.filter(x => x.at < voor);
    const uit = lijst.slice(0, 40);
    // trending: de meest gebruikte hashtags van de laatste 7 dagen (puur tellen)
    const grens = new Date(Date.now() - 7 * 86400000).toISOString();
    const tel = {};
    for (const x of p.posts) if (zichtbaar(x) && x.at > grens) for (const t of x.tags) tel[t] = (tel[t] || 0) + 1;
    const trending = Object.entries(tel).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, n]) => ({ tag, n }));
    return { status: 200, feed: uit.map(x => publiek(x, key)), volgend: Object.keys(mijnVolgt).length,
      cursor: uit.length === 40 ? uit[uit.length - 1].at : null, trending, leeftijd: '9+' };
  }
  function pulseProfiel(key, anderKey) {
    const p = P();
    const wie = anderKey || key;
    const posts = p.posts.filter(x => zichtbaar(x) && x.key === wie).slice(0, 40);
    return { status: 200, codenaam: posts[0] ? posts[0].codenaam : codenaam(wie),
      posts: posts.map(x => publiek(x, key)),
      volgers: Object.values(p.volgt).filter(v => v[wie]).length,
      volgIk: !!(p.volgt[key] && p.volgt[key][wie]), zelf: wie === key };
  }

  return { pulsePost, pulseWeg, pulseLike, pulseReactie, pulseVolg, pulseMeld, pulseFeed, pulseProfiel };
};
