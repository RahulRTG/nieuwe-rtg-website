/* Onderwijs (deelmodule): de les: maken en meedoen op lescode, de live
   SSE-stream met presentie en het digitale schoolbord (strokes, wissen,
   undo). Krijgt de gedeelde context een keer bij het opstarten vanuit
   foundation/onderwijs.js. */
module.exports = (octx) => {
  const { router, F, save, nu, rid, schoon, crypto, anthropic, LETTERS, SYSTEM, DEMO, TIPS,
    nieuweCode, sse, stuur, online, presentie, lesVan, docentCheck, leerlingVan, lesPubliek } = octx;

  /* ---------- les maken / meedoen ---------- */
  router.post('/les/maak', (req, res) => {
    const code = nieuweCode();
    const les = { code, vak: schoon(req.body.vak, 40) || 'Les', docentNaam: schoon(req.body.naam, 40) || 'Begeleider',
      teacherToken: rid(24), bord: { strokes: [] }, leerlingen: {}, opgaven: [], agenda: [], at: nu() };
    F().lessen[code] = les; save();
    res.json({ code, token: les.teacherToken, les: lesPubliek(les) });
  });
  router.post('/les/join', (req, res) => {
    const les = lesVan(req, res); if (!les) return;
    const naam = schoon(req.body.naam, 40);
    if (!naam) return res.status(400).json({ error: 'Vul je naam in.' });
    let l = Object.values(les.leerlingen).find(x => x.naam.toLowerCase() === naam.toLowerCase());
    if (!l) { const sid = rid(4); l = { studentId: sid, naam, token: rid(24), schrift: { pages: [] }, at: nu() }; les.leerlingen[sid] = l; save(); }
    res.json({ token: l.token, studentId: l.studentId, naam: l.naam, les: lesPubliek(les), bord: les.bord.strokes, schrift: l.schrift });
    presentie(les.code);
  });
  router.get('/les/:code', (req, res) => {
    const les = F().lessen[String(req.params.code).toUpperCase()];
    if (!les) return res.status(404).json({ error: 'Onbekende les.' });
    res.json({ les: lesPubliek(les) });
  });

  /* ---------- live meekijken ---------- */
  router.get('/les/:code/stream', (req, res) => {
    const les = F().lessen[String(req.params.code).toUpperCase()];
    if (!les) return res.status(404).end();
    const role = req.query.role === 'docent' ? 'docent' : 'leerling';
    if (role === 'docent' && req.query.token !== les.teacherToken) return res.status(403).end();
    let studentId = null;
    if (role === 'leerling') {
      const l = Object.values(les.leerlingen).find(x => x.token === req.query.token);
      if (!l) return res.status(403).end();
      studentId = l.studentId;
    }
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    const client = { res, role, studentId };
    let set = sse.get(les.code); if (!set) { set = new Set(); sse.set(les.code, set); }
    set.add(client);
    presentie(les.code);
    const hart = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 25000);
    req.on('close', () => { clearInterval(hart); set.delete(client); presentie(les.code); });
  });

  /* ---------- het bord ---------- */
  router.post('/bord/stroke', (req, res) => {
    const les = lesVan(req, res); if (!les) return;
    if (!docentCheck(les, req, res)) return;
    const s = req.body.stroke;
    if (!s || !Array.isArray(s.points)) return res.status(400).json({ error: 'Geen geldige streek.' });
    const stroke = { id: rid(3),
      tool: ['pen', 'marker', 'gum'].includes(s.tool) ? s.tool : 'pen',
      kleur: /^#[0-9a-fA-F]{6}$/.test(s.kleur || '') ? s.kleur : '#ffffff',
      dikte: Math.min(60, Math.max(1, Number(s.dikte) || 3)),
      points: s.points.slice(0, 1500).map(p => [Math.round(Number(p[0]) || 0), Math.round(Number(p[1]) || 0)]) };
    les.bord.strokes.push(stroke);
    if (les.bord.strokes.length > 8000) les.bord.strokes.splice(0, les.bord.strokes.length - 8000);
    save();
    stuur(les.code, 'stroke', stroke, c => c.role === 'leerling');
    res.json({ ok: true, id: stroke.id });
  });
  router.post('/bord/wis', (req, res) => {
    const les = lesVan(req, res); if (!les) return; if (!docentCheck(les, req, res)) return;
    les.bord.strokes = []; save(); stuur(les.code, 'wis', {}, c => c.role === 'leerling'); res.json({ ok: true });
  });
  router.post('/bord/undo', (req, res) => {
    const les = lesVan(req, res); if (!les) return; if (!docentCheck(les, req, res)) return;
    les.bord.strokes.pop(); save(); stuur(les.code, 'bord', { strokes: les.bord.strokes }, c => c.role === 'leerling'); res.json({ ok: true });
  });
  router.get('/bord/:code', (req, res) => {
    const les = F().lessen[String(req.params.code).toUpperCase()];
    if (!les) return res.status(404).json({ error: 'Onbekende les.' });
    res.json({ strokes: les.bord.strokes });
  });
};
