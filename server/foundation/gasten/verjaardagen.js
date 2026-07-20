/* RTFoundation-gezin (deelmodule): Verjaardagen & wensen -- een verjaardagenboek
   (nooit meer een verjaardag vergeten), een wensenlijst per persoon (met een
   verrassings-slot: wie iets 'reserveert' voorkomt dubbele cadeaus, en de jarige
   ziet dat zelf niet), en een cadeaupotje per aankomende verjaardag waar het gezin
   in bijhoudt wie wat inlegt. Gedeeld per gezin (s.g), dicht voor gasten.
   Gemount vanuit foundation/gasten.js op de gedeelde context. */
module.exports = (ctx) => {
  const { router, nu, save, rid, schoon, familieVan } = ctx;

  function bak(g) {
    if (!g.verjaardagen || typeof g.verjaardagen !== 'object') g.verjaardagen = {};
    const v = g.verjaardagen;
    if (!Array.isArray(v.mensen)) v.mensen = [];
    if (!Array.isArray(v.wensen)) v.wensen = [];
    if (!v.potjes || typeof v.potjes !== 'object') v.potjes = {};
    return v;
  }
  const naamVan = (g, pid) => (pid && g.profielen[pid] ? g.profielen[pid].naam : '');
  const magBeheer = s => ['beheerder', 'ouder'].includes(s.p.rol);
  // dagen tot de eerstvolgende verjaardag (0 = vandaag), en de leeftijd die je wordt
  function komend(dag, maand, jaar) {
    const nu2 = new Date(); nu2.setHours(0, 0, 0, 0);
    let d = new Date(nu2.getFullYear(), maand - 1, dag);
    if (d < nu2) d = new Date(nu2.getFullYear() + 1, maand - 1, dag);
    const dagen = Math.round((d - nu2) / 86400000);
    const wordt = jaar ? d.getFullYear() - jaar : null;
    return { dagenTot: dagen, vandaag: dagen === 0, wordt, opDatum: d.toISOString().slice(0, 10) };
  }

  /* ---------- het verjaardagenboek ---------- */
  router.post('/gezin/verjaardag/persoon', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const naam = schoon(req.body.naam, 40);
    if (!naam) return res.status(400).json({ error: 'Van wie is de verjaardag?' });
    const dag = Math.round(Number(req.body.dag));
    const maand = Math.round(Number(req.body.maand));
    if (!(dag >= 1 && dag <= 31 && maand >= 1 && maand <= 12)) return res.status(400).json({ error: 'Kies een geldige dag en maand.' });
    const jaar = Number(req.body.jaar) >= 1900 && Number(req.body.jaar) <= new Date().getFullYear() ? Math.round(Number(req.body.jaar)) : null;
    const pid = req.body.pid && s.g.profielen[req.body.pid] ? req.body.pid : '';
    const v = bak(s.g);
    if (v.mensen.length >= 100) return res.status(400).json({ error: 'Het boek is vol.' });
    // een profiel maar een keer koppelen
    if (pid && v.mensen.some(m => m.pid === pid)) return res.status(400).json({ error: 'Dit gezinslid staat al in het boek.' });
    const m = { id: rid(3), naam, dag, maand, jaar, pid, door: s.p.id, at: nu() };
    v.mensen.push(m); save();
    res.json({ ok: true, persoon: m });
  });
  router.post('/gezin/verjaardag/persoon/verwijder', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const v = bak(s.g);
    const m = v.mensen.find(x => x.id === req.body.persoonId);
    if (!m) return res.status(404).json({ error: 'Deze persoon staat niet in het boek.' });
    if (m.door !== s.p.id && !magBeheer(s)) return res.status(403).json({ error: 'Alleen wie de persoon toevoegde of een ouder kan dit weghalen.' });
    v.mensen = v.mensen.filter(x => x.id !== req.body.persoonId);
    v.wensen = v.wensen.filter(w => w.voorId !== req.body.persoonId);
    delete v.potjes[req.body.persoonId]; save();
    res.json({ ok: true });
  });

  /* ---------- de wensenlijst ---------- */
  router.post('/gezin/verjaardag/wens', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const v = bak(s.g);
    const persoon = v.mensen.find(x => x.id === req.body.voorId);
    if (!persoon) return res.status(404).json({ error: 'Voor wie is de wens?' });
    const tekst = schoon(req.body.tekst, 100);
    if (!tekst) return res.status(400).json({ error: 'Wat is de wens?' });
    if (v.wensen.filter(w => w.voorId === persoon.id).length >= 60) return res.status(400).json({ error: 'De wensenlijst is vol.' });
    const w = { id: rid(3), voorId: persoon.id, tekst, door: s.p.id, geclaimdDoor: '', at: nu() };
    v.wensen.push(w); save();
    res.json({ ok: true, wens: w });
  });
  router.post('/gezin/verjaardag/wens/verwijder', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const v = bak(s.g);
    v.wensen = v.wensen.filter(w => w.id !== req.body.wensId); save();
    res.json({ ok: true });
  });
  router.post('/gezin/verjaardag/wens/claim', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const v = bak(s.g);
    const w = v.wensen.find(x => x.id === req.body.wensId);
    if (!w) return res.status(404).json({ error: 'Die wens staat er niet meer.' });
    const persoon = v.mensen.find(m => m.id === w.voorId);
    // je eigen wens (als de jarige aan jou gekoppeld is) kun je niet reserveren -- dat zou de verrassing verraden
    if (persoon && persoon.pid && persoon.pid === s.p.id) return res.status(403).json({ error: 'Je kunt je eigen wensen niet reserveren.' });
    if (req.body.claim === false) {
      if (w.geclaimdDoor === s.p.id) w.geclaimdDoor = '';
    } else {
      if (w.geclaimdDoor && w.geclaimdDoor !== s.p.id) return res.status(400).json({ error: 'Iemand anders heeft dit al gereserveerd.' });
      w.geclaimdDoor = s.p.id;
    }
    save();
    res.json({ ok: true });
  });

  /* ---------- het cadeaupotje (bijhouden wie wat inlegt) ---------- */
  router.post('/gezin/verjaardag/potje/bijdrage', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const v = bak(s.g);
    const persoon = v.mensen.find(x => x.id === req.body.persoonId);
    if (!persoon) return res.status(404).json({ error: 'Voor wie is het potje?' });
    const bedrag = Math.round(Number(req.body.bedrag) * 100) / 100;
    if (!(bedrag > 0 && bedrag <= 100000)) return res.status(400).json({ error: 'Vul een geldig bedrag in.' });
    if (!v.potjes[persoon.id]) v.potjes[persoon.id] = { doel: 0, bijdragen: [] };
    const pot = v.potjes[persoon.id];
    if (pot.bijdragen.length >= 200) return res.status(400).json({ error: 'Het potje heeft al veel bijdragen.' });
    pot.bijdragen.push({ id: rid(3), pid: s.p.id, bedrag, at: nu() }); save();
    res.json({ ok: true });
  });
  router.post('/gezin/verjaardag/potje/doel', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const v = bak(s.g);
    const persoon = v.mensen.find(x => x.id === req.body.persoonId);
    if (!persoon) return res.status(404).json({ error: 'Voor wie is het potje?' });
    const doel = Math.max(0, Math.min(100000, Math.round(Number(req.body.doel) || 0)));
    if (!v.potjes[persoon.id]) v.potjes[persoon.id] = { doel: 0, bijdragen: [] };
    v.potjes[persoon.id].doel = doel; save();
    res.json({ ok: true });
  });

  /* ---------- het overzicht: aankomend, wensen en potjes ---------- */
  router.get('/gezin/:code/verjaardagen', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const v = bak(s.g);
    const mensen = v.mensen.map(m => {
      const k = komend(m.dag, m.maand, m.jaar);
      const benIkDeJarige = !!(m.pid && m.pid === s.p.id);
      const wensen = v.wensen.filter(w => w.voorId === m.id).map(w => ({
        id: w.id, tekst: w.tekst, doorMij: w.door === s.p.id,
        // de jarige ziet NIET of iets gereserveerd is (verrassing bewaren)
        geclaimd: benIkDeJarige ? false : !!w.geclaimdDoor,
        doorMijGeclaimd: !benIkDeJarige && w.geclaimdDoor === s.p.id,
        claimerNaam: benIkDeJarige ? '' : (w.geclaimdDoor ? naamVan(s.g, w.geclaimdDoor) : '')
      }));
      const potBij = (v.potjes[m.id] && v.potjes[m.id].bijdragen) || [];
      const pot = benIkDeJarige ? null : {
        doel: (v.potjes[m.id] && v.potjes[m.id].doel) || 0,
        totaal: Math.round(potBij.reduce((a, b) => a + b.bedrag, 0) * 100) / 100,
        aantal: potBij.length,
        mijnInleg: Math.round(potBij.filter(b => b.pid === s.p.id).reduce((a, b) => a + b.bedrag, 0) * 100) / 100
      };
      return {
        id: m.id, naam: m.naam, dag: m.dag, maand: m.maand, jaar: m.jaar,
        dagenTot: k.dagenTot, vandaag: k.vandaag, wordt: k.wordt, opDatum: k.opDatum,
        benIkDeJarige, gekoppeld: !!m.pid, kanWeg: m.door === s.p.id || magBeheer(s),
        wensen, pot
      };
    }).sort((a, b) => a.dagenTot - b.dagenTot);
    // gezinsleden die nog niet in het boek staan, om snel toe te voegen
    const inBoek = new Set(v.mensen.map(m => m.pid).filter(Boolean));
    const koppelbaar = Object.entries(s.g.profielen)
      .filter(([id, p]) => p.rol !== 'gast' && !inBoek.has(id))
      .map(([id, p]) => ({ pid: id, naam: p.naam }));
    res.json({ mensen, koppelbaar, mijnId: s.p.id });
  });
};
