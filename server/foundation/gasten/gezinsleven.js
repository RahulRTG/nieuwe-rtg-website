/* RTFoundation-gasten (deelmodule): de klusjes-met-sterren. De gezinsagenda
   staat ernaast in gezinsagenda.js en draait op de RTG-agendamotor. Gemount
   vanuit foundation/gasten.js op de gedeelde context. */
module.exports = (ctx) => {
  const { router, save, nu, rid, schoon, familieVan, sessieVan, isGast } = ctx;
  /* klusjes en sterren: kinderen verdienen sterren met klusjes. Een ouder zet ze
     klaar en keurt ze goed; zo leren kinderen verantwoordelijkheid en groeit hun
     sterrensaldo (dat mooi aansluit op het spaarpotje). */
  function magKlus(s) { return ['beheerder', 'ouder'].includes(s.p.rol); }
  router.post('/gezin/klus', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    if (!magKlus(s)) return res.status(403).json({ error: 'Alleen een ouder of de beheerder kan klusjes klaarzetten.' });
    const titel = schoon(req.body.titel, 80);
    if (!titel) return res.status(400).json({ error: 'Wat is het klusje?' });
    const sterren = Math.max(1, Math.min(20, Math.round(Number(req.body.sterren) || 1)));
    const voor = req.body.voor && s.g.profielen[req.body.voor] ? req.body.voor : 'iedereen';
    if (!s.g.klussen) s.g.klussen = [];
    if (s.g.klussen.length >= 100) return res.status(400).json({ error: 'Er staan al veel klusjes. Rond er eerst een paar af.' });
    const k = { id: rid(3), titel, sterren, voor, status: 'open', doorPid: '', at: nu() };
    s.g.klussen.unshift(k); save();
    res.json({ ok: true, klus: k });
  });
  router.post('/gezin/klus/gedaan', (req, res) => {
    const s = sessieVan(req, res); if (!s) return;
    if (isGast(s.p)) return res.status(403).json({ error: 'Een oppas kan geen klusjes afvinken.' });
    const k = (s.g.klussen || []).find(x => x.id === req.body.klusId);
    if (!k) return res.status(404).json({ error: 'Klusje niet gevonden.' });
    if (k.voor !== 'iedereen' && k.voor !== s.p.id) return res.status(403).json({ error: 'Dit klusje is voor iemand anders.' });
    if (k.status === 'goedgekeurd') return res.status(400).json({ error: 'Dit klusje is al afgerond.' });
    k.status = 'gedaan'; k.doorPid = s.p.id; save();
    res.json({ ok: true });
  });
  router.post('/gezin/klus/keur', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    if (!magKlus(s)) return res.status(403).json({ error: 'Alleen een ouder of de beheerder kan een klusje goedkeuren.' });
    const k = (s.g.klussen || []).find(x => x.id === req.body.klusId);
    if (!k) return res.status(404).json({ error: 'Klusje niet gevonden.' });
    if (k.status !== 'gedaan') return res.status(400).json({ error: 'Dit klusje is nog niet gedaan.' });
    if (req.body.goed === false) { k.status = 'open'; k.doorPid = ''; }
    else { k.status = 'goedgekeurd'; if (!s.g.sterren) s.g.sterren = {}; s.g.sterren[k.doorPid] = (s.g.sterren[k.doorPid] || 0) + k.sterren; }
    save();
    res.json({ ok: true });
  });
  router.post('/gezin/klus/verwijder', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    if (!magKlus(s)) return res.status(403).json({ error: 'Alleen een ouder of de beheerder kan dit.' });
    s.g.klussen = (s.g.klussen || []).filter(x => x.id !== req.body.klusId); save();
    res.json({ ok: true });
  });
  router.get('/gezin/:code/klussen', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const naamVan = pid => (s.g.profielen[pid] ? s.g.profielen[pid].naam : '');
    const klussen = (s.g.klussen || []).map(k => ({ id: k.id, titel: k.titel, sterren: k.sterren, voor: k.voor, voorNaam: k.voor === 'iedereen' ? 'iedereen' : naamVan(k.voor), status: k.status, door: k.doorPid ? naamVan(k.doorPid) : '', vanMij: k.doorPid === s.p.id }));
    const sterren = Object.entries(s.g.sterren || {}).filter(([pid]) => s.g.profielen[pid])
      .map(([pid, n]) => ({ pid, naam: s.g.profielen[pid].naam, avatar: s.g.profielen[pid].avatar, kleur: s.g.profielen[pid].kleur, sterren: n }))
      .sort((a, b) => b.sterren - a.sterren);
    res.json({ klussen, sterren, magBeheren: magKlus(s), mijnId: s.p.id });
  });
  return {};
};
