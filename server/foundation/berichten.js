/* RTFoundation-berichten: in de app berichten en (beeld)bellen tussen
   gezinsleden. Zo hoeft niemand een telefoonnummer van moeder of de kinderen te
   delen: je bereikt elkaar via de app. Alleen de noodnummers staan bij de
   belangrijke info. Chatberichten liggen versleuteld; een live SSE-kanaal per
   gezin bezorgt chat en de WebRTC-belsignalen realtime. Een offline gekoppelde
   gast krijgt de melding via ctx.pushHook (gezet door de gastenlaag).
   Gemount vanuit foundation.js op de gedeelde context. */
module.exports = (ctx) => {
  const { router, eigenVeld, nu, save, rid, schoon, encS, decS,
    sessieVan, gezinVan, profielVan } = ctx;

  const gezinSse = new Map(); // code -> Set van { res, profielId }
  function gezinStuur(code, event, data, filter) {
    const set = gezinSse.get(code); if (!set) return;
    const payload = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
    for (const c of set) if (!filter || filter(c)) { try { c.res.write(payload); } catch (e) {} }
  }
  function pairKey(a, b) { return [String(a), String(b)].sort().join(':'); }
  function meldNaarGast(profiel, g, van, tekst, soort) {
    if (!profiel.koppel || !profiel.koppel.userId) return;
    let accounts; try { accounts = require('./../accounts'); } catch (e) { return; }
    try {
      const md = accounts.getMemberState(profiel.koppel.userId) || {};
      if (!Array.isArray(md.foundationMeldingen)) md.foundationMeldingen = [];
      md.foundationMeldingen.unshift({ id: rid(4), at: nu(), gezin: g.naam, code: g.code, profielNaam: profiel.naam, van, tekst, soort: soort || 'bericht', gelezen: false });
      md.foundationMeldingen = md.foundationMeldingen.slice(0, 40);
      accounts.saveMemberState(profiel.koppel.userId, md);
    } catch (e) {}
    if (ctx.pushHook) { try { ctx.pushHook(profiel.koppel.userId, { title: 'RTFoundation · ' + g.naam, body: van + ': ' + String(tekst).slice(0, 120), tag: 'rtf-chat-' + van }); } catch (e) {} }
  }

  router.get('/gezin/:code/kanaal', (req, res) => {
    const g = gezinVan(req, res); if (!g) return;
    const p = profielVan(g, req.query.token);
    if (!p) { res.status(403).end(); return; }
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    const client = { res, profielId: p.id };
    let set = gezinSse.get(g.code); if (!set) { set = new Set(); gezinSse.set(g.code, set); }
    set.add(client);
    const hart = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 25000);
    req.on('close', () => { clearInterval(hart); set.delete(client); });
  });

  router.post('/gezin/chat', (req, res) => {
    const s = sessieVan(req, res); if (!s) return;
    const naarP = eigenVeld(s.g.profielen, req.body.naar);
    if (!naarP) return res.status(404).json({ error: 'Dit gezinslid bestaat niet.' });
    const tekst = schoon(req.body.tekst, 1000);
    if (!tekst) return res.status(400).json({ error: 'Schrijf een bericht.' });
    if (!s.g.chats) s.g.chats = {};
    const key = pairKey(s.p.id, naarP.id);
    if (!s.g.chats[key]) s.g.chats[key] = [];
    const m = { id: rid(3), van: s.p.id, naar: naarP.id, tekst: encS(tekst), at: nu(), gelezenDoor: [s.p.id] };
    s.g.chats[key].push(m); s.g.chats[key] = s.g.chats[key].slice(-500); save();
    const pub = { id: m.id, van: m.van, vanNaam: s.p.naam, naar: m.naar, tekst, at: m.at };
    gezinStuur(s.g.code, 'chat', pub, c => c.profielId === naarP.id || c.profielId === s.p.id);
    meldNaarGast(naarP, s.g, s.p.naam, tekst, 'bericht'); // offline gekoppelde gast: inbox + push
    res.json({ ok: true, bericht: pub });
  });
  router.get('/gezin/:code/chat/:metId', (req, res) => {
    const s = sessieVan(req, res); if (!s) return;
    const key = pairKey(s.p.id, String(req.params.metId));
    const arr = (s.g.chats || {})[key] || [];
    const lijst = arr.map(m => ({ id: m.id, van: m.van, naar: m.naar, tekst: decS(m.tekst), at: m.at, vanMij: m.van === s.p.id }));
    let veranderd = false;
    arr.forEach(m => { if (m.van !== s.p.id && !(m.gelezenDoor || []).includes(s.p.id)) { (m.gelezenDoor = m.gelezenDoor || []).push(s.p.id); veranderd = true; } });
    if (veranderd) save();
    res.json({ berichten: lijst });
  });
  router.get('/gezin/:code/chats', (req, res) => {
    const s = sessieVan(req, res); if (!s) return;
    const chats = Object.values(s.g.profielen).filter(p => p.id !== s.p.id).map(p => {
      const arr = (s.g.chats || {})[pairKey(s.p.id, p.id)] || [];
      const laatste = arr[arr.length - 1];
      return { id: p.id, naam: p.naam, avatar: p.avatar, kleur: p.kleur, rol: p.rol, gekoppeld: !!p.koppel,
        laatste: laatste ? decS(laatste.tekst) : '', laatsteAt: laatste ? laatste.at : null,
        ongelezen: arr.filter(m => m.van !== s.p.id && !(m.gelezenDoor || []).includes(s.p.id)).length };
    }).sort((a, b) => (b.laatsteAt || '').localeCompare(a.laatsteAt || ''));
    res.json({ chats });
  });

  // (beeld)bellen: WebRTC-signaal (ring/accept/offer/answer/ice/hangup) doorgeven
  router.post('/gezin/bel', (req, res) => {
    const s = sessieVan(req, res); if (!s) return;
    const naarP = eigenVeld(s.g.profielen, req.body.naar);
    if (!naarP) return res.status(404).json({ error: 'Onbekend gezinslid.' });
    const kind = String(req.body.kind || '').slice(0, 12);
    gezinStuur(s.g.code, 'bel', { van: s.p.id, vanNaam: s.p.naam, vanAvatar: s.p.avatar, naar: naarP.id, kind, video: !!req.body.video, payload: req.body.payload || null }, c => c.profielId === naarP.id);
    if (kind === 'ring' && naarP.koppel && naarP.koppel.userId && ctx.pushHook) {
      try { ctx.pushHook(naarP.koppel.userId, { title: 'RTFoundation · ' + s.g.naam, body: s.p.naam + ' belt je' + (req.body.video ? ' (video)' : ''), tag: 'rtf-bel' }); } catch (e) {}
    }
    res.json({ ok: true });
  });
};
