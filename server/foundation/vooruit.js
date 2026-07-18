/* RTFoundation-vooruit: samen vooruit met spaardoelen en het dromenbord.
   Alles hangt aan het gezin en is gedeeld, zodat het gezin het samen beleeft
   en elkaar aanmoedigt. Gemount vanuit foundation.js op de gedeelde context. */
module.exports = (ctx) => {
  const { router, save, nu, rid, schoon, familieVan } = ctx;
  const getal = (v, max = 1e7) => { let n = Number(v); if (!isFinite(n)) n = 0; n = Math.round(n * 100) / 100; return Math.max(-max, Math.min(max, n)); };

  /* spaardoelen: het gezin spaart samen naar iets moois */
  router.post('/gezin/spaardoel/maak', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const naam = schoon(req.body.naam, 60);
    const doel = getal(req.body.doel);
    if (!naam) return res.status(400).json({ error: 'Geef je spaardoel een naam.' });
    if (doel <= 0) return res.status(400).json({ error: 'Vul een bedrag in om naartoe te sparen.' });
    if (!s.g.spaardoelen) s.g.spaardoelen = [];
    if (s.g.spaardoelen.length >= 30) return res.status(400).json({ error: 'Je hebt al veel doelen. Rond er eerst een af.' });
    const d = { id: rid(3), naam, doel, nu: 0, klaar: false, door: s.p.id, bijdragen: [], at: nu() };
    s.g.spaardoelen.unshift(d); save();
    res.json({ ok: true, doel: d });
  });
  router.post('/gezin/spaardoel/bijdrage', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const d = (s.g.spaardoelen || []).find(x => x.id === req.body.doelId);
    if (!d) return res.status(404).json({ error: 'Dit spaardoel bestaat niet meer.' });
    const bedrag = getal(req.body.bedrag);
    if (!bedrag) return res.status(400).json({ error: 'Vul een bedrag in.' });
    d.nu = Math.max(0, Math.round((d.nu + bedrag) * 100) / 100);
    d.bijdragen.unshift({ van: s.p.id, vanNaam: s.p.naam, bedrag, at: nu() });
    d.bijdragen = d.bijdragen.slice(0, 100);
    const netKlaar = !d.klaar && d.nu >= d.doel;
    d.klaar = d.nu >= d.doel;
    save();
    res.json({ ok: true, doel: d, gevierd: netKlaar });
  });
  router.post('/gezin/spaardoel/verwijder', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    if (s.p.rol !== 'beheerder') return res.status(403).json({ error: 'Alleen de beheerder kan een spaardoel verwijderen.' });
    s.g.spaardoelen = (s.g.spaardoelen || []).filter(x => x.id !== req.body.doelId); save();
    res.json({ ok: true });
  });
  router.get('/gezin/:code/spaardoelen', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    res.json({ spaardoelen: (s.g.spaardoelen || []) });
  });

  /* dromenbord: ieder een doel of droom, en we moedigen elkaar aan */
  router.post('/gezin/droom/maak', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const tekst = schoon(req.body.tekst, 240);
    if (!tekst) return res.status(400).json({ error: 'Schrijf je droom of doel op.' });
    if (!s.g.dromen) s.g.dromen = [];
    if (s.g.dromen.length >= 200) s.g.dromen = s.g.dromen.slice(0, 199);
    const d = { id: rid(3), van: s.p.id, vanNaam: s.p.naam, vanAvatar: s.p.avatar, kleur: s.p.kleur, tekst, aanmoedigingen: [], behaald: false, at: nu() };
    s.g.dromen.unshift(d); save();
    res.json({ ok: true, droom: d });
  });
  router.post('/gezin/droom/moedig', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const d = (s.g.dromen || []).find(x => x.id === req.body.droomId);
    if (!d) return res.status(404).json({ error: 'Deze droom bestaat niet meer.' });
    d.aanmoedigingen = d.aanmoedigingen || [];
    const i = d.aanmoedigingen.indexOf(s.p.id);
    if (i >= 0) d.aanmoedigingen.splice(i, 1); else d.aanmoedigingen.push(s.p.id);
    save();
    res.json({ ok: true, aantal: d.aanmoedigingen.length, aangemoedigd: i < 0 });
  });
  router.post('/gezin/droom/behaald', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const d = (s.g.dromen || []).find(x => x.id === req.body.droomId);
    if (!d) return res.status(404).json({ error: 'Deze droom bestaat niet meer.' });
    if (d.van !== s.p.id && s.p.rol !== 'beheerder') return res.status(403).json({ error: 'Alleen wie de droom heeft, of de beheerder, kan dit afvinken.' });
    d.behaald = req.body.behaald === false ? false : true;
    d.behaaldAt = d.behaald ? nu() : null;
    save();
    res.json({ ok: true, droom: d });
  });
  router.post('/gezin/droom/verwijder', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const d = (s.g.dromen || []).find(x => x.id === req.body.droomId);
    if (!d) return res.status(404).json({ error: 'Deze droom bestaat niet meer.' });
    if (d.van !== s.p.id && s.p.rol !== 'beheerder') return res.status(403).json({ error: 'Alleen wie de droom heeft, of de beheerder, kan hem weghalen.' });
    s.g.dromen = s.g.dromen.filter(x => x.id !== req.body.droomId); save();
    res.json({ ok: true });
  });
  router.get('/gezin/:code/dromen', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    res.json({ dromen: (s.g.dromen || []).map(d => ({ id: d.id, van: d.van, vanNaam: d.vanNaam, vanAvatar: d.vanAvatar, kleur: d.kleur, tekst: d.tekst, aantal: (d.aanmoedigingen || []).length, aangemoedigd: (d.aanmoedigingen || []).includes(s.p.id), vanMij: d.van === s.p.id, behaald: !!d.behaald, at: d.at })) });
  });
};
