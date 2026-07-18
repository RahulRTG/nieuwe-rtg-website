/* Onderwijs (deelmodule): het schrift: opslaan en teruglezen per leerling,
   opgaven maken en inleveren, de agenda, de AI-bijleshulp met demo-terugval,
   de dagtip en de reis-aanvraag/voordracht. Krijgt de gedeelde context een
   keer bij het opstarten vanuit foundation/onderwijs.js. */
module.exports = (octx) => {
  const { router, F, save, nu, rid, schoon, crypto, anthropic, LETTERS, SYSTEM, DEMO, TIPS,
    nieuweCode, sse, stuur, online, presentie, lesVan, docentCheck, leerlingVan, lesPubliek } = octx;
  /* ---------- het schrift ---------- */
  router.post('/schrift/opslaan', (req, res) => {
    const les = lesVan(req, res); if (!les) return;
    const l = leerlingVan(les, req, res); if (!l) return;
    const pages = Array.isArray(req.body.pages) ? req.body.pages.slice(0, 60) : [];
    l.schrift.pages = pages.map(p => {
      if (p && p.type === 'tekst') return { type: 'tekst', titel: schoon(p.titel, 80), inhoud: schoon(p.inhoud, 20000) };
      if (p && p.type === 'foto' && typeof p.data === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(p.data) && p.data.length < 3e6)
        return { type: 'foto', titel: schoon(p.titel, 80), data: p.data };
      return { type: 'tekening', titel: schoon((p && p.titel) || '', 80), strokes: Array.isArray(p && p.strokes) ? p.strokes.slice(0, 6000) : [] };
    });
    l.schrift.updatedAt = nu(); save();
    res.json({ ok: true }); presentie(les.code);
  });
  router.get('/schrift/:code', (req, res) => {
    const les = F().lessen[String(req.params.code).toUpperCase()];
    if (!les) return res.status(404).json({ error: 'Onbekende les.' });
    const l = leerlingVan(les, req, res); if (!l) return;
    res.json({ schrift: l.schrift });
  });
  router.get('/schrift/:code/:studentId', (req, res) => {
    const les = F().lessen[String(req.params.code).toUpperCase()];
    if (!les) return res.status(404).json({ error: 'Onbekende les.' });
    if (!docentCheck(les, req, res)) return;
    const l = les.leerlingen[req.params.studentId];
    if (!l) return res.status(404).json({ error: 'Leerling niet gevonden.' });
    res.json({ naam: l.naam, schrift: l.schrift });
  });

  /* ---------- opgaven ---------- */
  router.post('/opgave', (req, res) => {
    const les = lesVan(req, res); if (!les) return; if (!docentCheck(les, req, res)) return;
    const tekst = schoon(req.body.tekst, 600);
    if (!tekst) return res.status(400).json({ error: 'Schrijf de opgave.' });
    const o = { id: rid(3), tekst, at: nu(), inzendingen: {} };
    les.opgaven.push(o); save();
    stuur(les.code, 'opgave', { id: o.id, tekst: o.tekst, at: o.at }, c => c.role === 'leerling');
    res.json({ ok: true, opgave: { id: o.id, tekst: o.tekst, at: o.at } });
  });
  router.post('/opgave/inleveren', (req, res) => {
    const les = lesVan(req, res); if (!les) return;
    const l = leerlingVan(les, req, res); if (!l) return;
    const o = (les.opgaven || []).find(x => x.id === req.body.opgaveId);
    if (!o) return res.status(404).json({ error: 'Opgave niet gevonden.' });
    o.inzendingen[l.studentId] = { naam: l.naam, antwoord: schoon(req.body.antwoord, 20000), at: nu() }; save();
    stuur(les.code, 'inzending', { opgaveId: o.id, studentId: l.studentId, naam: l.naam }, c => c.role === 'docent');
    presentie(les.code); res.json({ ok: true });
  });
  router.get('/opgaven/:code', (req, res) => {
    const les = F().lessen[String(req.params.code).toUpperCase()];
    if (!les) return res.status(404).json({ error: 'Onbekende les.' });
    if (!docentCheck(les, req, res)) return;
    res.json({ opgaven: les.opgaven });
  });

  /* ---------- agenda ---------- */
  router.post('/agenda', (req, res) => {
    const les = lesVan(req, res); if (!les) return; if (!docentCheck(les, req, res)) return;
    const item = { id: rid(3), tekst: schoon(req.body.tekst, 200), datum: schoon(req.body.datum, 20), at: nu() };
    if (!item.tekst) return res.status(400).json({ error: 'Vul het agendapunt in.' });
    les.agenda.unshift(item); les.agenda = les.agenda.slice(0, 60); save();
    stuur(les.code, 'agenda', { agenda: les.agenda }, c => c.role === 'leerling');
    res.json({ ok: true, agenda: les.agenda });
  });
  router.post('/agenda/verwijder', (req, res) => {
    const les = lesVan(req, res); if (!les) return; if (!docentCheck(les, req, res)) return;
    les.agenda = (les.agenda || []).filter(a => a.id !== req.body.itemId); save();
    stuur(les.code, 'agenda', { agenda: les.agenda }, c => c.role === 'leerling');
    res.json({ ok: true, agenda: les.agenda });
  });

  /* ---------- AI-bijles (de gekozen buddy) + tips ----------
     kiesBuddy/leeftijdInstr komen uit de gezinslaag en staan op de context;
     die staan er altijd voordat de eerste aanvraag binnenkomt. */
  router.post('/ai', async (req, res) => {
    const les = lesVan(req, res); if (!les) return;
    const t = req.body.token;
    const magen = t === les.teacherToken || Object.values(les.leerlingen).some(x => x.token === t);
    if (!magen) return res.status(403).json({ error: 'Doe eerst mee met de les.' });
    const clean = (Array.isArray(req.body.messages) ? req.body.messages : [])
      .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 1500) })).slice(-10);
    while (clean.length && clean[0].role !== 'user') clean.shift();
    if (!clean.length) return res.json({ text: 'Stel je vraag maar, dan denk ik met je mee.' });
    if (!anthropic) return res.json({ text: DEMO[Math.floor(Math.random() * DEMO.length)], demo: true });
    try {
      const bb = ctx.kiesBuddy(req.body.buddy);
      const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 400, system: 'Je heet ' + bb.naam + ' en bent ' + bb.wie + '. ' + SYSTEM + ctx.leeftijdInstr(req.body.groep), messages: clean });
      res.json({ text: (r.content || []).map(b => b.text || '').join('').trim() || DEMO[0] });
    } catch (e) { res.json({ text: DEMO[Math.floor(Math.random() * DEMO.length)], demo: true }); }
  });
  router.get('/tip', (req, res) => {
    const dag = Math.floor(Date.now() / 86400000);
    res.json({ tip: TIPS[dag % TIPS.length], nog: TIPS[Math.floor(Math.random() * TIPS.length)] });
  });

  /* ---------- op reis met de foundation: aanvraag of voordracht ---------- */
  router.post('/reis/aanvraag', (req, res) => {
    const a = {
      id: rid(4),
      soort: req.body.soort === 'voordracht' ? 'voordracht' : 'aanvraag',
      naam: schoon(req.body.naam, 60),
      contact: schoon(req.body.contact, 90),
      gezin: schoon(req.body.gezin, 300),
      waarom: schoon(req.body.waarom, 1500),
      at: nu(), status: 'nieuw'
    };
    if (!a.naam || !a.contact) return res.status(400).json({ error: 'Vul je naam in en hoe we contact kunnen opnemen (telefoon of e-mail).' });
    if (!a.waarom) return res.status(400).json({ error: 'Vertel kort waarom; dat helpt de foundation echt.' });
    if (!F().reisAanvragen) F().reisAanvragen = [];
    F().reisAanvragen.unshift(a);
    F().reisAanvragen = F().reisAanvragen.slice(0, 1000);
    save();
    res.json({ ok: true });
  });
};
