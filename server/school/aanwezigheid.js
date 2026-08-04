/* School (deelmodule): aanwezigheid en verlof.

   De presentielijst is het gevoeligste gewone ding in een schoolsysteem: hij
   wordt elke les gezet, hij gaat over kinderen, en hij wordt later gebruikt om
   conclusies te trekken. Drie regels houden dat eerlijk:

   1. EEN REGISTRATIE IS EEN WAARNEMING, GEEN OORDEEL. De standen zijn feitelijk
      (aanwezig, te laat, afwezig, ziek, verlof) en er hoort een correctie bij:
      wie zich vergist, zet het recht en dat is zichtbaar. Verzuim uit een
      typefout is een van de vervelendste fouten die een school kan maken.
   2. VERLOF BESLIST EEN MENS. Een aanvraag komt binnen, de school antwoordt met
      een besluit EN een reden. Er is geen automatische toekenning; ook niet
      voor "korte" aanvragen, want dan wordt de drempel de regel.
   3. HET GEZIN ZIET WAT ER OVER HEM STAAT. Dezelfde registratie die de school
      gebruikt, is voor de ouder opvraagbaar -- inclusief wie hem zette. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, S, eigenVeld, poort, log, gezinSessie, leerlingLijst, leerlingSleutel } = sctx;

  const STANDEN = ['aanwezig', 'telaat', 'afwezig', 'ziek', 'verlof'];
  const P = (sch) => { if (!sch.presentie) sch.presentie = []; return sch.presentie; };
  const VL = (sch) => { if (!sch.verlof) sch.verlof = []; return sch.verlof; };
  const dag = () => new Date().toISOString().slice(0, 10);
  sctx.presentieLijst = P;

  /* ---------- de presentielijst van een les ---------- */
  router.post('/school/aanwezigheid/zet', (req, res) => {
    const g = poort(req, res, 'aanwezigheid'); if (!g) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k || k.schoolCode !== g.sch.code) return res.status(404).json({ error: 'Die klas hoort niet bij deze school.' });
    const regels = (Array.isArray(req.body.regels) ? req.body.regels : []).slice(0, 200)
      .map(r => ({ leerling: String((r && r.leerling) || ''), stand: String((r && r.stand) || 'aanwezig'),
        minuten: Math.max(0, Math.min(240, Number(r && r.minuten) || 0)), opmerking: schoon(r && r.opmerking, 120) || null }))
      .filter(r => r.leerling);
    if (!regels.length) return res.status(400).json({ error: 'Geef per leerling een stand door.' });
    const mis = regels.filter(r => !STANDEN.includes(r.stand));
    if (mis.length) return res.status(400).json({ error: 'Onbekende stand: ' + mis[0].stand + '. Kies uit ' + STANDEN.join(', ') + '.' });
    const onbekend = regels.filter(r => !(k.leerlingen || []).some(l => l.sleutel === r.leerling));
    if (onbekend.length) return res.status(400).json({ error: 'Deze leerling zit niet in de klas: ' + onbekend[0].leerling });
    const naamVan = (s) => ((k.leerlingen || []).find(x => x.sleutel === s) || {}).naam || s;
    const les = { id: rid(5), klasCode: k.code, datum: schoon(req.body.datum, 10) || dag(),
      uur: Math.max(1, Math.min(12, Number(req.body.uur) || 1)), vak: schoon(req.body.vak, 40) || null,
      door: g.p.naam, at: nu(), regels: regels.map(r => Object.assign({ naam: naamVan(r.leerling) }, r)) };
    // dezelfde les twee keer zetten overschrijft; anders telt verzuim dubbel
    const eerder = P(g.sch).findIndex(x => x.klasCode === les.klasCode && x.datum === les.datum && x.uur === les.uur);
    if (eerder >= 0) { les.correctieVan = P(g.sch)[eerder].id; P(g.sch).splice(eerder, 1); }
    P(g.sch).unshift(les);
    g.sch.presentie = P(g.sch).slice(0, 20000);
    save();
    res.json({ ok: true, les: { id: les.id, datum: les.datum, uur: les.uur, gecorrigeerd: !!les.correctieVan },
      telling: STANDEN.reduce((o, s) => Object.assign(o, { [s]: les.regels.filter(r => r.stand === s).length }), {}) });
  });

  /* ---------- het beeld per klas ----------
     Een periode, per leerling geteld. Bewust GEEN ranglijst: de lijst staat op
     naam en niet op "meeste verzuim eerst", want dat is precies het scherm
     waarop een kind een dossier wordt. */
  router.post('/school/aanwezigheid/klas', (req, res) => {
    const g = poort(req, res, 'aanwezigheid'); if (!g) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k || k.schoolCode !== g.sch.code) return res.status(404).json({ error: 'Die klas hoort niet bij deze school.' });
    const van = schoon(req.body.van, 10) || '0000-00-00', tot = schoon(req.body.tot, 10) || '9999-99-99';
    const lessen = P(g.sch).filter(l => l.klasCode === k.code && l.datum >= van && l.datum <= tot);
    const per = {};
    for (const l of lessen) for (const r of l.regels) {
      const rij = per[r.leerling] || (per[r.leerling] = { leerling: r.leerling, naam: r.naam, lessen: 0, telaat: 0, minutenTeLaat: 0, afwezig: 0, ziek: 0, verlof: 0 });
      rij.lessen++;
      if (r.stand === 'telaat') { rij.telaat++; rij.minutenTeLaat += r.minuten; }
      if (r.stand === 'afwezig') rij.afwezig++;
      if (r.stand === 'ziek') rij.ziek++;
      if (r.stand === 'verlof') rij.verlof++;
    }
    res.json({ ok: true, klas: k.naam, lessen: lessen.length,
      leerlingen: Object.values(per).sort((a, b) => String(a.naam).localeCompare(String(b.naam))),
      laatste: lessen.slice(0, 10).map(l => ({ id: l.id, datum: l.datum, uur: l.uur, vak: l.vak, door: l.door })) });
  });

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

  /* ---------- verzuimbeeld voor een leerling ----------
     Voor de mentor en het gezin dezelfde cijfers uit dezelfde bron. */
  router.post('/school/aanwezigheid/leerling', (req, res) => {
    const g = poort(req, res, 'aanwezigheid'); if (!g) return;
    const l = eigenVeld(leerlingLijst(g.sch), req.body.leerlingId);
    const sleutel = l ? (l.sleutel || 'L:' + l.id) : String(req.body.sleutel || '');
    if (!sleutel) return res.status(404).json({ error: 'Geef een leerling op.' });
    const regels = [];
    for (const les of P(g.sch)) for (const r of les.regels) if (r.leerling === sleutel)
      regels.push({ datum: les.datum, uur: les.uur, vak: les.vak, stand: r.stand, minuten: r.minuten, door: les.door, opmerking: r.opmerking });
    const tel = STANDEN.reduce((o, s) => Object.assign(o, { [s]: regels.filter(r => r.stand === s).length }), {});
    res.json({ ok: true, sleutel, naam: l ? l.naam : (regels[0] || {}).naam || null, telling: tel,
      lessen: regels.length, regels: regels.slice(0, 200) });
  });
};
