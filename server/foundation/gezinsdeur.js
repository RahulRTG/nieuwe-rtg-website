/* DE DEUREN VAN DE GEZINSDEUR (B18 en B19; CODECREDENTIALS.json
   foundation.family_profile_access). De credentials zelf wonen in
   ./gezinscode.js, ./gezinstoken.js en ./gezinsstroom.js; hier staan alleen de
   routes waarmee een mens ze beheert.

   - /gezin/code/roteer: de BEHEERDER maakt een nieuwe gezinscode. Die staat een
     keer in dit antwoord; de vorige opent daarna niets meer. Zo krijgt een gezin
     van voor B18 (zes tekens) ook zijn eerste echte gezinscode -- er wordt niets
     stil omgezet.
   - /gezin/code/intrek: de beheerder trekt de gezinscode in zonder een nieuwe.
     Lopende sessies blijven; binnenkomen kan pas weer na een nieuwe code.
   - /gezin/stroom/ticket: een eenmalig ticket van een minuut voor een live-kanaal
     (EventSource kan geen header sturen; de sessie gaat zo nooit in een URL).
   - /gezin/sessie/verleng (B19): wie binnen de zeven dagen met zijn PASSKEY
     bevestigt, krijgt een nieuwe sessie van zeven dagen. Zonder passkey aan het
     profiel: 409, en na de termijn opnieuw inloggen. Nooit langer dan zeven
     dagen per stap, en nooit voor een gast (zijn kanaal blijft 12 uur). De
     passkey hoort bij een RTG-account en wordt aan het profiel gehangen met
     /api/rtf/gezin/passkey (routes/member/gezin.js); /gezin/passkey/weg haalt
     hem eraf.
   De verleng-ceremonie draait op de zware poort (kern/zwaarbewijs.js, actie
   `gezin-sessie-verleng`, zonder terugval) en is gebonden aan de gezinssessie in
   de Authorization-header; zonder header weigert hij. */
'use strict';

module.exports = (ctx) => {
  const { router, save, gezinVan, beheerderVan, tokenUit, gezinstoken, gezinscode, gezinsstroom } = ctx;
  const OPNIEUW = 'Log opnieuw in bij je gezin.';
  const ACTIE = 'gezin-sessie-verleng';
  const geenCache = res => res.set('Cache-Control', 'no-store');
  const kopToken = req => { const h = (req.get && req.get('authorization')) || ''; return h.startsWith('Bearer ') ? h.slice(7) : ''; };

  router.post('/gezin/code/roteer', async (req, res) => {
    const g = gezinVan(req, res); if (!g) return;
    const b = beheerderVan(g, req, res); if (!b) return;
    let raw;
    try { raw = await gezinscode.geef(g, b.id); } catch (e) { return res.status(503).json({ error: 'De gezinscode kon nu niet worden vastgelegd. Probeer het zo opnieuw.' }); }
    geenCache(res);
    res.json({ ok: true, gezinscode: raw, status: gezinscode.publiek(g.code),
      let: 'Deze code staat alleen hier. Bewaar hem; de vorige gezinscode opent niets meer.' });
  });

  // alleen de stand (nooit de code of de hash), voor de beheerder
  router.get('/gezin/:code/gezinscode', (req, res) => {
    const g = gezinVan(req, res); if (!g) return;
    if (!beheerderVan(g, req, res)) return;
    res.json({ status: gezinscode.publiek(g.code) });
  });

  router.post('/gezin/code/intrek', async (req, res) => {
    const g = gezinVan(req, res); if (!g) return;
    const b = beheerderVan(g, req, res); if (!b) return;
    let had;
    try { had = await gezinscode.intrek(g.code, 'profiel:' + b.id); } catch (e) { return res.status(503).json({ error: 'Intrekken lukte nu niet. Probeer het zo opnieuw.' }); }
    res.json({ ok: true, ingetrokken: had ? 1 : 0, status: gezinscode.publiek(g.code) });
  });

  router.post('/gezin/stroom/ticket', async (req, res) => {
    const g = gezinVan(req, res); if (!g) return;
    let t;
    try { t = await gezinsstroom.geef(g, tokenUit(req), String((req.body && req.body.kanaal) || '')); }
    catch (e) { return res.status(503).json({ error: 'Het live-kanaal is nu niet bereikbaar.' }); }
    if (!t) return res.status(403).json({ error: OPNIEUW });
    geenCache(res);
    res.json(t);
  });

  router.post('/gezin/passkey/weg', (req, res) => {
    const g = gezinVan(req, res); if (!g) return;
    const h = gezinstoken.zoek(g, tokenUit(req));
    if (!h) return res.status(403).json({ error: OPNIEUW });
    const had = !!h.p.passkey; delete h.p.passkey; if (had) save();
    res.json({ ok: true, ontkoppeld: had ? 1 : 0 });
  });

  router.post('/gezin/sessie/verleng', async (req, res) => {
    const g = gezinVan(req, res); if (!g) return;
    const raw = kopToken(req);
    if (!raw) return res.status(400).json({ error: 'Stuur je gezinssessie in de Authorization-header.' });
    const h = gezinstoken.zoek(g, raw);
    if (!h) return res.status(403).json({ error: OPNIEUW });
    if (h.p.rol === 'gast') return res.status(403).json({ error: 'Het kanaal van een oppas of familielid blijft 12 uur; je RTG-app vraagt zelf een nieuw.' });
    let bron = null;
    try { bron = typeof ctx.passkeyVan === 'function' ? ctx.passkeyVan() : null; } catch (e) { bron = null; }
    if (!bron || !bron.zwaar || !bron.accounts)
      return res.status(503).json({ error: 'De passkeycontrole is op deze server niet ingericht. Log na zeven dagen opnieuw in met de gezinscode en je pincode.' });
    let user = null;
    try { user = h.p.passkey && h.p.passkey.userId != null ? bron.accounts.getUserById(h.p.passkey.userId) : null; } catch (e) { user = null; }
    if (!user) return res.status(409).json({ watNu: 'opnieuw-inloggen',
      error: 'Aan dit profiel hangt geen passkey. Na zeven dagen log je opnieuw in met de gezinscode en je pincode.' });
    const { zwaar } = bron, sleutel = zwaar.sessieSleutel(req);
    const r = await zwaar.eis(user, 'gezin-sessie-verleng', sleutel, req, 'Het verlengen van je gezinssessie', { zonderTerugval: true });
    if (r.ok && r.bewezen === true) {
      const token = gezinstoken.roteer(g, raw, { verleng: true });
      if (!token) return res.status(403).json({ error: OPNIEUW });
      save(); geenCache(res);
      return res.json({ ok: true, token, geldigDagen: gezinstoken.GELDIG_MS / 86400000 });
    }
    if (r.ok) return res.status(403).json({ watNu: 'passkey-zetten', error: 'Verlengen kan alleen met een passkey.' });
    if (r.bevestigingNodig) {
      const o = await zwaar.opties(user, ACTIE, sleutel, req);
      if (!o || o.error) return res.status((o && o.status) || 400).json({ error: (o && o.error) || 'De passkey kon niet worden gevraagd.' });
      return res.status(401).json({ bevestigingNodig: true, actie: ACTIE, error: r.error,
        bevestiging: { ceremonie: o.ceremonie, opties: o.opties } });
    }
    return zwaar.stuur(res, r);
  });
};
