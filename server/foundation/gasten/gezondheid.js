/* RTFoundation-gezin (deelmodule): het Gezondheidsmaatje -- per gezinslid de
   medicijnen (met een afvink-per-dag zodat je weet of het al gegeven is), de
   medische afspraken (tandarts, huisarts) die eraan komen, een simpele groeicurve
   (gewicht/lengte in de tijd), en de allergiekaart die uit het bestaande
   zorgprofiel (oppasinfo) komt. Medische vrije tekst ligt versleuteld op schijf
   (encS/decS), net als de rest van de zorgdata. Gedeeld per gezin, dicht voor
   gasten. Gemount vanuit foundation/gasten.js op de gedeelde context. */
module.exports = (ctx) => {
  const { router, nu, save, rid, schoon, familieVan, encS, decS } = ctx;

  const vandaagStr = () => new Date().toISOString().slice(0, 10);
  const isDatum = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const isGast = p => p.rol === 'gast';

  function bak(g, pid) {
    if (!g.gezondheid || typeof g.gezondheid !== 'object') g.gezondheid = {};
    if (!g.gezondheid[pid] || typeof g.gezondheid[pid] !== 'object') g.gezondheid[pid] = { medicijnen: [], afspraken: [], metingen: [] };
    const h = g.gezondheid[pid];
    if (!Array.isArray(h.medicijnen)) h.medicijnen = [];
    if (!Array.isArray(h.afspraken)) h.afspraken = [];
    if (!Array.isArray(h.metingen)) h.metingen = [];
    return h;
  }
  // het doel-profiel: standaard jezelf; iedereen in het gezin mag elkaar helpen
  function doelVan(s, req, res) {
    const pid = req.body.voor && s.g.profielen[req.body.voor] ? req.body.voor : s.p.id;
    if (isGast(s.g.profielen[pid])) { res.status(400).json({ error: 'Een gast heeft geen gezondheidskaart.' }); return null; }
    return pid;
  }

  /* ---------- medicijnen ---------- */
  router.post('/gezin/gezondheid/medicijn', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const pid = doelVan(s, req, res); if (!pid) return;
    const naam = schoon(req.body.naam, 80);
    if (!naam) return res.status(400).json({ error: 'Welk medicijn?' });
    const h = bak(s.g, pid);
    if (h.medicijnen.length >= 40) return res.status(400).json({ error: 'De medicijnlijst is vol.' });
    h.medicijnen.push({ id: rid(3), naam: encS(naam), dosis: encS(schoon(req.body.dosis, 60)), tijd: schoon(req.body.tijd, 24), gegeven: null, door: s.p.id, at: nu() });
    save();
    res.json({ ok: true });
  });
  router.post('/gezin/gezondheid/medicijn/verwijder', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const pid = doelVan(s, req, res); if (!pid) return;
    const h = bak(s.g, pid);
    h.medicijnen = h.medicijnen.filter(m => m.id !== req.body.medId); save();
    res.json({ ok: true });
  });
  router.post('/gezin/gezondheid/medicijn/gegeven', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const pid = doelVan(s, req, res); if (!pid) return;
    const h = bak(s.g, pid);
    const m = h.medicijnen.find(x => x.id === req.body.medId);
    if (!m) return res.status(404).json({ error: 'Dit medicijn staat er niet meer.' });
    m.gegeven = req.body.gegeven === false ? null : { datum: vandaagStr(), door: s.p.id, at: nu() };
    save();
    res.json({ ok: true });
  });

  /* ---------- medische afspraken ---------- */
  router.post('/gezin/gezondheid/afspraak', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const pid = doelVan(s, req, res); if (!pid) return;
    const wat = schoon(req.body.wat, 80);
    if (!wat) return res.status(400).json({ error: 'Wat voor afspraak?' });
    if (!isDatum(req.body.datum)) return res.status(400).json({ error: 'Kies een datum.' });
    const tijd = /^\d{2}:\d{2}$/.test(req.body.tijd || '') ? req.body.tijd : '';
    const h = bak(s.g, pid);
    if (h.afspraken.length >= 60) return res.status(400).json({ error: 'Er staan al veel afspraken.' });
    h.afspraken.push({ id: rid(3), wat: encS(wat), datum: req.body.datum, tijd, waar: encS(schoon(req.body.waar, 80)), door: s.p.id, at: nu() });
    save();
    res.json({ ok: true });
  });
  router.post('/gezin/gezondheid/afspraak/verwijder', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const pid = doelVan(s, req, res); if (!pid) return;
    const h = bak(s.g, pid);
    h.afspraken = h.afspraken.filter(a => a.id !== req.body.afspraakId); save();
    res.json({ ok: true });
  });

  /* ---------- groeicurve (gewicht/lengte in de tijd) ---------- */
  router.post('/gezin/gezondheid/meting', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const pid = doelVan(s, req, res); if (!pid) return;
    const gewicht = Number(req.body.gewicht) > 0 && Number(req.body.gewicht) <= 400 ? Math.round(Number(req.body.gewicht) * 10) / 10 : null;
    const lengte = Number(req.body.lengte) > 0 && Number(req.body.lengte) <= 260 ? Math.round(Number(req.body.lengte) * 10) / 10 : null;
    if (gewicht == null && lengte == null) return res.status(400).json({ error: 'Vul een gewicht of lengte in.' });
    const datum = isDatum(req.body.datum) ? req.body.datum : vandaagStr();
    const h = bak(s.g, pid);
    if (h.metingen.length >= 300) h.metingen.shift();
    h.metingen.push({ id: rid(3), datum, gewicht, lengte, door: s.p.id, at: nu() });
    h.metingen.sort((a, b) => a.datum.localeCompare(b.datum));
    save();
    res.json({ ok: true });
  });
  router.post('/gezin/gezondheid/meting/verwijder', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const pid = doelVan(s, req, res); if (!pid) return;
    const h = bak(s.g, pid);
    h.metingen = h.metingen.filter(m => m.id !== req.body.metingId); save();
    res.json({ ok: true });
  });

  /* ---------- het overzicht ---------- */
  router.get('/gezin/:code/gezondheid', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const vandaag = vandaagStr();
    const laatste = (arr, veld) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i][veld] != null) return arr[i]; return null; };
    const personen = Object.entries(s.g.profielen)
      .filter(([, p]) => p.rol !== 'gast')
      .map(([pid, p]) => {
        const h = bak(s.g, pid);
        const medicijnen = h.medicijnen.map(m => ({
          id: m.id, naam: decS(m.naam), dosis: decS(m.dosis) || '', tijd: m.tijd || '',
          gegevenVandaag: !!(m.gegeven && m.gegeven.datum === vandaag)
        }));
        const afspraken = h.afspraken
          .map(a => ({ id: a.id, wat: decS(a.wat), datum: a.datum, tijd: a.tijd || '', waar: decS(a.waar) || '', voorbij: a.datum < vandaag,
            dagenTot: Math.round((new Date(a.datum + 'T12:00') - new Date(vandaag + 'T12:00')) / 86400000) }))
          .sort((a, b) => (a.datum + (a.tijd || '99:99')).localeCompare(b.datum + (b.tijd || '99:99')));
        const metingen = h.metingen.map(m => ({ id: m.id, datum: m.datum, gewicht: m.gewicht, lengte: m.lengte }));
        const laatsteGewicht = laatste(metingen, 'gewicht');
        const laatsteLengte = laatste(metingen, 'lengte');
        return {
          pid, naam: p.naam, avatar: p.avatar, kleur: p.kleur,
          medicijnen, teGeven: medicijnen.filter(m => !m.gegevenVandaag).length,
          afspraken, volgende: afspraken.find(a => !a.voorbij) || null,
          metingen,
          laatsteGewicht: laatsteGewicht ? { datum: laatsteGewicht.datum, gewicht: laatsteGewicht.gewicht } : null,
          laatsteLengte: laatsteLengte ? { datum: laatsteLengte.datum, lengte: laatsteLengte.lengte } : null
        };
      });
    // de allergiekaart komt uit het zorgprofiel (oppasinfo), gedeeld voor het gezin
    const o = s.g.oppasinfo || {};
    const allergie = decS(o.allergie) || '';
    res.json({ personen, allergie, mijnId: s.p.id, magZorgprofiel: ['beheerder', 'ouder'].includes(s.p.rol) });
  });
};
