/* School (deelmodule): de organisatie -- vestigingen, opleidingen/niveaus en
   de schooljaarovergang.

   Een enterprise-schoolsysteem is zelden EEN school: er zijn locaties met een
   eigen adres, een eigen huisstijl en eigen instellingen, en er zijn
   opleidingen met een capaciteit (waar de wachtlijst uit volgt).

   De schooljaarovergang -- het gevoeligste stuk van deze laag -- staat in
   ./schooljaar.js, met de reden waarom hij twee stappen kent. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, eigenVeld, poort, log, leerlingLijst } = sctx;

  const V = (sch) => { if (!sch.vestigingen) sch.vestigingen = {}; return sch.vestigingen; };
  const O = (sch) => { if (!sch.opleidingen) sch.opleidingen = {}; return sch.opleidingen; };

  /* ---------- vestigingen ----------
     Huisstijl per vestiging blijft binnen de merkregels: een accentkleur en
     een naam, geen eigen fonts en geen eigen vormtaal. Een schoolsysteem dat
     elke locatie zijn eigen thema laat bouwen, ziet er na een jaar uit als
     dertien verschillende producten. */
  router.post('/school/vestiging/zet', (req, res) => {
    const g = poort(req, res); if (!g) return;
    if (!g.directie) return res.status(403).json({ error: 'Vestigingen beheert de directie.' });
    const id = (schoon(req.body.id, 20) || rid(4)).toUpperCase();
    const naam = schoon(req.body.naam, 80);
    if (!naam) return res.status(400).json({ error: 'Geef de vestiging een naam.' });
    const kleur = schoon(req.body.accent, 7);
    if (kleur && !/^#[0-9A-Fa-f]{6}$/.test(kleur)) return res.status(400).json({ error: 'Een accentkleur is een hexwaarde, bijvoorbeeld #7F1634.' });
    V(g.sch)[id] = { id, naam, adres: schoon(req.body.adres, 120) || null, plaats: schoon(req.body.plaats, 60) || null,
      telefoon: schoon(req.body.telefoon, 24) || null, accent: kleur || null,
      instellingen: { lestijden: schoon(req.body.lestijden, 60) || null, kantine: req.body.kantine === true },
      at: (V(g.sch)[id] || {}).at || nu() };
    save();
    res.json({ ok: true, vestiging: V(g.sch)[id] });
  });

  /* ---------- opleidingen en niveaus ----------
     De capaciteit hoort hier en niet bij de klas: een wachtlijst gaat over een
     opleiding, niet over lokaal 3B. */
  router.post('/school/opleiding/zet', (req, res) => {
    const g = poort(req, res); if (!g) return;
    if (!g.directie) return res.status(403).json({ error: 'Opleidingen beheert de directie.' });
    const id = schoon(req.body.id, 40) || rid(4);
    const naam = schoon(req.body.naam, 80);
    if (!naam) return res.status(400).json({ error: 'Geef de opleiding een naam.' });
    const plaatsen = req.body.plaatsen == null ? null : Math.max(0, Math.min(5000, Number(req.body.plaatsen) || 0));
    O(g.sch)[id] = { id, naam, niveau: schoon(req.body.niveau, 40) || null, duur: schoon(req.body.duur, 20) || null,
      vestiging: schoon(req.body.vestiging, 20) || null, plaatsen, at: (O(g.sch)[id] || {}).at || nu() };
    save();
    res.json({ ok: true, opleiding: O(g.sch)[id] });
  });

  /* ---------- het organisatiebeeld ----------
     Een aanroep die het scherm alles geeft: vestigingen, opleidingen met
     bezetting en wachtlijst, en de klassen per vestiging. */
  router.post('/school/organisatie', (req, res) => {
    const g = poort(req, res); if (!g) return;
    const alle = Object.values(leerlingLijst(g.sch));
    const opleidingen = Object.values(O(g.sch)).map(o => {
      const bezet = alle.filter(l => l.opleiding === o.id && l.status === 'ingeschreven').length;
      const wacht = alle.filter(l => l.opleiding === o.id && l.status === 'wachtlijst').length;
      return Object.assign({}, o, { bezet, wachtlijst: wacht,
        vol: o.plaatsen ? bezet >= o.plaatsen : false, vrij: o.plaatsen ? Math.max(0, o.plaatsen - bezet) : null });
    });
    const klassen = Object.values(K()).filter(k => k.schoolCode === g.sch.code);
    res.json({ ok: true, school: { code: g.sch.code, naam: g.sch.naam, plaats: g.sch.plaats },
      vestigingen: Object.values(V(g.sch)).map(v => Object.assign({}, v, {
        leerlingen: alle.filter(l => l.vestiging === v.id && l.status === 'ingeschreven').length,
        klassen: klassen.filter(k => k.vestiging === v.id).length })),
      opleidingen,
      klassen: klassen.map(k => ({ code: k.code, naam: k.naam, vestiging: k.vestiging || null, leerlingen: (k.leerlingen || []).length })),
      leerlingen: { ingeschreven: alle.filter(l => l.status === 'ingeschreven').length,
        aanmeldingen: alle.filter(l => l.status === 'aanmelding').length,
        wachtlijst: alle.filter(l => l.status === 'wachtlijst').length } });
  });

  // een klas aan een vestiging hangen (de klas zelf blijft van de leraar)
  router.post('/school/klas/vestiging', (req, res) => {
    const g = poort(req, res); if (!g) return;
    if (!g.directie) return res.status(403).json({ error: 'De indeling van klassen over vestigingen doet de directie.' });
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k || k.schoolCode !== g.sch.code) return res.status(404).json({ error: 'Die klas hoort niet bij deze school.' });
    const v = eigenVeld(V(g.sch), String(req.body.vestiging || '').toUpperCase());
    if (!v) return res.status(404).json({ error: 'Die vestiging kennen we niet.' });
    k.vestiging = v.id;
    save();
    res.json({ ok: true, klas: k.code, vestiging: v.id });
  });

  /* De schooljaarovergang staat in ./schooljaar.js. Hij hoort bij deze laag
     maar is een eigen onderwerp met een eigen regel: eerst een voorstel dat je
     kunt lezen en corrigeren, dan een uitvoering die alleen op precies dat
     voorstel loopt. Zie de kop daar. */
  require('./schooljaar')(sctx);
};
