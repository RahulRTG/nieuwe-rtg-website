/* RTFoundation-gezin (deelmodule): de Gezinskeuken -- het weekmenu (wat eten we,
   wie kookt) en de gedeelde boodschappenlijst waar iedereen realtime op afvinkt.
   Gedeeld per gezin (s.g), dicht voor gasten (oppas/familie): dit zijn de eigen
   huishoud-zaken. Gemount vanuit foundation/gasten.js op de gedeelde context. */
module.exports = (ctx) => {
  const { router, nu, save, rid, schoon, familieVan } = ctx;

  // Een vaste, uitlegbare lijst simpele gezinsmaaltijden voor de "verras me"-knop
  // -- bewust geen AI nodig, werkt altijd, ook zonder sleutel.
  const IDEEEN = [
    'Pasta pesto met kip', 'Stamppot boerenkool met worst', 'Wraps met kip en groente',
    'Nasi met ei en komkommer', 'Tomatensoep met broodjes', 'Andijviestamppot',
    'Macaroni met kaas en ham', 'Groentecurry met rijst', 'Pannenkoeken',
    'Vissticks met puree en doperwten', 'Chili sin carne met rijst', 'Omelet met brood',
    'Poké bowl', 'Spaghetti bolognese', 'Couscous met geroosterde groenten',
    'Hutspot met draadjesvlees', 'Sperziebonen met aardappel en ei', 'Linzensoep',
    'Quiche met salade', 'Roerbak met noedels', 'Ovenschotel met aardappel',
    'Wortelstamppot', 'Bloemkool met puree en gehaktbal', 'Broodje gezond met soep'
  ];

  function bak(g) {
    if (!g.keuken || typeof g.keuken !== 'object') g.keuken = {};
    if (!g.keuken.menu || typeof g.keuken.menu !== 'object') g.keuken.menu = {};
    if (!Array.isArray(g.keuken.lijst)) g.keuken.lijst = [];
    return g.keuken;
  }
  const isDatum = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const naamVan = (g, pid) => (pid && g.profielen[pid] ? g.profielen[pid].naam : '');

  /* ---------- het weekmenu ---------- */
  router.post('/gezin/keuken/menu', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    if (!isDatum(req.body.datum)) return res.status(400).json({ error: 'Kies een dag.' });
    const gerecht = schoon(req.body.gerecht, 80);
    if (!gerecht) return res.status(400).json({ error: 'Wat eten we die dag?' });
    const kok = req.body.kok && s.g.profielen[req.body.kok] ? req.body.kok : '';
    const k = bak(s.g);
    k.menu[req.body.datum] = { gerecht, kok, door: s.p.id, at: nu() };
    save();
    res.json({ ok: true });
  });
  router.post('/gezin/keuken/menu/wis', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const k = bak(s.g);
    delete k.menu[req.body.datum]; save();
    res.json({ ok: true });
  });
  router.post('/gezin/keuken/idee', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const k = bak(s.g);
    const opMenu = new Set(Object.values(k.menu).map(m => m.gerecht));
    const vrij = IDEEEN.filter(i => !opMenu.has(i));
    const bron = vrij.length ? vrij : IDEEEN;
    res.json({ ok: true, idee: bron[Math.floor(Math.random() * bron.length)] });
  });

  /* ---------- de gedeelde boodschappenlijst ---------- */
  router.post('/gezin/keuken/lijst', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const wat = schoon(req.body.wat, 60);
    if (!wat) return res.status(400).json({ error: 'Wat moet er op de lijst?' });
    const k = bak(s.g);
    if (k.lijst.length >= 150) return res.status(400).json({ error: 'De lijst is vol. Ruim eerst wat afgevinkte spullen op.' });
    if (!k.lijst.some(x => !x.af && x.wat.toLowerCase() === wat.toLowerCase())) {
      k.lijst.push({ id: rid(3), wat, af: false, doorPid: s.p.id, at: nu() });
      save();
    }
    res.json({ ok: true });
  });
  router.post('/gezin/keuken/lijst/af', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const k = bak(s.g);
    const it = k.lijst.find(x => x.id === req.body.itemId);
    if (!it) return res.status(404).json({ error: 'Dit staat niet meer op de lijst.' });
    it.af = req.body.af === true; it.doorPid = s.p.id; save();
    res.json({ ok: true });
  });
  router.post('/gezin/keuken/lijst/verwijder', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const k = bak(s.g);
    k.lijst = k.lijst.filter(x => x.id !== req.body.itemId); save();
    res.json({ ok: true });
  });
  router.post('/gezin/keuken/lijst/opruim', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const k = bak(s.g);
    k.lijst = k.lijst.filter(x => !x.af); save();
    res.json({ ok: true });
  });

  /* ---------- het overzicht: zeven dagen vooruit + de lijst ---------- */
  router.get('/gezin/:code/keuken', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const k = bak(s.g);
    const dagNaam = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
    const dagen = [];
    const start = new Date(); start.setHours(12, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const datum = d.toISOString().slice(0, 10);
      const m = k.menu[datum] || null;
      dagen.push({
        datum, dag: dagNaam[d.getDay()], nr: d.getDate(), vandaag: i === 0,
        gerecht: m ? m.gerecht : '', kok: m ? m.kok : '', kokNaam: m ? naamVan(s.g, m.kok) : ''
      });
    }
    const lijst = k.lijst
      .map(x => ({ id: x.id, wat: x.wat, af: !!x.af, door: naamVan(s.g, x.doorPid) }))
      .sort((a, b) => (a.af === b.af ? 0 : a.af ? 1 : -1));
    const koks = Object.entries(s.g.profielen).filter(([, p]) => p.rol !== 'gast')
      .map(([id, p]) => ({ id, naam: p.naam }));
    res.json({ dagen, lijst, koks, mijnId: s.p.id });
  });
};
