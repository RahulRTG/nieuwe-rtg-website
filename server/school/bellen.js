/* School (deelmodule): bellen binnen de app -- het schoolkanaal heeft geen
   telefoonnummers nodig. Een OUDER belt de leraar of een ander gezin uit
   dezelfde klas (de telefoonboom-takken); de leraar belt een gezin terug.
   Kinderen bellen hier bewust NIET: er is en blijft geen privekanaal
   leraar-kind. De spraak loopt peer-to-peer (WebRTC); de server geeft
   alleen de belsignalen door, via een SSE-kanaal per klas. */
module.exports = (sctx) => {
  const { router, G, eigenVeld, K, S, schoon, gezinSessie, profielVan } = sctx;

  const klanten = new Map(); // klasCode -> Set van { res, wie: 'leraar' | 'gezin:CODE' }
  function stuur(kc, data, wie) {
    const set = klanten.get(kc); if (!set) return 0;
    let n = 0;
    const payload = 'event: bel\ndata: ' + JSON.stringify(data) + '\n\n';
    for (const c of set) if (c.wie === wie) { try { c.res.write(payload); n++; } catch (e) {} }
    return n;
  }

  // wie ben je? (de klas-auth op een token dat uit een ticket of uit het lijf komt)
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
    const p = g && profielVan(g, String(q.token || '')); // de ene gezinstokenvergelijking (foundation/gezinstoken.js)
    if (!p || !(p.rol === 'beheerder' || p.rol === 'ouder')) return null;
    if (!(k.leerlingen || []).some(l => l.gezinCode === g.code)) return null;
    return { wie: 'gezin:' + g.code, naam: p.naam };
  }

  /* HET KANAAL OPENT MET EEN STROOMTICKET (../kern/sessiestroom.js, soort
     `schoolbel`). Het leraar- of gezinstoken stond als query in het adres van
     deze EventSource, en een adres belandt in logs, geschiedenis en een
     Referer. Nu ruilt het scherm zijn token (in de kop) eerst voor een ticket,
     gebonden aan DEZE klas en DIT gezin (of de leraar), en staat alleen dat
     ticket in het adres. Bij openen wordt het token opnieuw getoetst met
     dezelfde twee vragen als altijd (leraarQ, ouderQ). Een token in de query
     krijgt 401, ook als het klopt. De dienst wordt bij een verzoek opgevraagd:
     deze router bestaat al voordat de kern er is. */
  const stroomdienst = require('../kern/sessiestroom');
  const TOKENS_IN_ADRES = ['token', 'leraarToken', 'personeelToken', 'beheerToken'];
  function wieVoor(raw, bij) {
    const [kc, gc] = String(bij || '').split('|');
    const k = eigenVeld(K(), kc);
    if (!k) return null;
    return gc ? ouderQ({ code: gc, token: raw }, k) : leraarQ({ leraarToken: raw }, k);
  }
  function stroom() {
    const d = stroomdienst.actief();
    if (d && !d.soorten().includes('schoolbel')) d.soort('schoolbel', { metBij: true, geldig: (raw, bij) => !!wieVoor(raw, bij) });
    return d;
  }
  const bijVan = (klas, code) => String(klas || '').trim().toUpperCase() + '|' + String(code || '').trim().toUpperCase();

  router.post('/school/belkanaal/ticket', async (req, res) => {
    const sessiestroom = stroom();
    if (!sessiestroom) return res.status(503).json({ error: 'Het belkanaal is nu niet bereikbaar.' });
    const kop = req.get('authorization') || '';
    const raw = kop.startsWith('Bearer ') ? kop.slice(7).trim() : '';
    if (!raw) return res.status(401).json({ error: 'Stuur het token in de kop Authorization: Bearer.' });
    const uit = await sessiestroom.geef('schoolbel', raw, bijVan(req.body && req.body.klasCode, req.body && req.body.code));
    if (!uit.ok) return res.status(uit.status === 401 ? 403 : (uit.status || 403)).json({ error: uit.status === 401
      ? 'Het belkanaal is voor de leraar en de ouders van deze klas.' : (uit.error || 'Geen toegang.') });
    res.set('Cache-Control', 'no-store');
    res.json({ ticket: uit.ticket, geldigTot: uit.geldigTot });
  });

  router.get('/school/belkanaal', async (req, res) => {
    if (TOKENS_IN_ADRES.some(n => req.query[n] !== undefined)) return res.status(401).json({
      error: 'Een token hoort niet in een adres.', hoe: 'Vraag een ticket met POST /api/foundation/school/belkanaal/ticket.' });
    const k = eigenVeld(K(), String(req.query.klasCode || '').toUpperCase());
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const sessiestroom = stroom();
    if (!sessiestroom) return res.status(503).json({ error: 'Het belkanaal is nu niet bereikbaar.' });
    const bij = bijVan(k.code, req.query.code);
    const uit = await sessiestroom.open('schoolbel', req.query.ticket, bij);
    const ik = uit.ok ? wieVoor(uit.token, bij) : null;
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
