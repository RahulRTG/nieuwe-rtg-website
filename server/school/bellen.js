/* School (deelmodule): bellen binnen de app -- het schoolkanaal heeft geen
   telefoonnummers nodig. Een OUDER belt de leraar of een ander gezin uit
   dezelfde klas (de telefoonboom-takken); de leraar belt een gezin terug.
   Kinderen bellen hier bewust NIET: er is en blijft geen privekanaal
   leraar-kind. De spraak loopt peer-to-peer (WebRTC); de server geeft
   alleen de belsignalen door, via een SSE-kanaal per klas. */
module.exports = (sctx) => {
  const { router, G, eigenVeld, K, S, schoon, gezinSessie } = sctx;

  const klanten = new Map(); // klasCode -> Set van { res, wie: 'leraar' | 'gezin:CODE' }
  function stuur(kc, data, wie) {
    const set = klanten.get(kc); if (!set) return 0;
    let n = 0;
    const payload = 'event: bel\ndata: ' + JSON.stringify(data) + '\n\n';
    for (const c of set) if (c.wie === wie) { try { c.res.write(payload); n++; } catch (e) {} }
    return n;
  }

  // wie ben je? (query-varianten van de klas-auth, want een SSE-kanaal is een GET)
  function leraarQ(q, k) {
    const tok = String(q.leraarToken || q.personeelToken || q.beheerToken || '');
    if (!tok) return null;
    if (k.token === tok) return { wie: 'leraar', naam: k.leraar || 'de leraar' };
    const sch = k.schoolCode ? S()[k.schoolCode] : null;
    if (sch && sch.token === tok) return { wie: 'leraar', naam: 'de directie' };
    const p = sch && Object.values(sch.personeel || {}).find(x => x.token === tok);
    if (p && p.status === 'actief' && (p.id === k.leraarId
      || (k.leraren || []).some(x => x.id === p.id)
      || (k.waarnemer && k.waarnemer.id === p.id))) return { wie: 'leraar', naam: p.naam };
    return null;
  }
  function ouderQ(q, k) {
    const g = eigenVeld(G(), String(q.code || '').toUpperCase());
    const p = g && Object.values(g.profielen || {}).find(x => x.token === String(q.token || ''));
    if (!p || !(p.rol === 'beheerder' || p.rol === 'ouder')) return null;
    if (!(k.leerlingen || []).some(l => l.gezinCode === g.code)) return null;
    return { wie: 'gezin:' + g.code, naam: p.naam };
  }

  router.get('/school/belkanaal', (req, res) => {
    const k = eigenVeld(K(), String(req.query.klasCode || '').toUpperCase());
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const ik = leraarQ(req.query, k) || ouderQ(req.query, k);
    if (!ik) return res.status(403).json({ error: 'Het belkanaal is voor de leraar en de ouders van deze klas.' });
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    const client = { res, wie: ik.wie };
    let set = klanten.get(k.code); if (!set) { set = new Set(); klanten.set(k.code, set); }
    set.add(client);
    const hart = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 25000);
    req.on('close', () => { clearInterval(hart); set.delete(client); });
  });

  /* het belsignaal (ring/accept/offer/answer/ice/hangup). Afzender: een ouder
     of de leraar. Doel: 'leraar' of een gezinscode uit dezelfde klas. */
  router.post('/school/bel', (req, res) => {
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    let ik = null;
    const lerTok = String(req.body.leraarToken || req.body.personeelToken || req.body.beheerToken || '');
    if (lerTok) {
      ik = leraarQ(req.body, k);
      if (!ik) return res.status(403).json({ error: 'Verkeerd token voor deze klas.' });
    } else {
      const s = gezinSessie(req, res); if (!s) return;
      if (!s.beheerder) return res.status(403).json({ error: 'Bellen in het schoolkanaal is voor ouders en de leraar; kinderen bereiken de leraar via de gezinsberichten.' });
      if (!(k.leerlingen || []).some(l => l.gezinCode === s.g.code)) return res.status(403).json({ error: 'Jullie horen niet bij deze klas.' });
      ik = { wie: 'gezin:' + s.g.code, naam: s.p.naam };
    }
    const naar = String(req.body.naar || '').trim().toUpperCase();
    let doel;
    if (naar === 'LERAAR') doel = 'leraar';
    else if ((k.leerlingen || []).some(l => l.gezinCode === naar)) doel = 'gezin:' + naar;
    else return res.status(404).json({ error: 'Dit doel hoort niet bij deze klas.' });
    if (doel === ik.wie) return res.status(400).json({ error: 'Jezelf bellen hoeft niet.' });
    const kind = String(req.body.kind || '').slice(0, 12);
    const bezorgd = stuur(k.code, { van: ik.wie, vanNaam: schoon(ik.naam, 60), kind,
      video: !!req.body.video, payload: req.body.payload || null }, doel);
    res.json({ ok: true, bezorgd });
  });
};
