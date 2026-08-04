/* School (deelmodule): verlof -- de aanvraag van het gezin en het besluit van
   de school. Hoort bij school/aanwezigheid.js (de presentielijst), dat de
   verlofreeks via de context meegeeft.

   VERLOF BESLIST EEN MENS. Een aanvraag komt binnen, de school antwoordt met
   een besluit EN een reden -- er is geen automatische toekenning, ook niet voor
   "korte" aanvragen, want dan wordt de drempel de regel. Het gezin ziet die
   reden terug; een afwijzing zonder uitleg is bij leerplicht het begin van een
   conflict dat niemand wil. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, S, eigenVeld, poort, log, gezinSessie,
    leerlingSleutel, verlofLijst: VL } = sctx;

  /* ---------- verlof aanvragen (het gezin) ---------- */
  router.post('/school/verlof/aanvraag', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k) return res.status(404).json({ error: 'Die klas kennen we niet.' });
    // de school komt uit de klas en niet uit het verzoek: een gezin hoort geen
    // schoolcode te hoeven weten, en zo kan het er ook geen andere kiezen
    const sch = eigenVeld(S(), k.schoolCode || '');
    if (!sch) return res.status(404).json({ error: 'Deze klas hangt nog niet aan een school.' });
    const profielId = String(req.body.profielId || s.p.id);
    const sleutel = leerlingSleutel(s.g.code, profielId);
    if (!(k.leerlingen || []).some(l => l.sleutel === sleutel)) return res.status(403).json({ error: 'Dit kind zit niet in die klas.' });
    const van = schoon(req.body.van, 10), tot = schoon(req.body.tot, 10) || schoon(req.body.van, 10);
    const reden = schoon(req.body.reden, 300);
    if (!van || !reden) return res.status(400).json({ error: 'Geef de datum en de reden van het verlof.' });
    const v = { id: rid(5), klasCode: k.code, sleutel, naam: ((k.leerlingen || []).find(l => l.sleutel === sleutel) || {}).naam || null,
      van, tot, reden, soort: schoon(req.body.soort, 30) || 'bijzonder verlof',
      aanvrager: schoon(s.p.naam, 60), status: 'ingediend', at: nu() };
    VL(sch).unshift(v); sch.verlof = VL(sch).slice(0, 5000);
    save();
    res.json({ ok: true, verlof: { id: v.id, status: v.status, van: v.van, tot: v.tot },
      uitleg: 'De aanvraag staat bij de school. Een mens beslist erover; u krijgt het besluit met de reden erbij.' });
  });

  // het gezin ziet zijn eigen aanvragen terug, met besluit en reden
  router.post('/school/verlof/mijn', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const uit = [];
    for (const sch of Object.values(S())) for (const v of VL(sch)) {
      if (!v.sleutel.startsWith(s.g.code + ':')) continue;
      uit.push({ id: v.id, naam: v.naam, van: v.van, tot: v.tot, reden: v.reden, soort: v.soort,
        status: v.status, besluitReden: v.besluitReden || null, besluitAt: v.besluitAt || null, school: sch.naam });
    }
    res.json({ ok: true, aanvragen: uit.sort((a, b) => String(b.van).localeCompare(String(a.van))).slice(0, 50) });
  });

  /* ---------- de school beslist ----------
     Toekennen of afwijzen, altijd met een reden. Een afwijzing zonder reden is
     bij leerplicht het begin van een conflict dat niemand wil. */
  router.post('/school/verlof/besluit', (req, res) => {
    const g = poort(req, res, 'aanwezigheid'); if (!g) return;
    const v = VL(g.sch).find(x => x.id === String(req.body.verlofId || ''));
    if (!v) return res.status(404).json({ error: 'Die aanvraag kennen we niet.' });
    const besluit = String(req.body.besluit || '');
    if (!['toegekend', 'afgewezen'].includes(besluit)) return res.status(400).json({ error: 'Kies toegekend of afgewezen.' });
    const reden = schoon(req.body.reden, 300);
    if (!reden) return res.status(400).json({ error: 'Noteer de reden van het besluit; het gezin ziet die.' });
    v.status = besluit; v.besluitReden = reden; v.besluitDoor = g.p.naam; v.besluitAt = nu();
    log(g.sch, g.p, 'verlofbesluit', v.id, besluit + ': ' + reden);
    save();
    res.json({ ok: true, verlof: { id: v.id, status: v.status } });
  });

  // de openstaande en afgehandelde aanvragen voor de school
  router.post('/school/verlof/lijst', (req, res) => {
    const g = poort(req, res, 'aanwezigheid'); if (!g) return;
    const status = schoon(req.body.status, 20);
    const rijen = VL(g.sch).filter(v => !status || v.status === status).slice(0, 200);
    res.json({ ok: true, open: VL(g.sch).filter(v => v.status === 'ingediend').length, aanvragen: rijen });
  });
};
