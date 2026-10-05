/* Onderwijs (deelmodule): de les: maken en meedoen op lescode, de live
   SSE-stream met presentie en het digitale schoolbord (strokes, wissen,
   undo). Krijgt de gedeelde context een keer bij het opstarten vanuit
   foundation/onderwijs.js. */
module.exports = (octx) => {
  const { router, F, save, nu, rid, schoon, teVaak, misluktePoging, goedePoging, ipVan,
    toegang, ruimOudeLessen, rolVanVerzoek, sse, stuur, presentie, lesVan, sleutelInAdres, docentCheck, lesPubliek } = octx;

  /* ---------- les maken / meedoen ---------- */
  /* EEN REM OP HET MAKEN, en niet alleen op het raden. `lesVan()` begrenst wie
     een BESTAANDE les binnenkomt; deze route maakt er een NIEUWE, zonder inlog en
     zonder bovengrens op `F().lessen`. Onbegrensd is dat een emmer die vanzelf
     volloopt: elke les blijft staan, wordt bij elke opslag meegeschreven, en
     niemand ruimt hem op.

     TWINTIG PER UUR PER ADRES, en dat getal komt weer uit de gebruiker. Een les
     maakt een BEGELEIDER, geen klas -- maar een school zit met al haar docenten
     achter een adres, en op een maandagochtend beginnen die tegelijk. Twintig
     laat dat ruim door en houdt een aanvaller op ongeveer 480 lessen per dag,
     tegen een handvol per school. Twee takken zetten hier los van elkaar een rem
     (twintig en dertig); de strengste is gehouden, en test/foundation-lesrem.test.js
     legt hem vast. De gelijknamige route van de lesmaker (server/routes/lesmaker.js)
     heeft een eigen teller en dekt deze niet.

     ANDERS DAN BIJ HET RADEN telt hier de GESLAAGDE poging, want die is het
     probleem: er komt een les bij. Vandaar `misluktePoging` zonder een misser --
     de functie heet naar zijn eerste gebruik en telt gewoon een tik. Zie
     `/gezin/maak` in ../gezin.js, waar precies hetzelfde staat met acht. */
  /* DE CODES STAAN KAAL ALLEEN IN DIT ANTWOORD (lib/eenmalig-geheim-routes.js):
     `lescode` voor de klas en `token` voor de begeleider. Een herhaling met
     dezelfde `idem` maakt geen tweede les en toont niets opnieuw (409). */
  router.post('/les/maak', async (req, res) => {
    const bak = 'lesmaak:' + ipVan(req);
    if (teVaak(res, bak)) return;
    misluktePoging(bak, 20, 60);
    const uit = await toegang.nieuweLes({ idem: typeof req.body.idem === 'string' ? req.body.idem : null });
    if (!uit.ok) return res.status(uit.status).json({ error: uit.error, herhaald: uit.herhaald || undefined });
    if (ruimOudeLessen()) save();
    const les = { id: uit.lesId, v: 2, vak: schoon(req.body.vak, 40) || 'Les', docentNaam: schoon(req.body.naam, 40) || 'Begeleider',
      bord: { strokes: [] }, leerlingen: {}, opgaven: [], agenda: [], at: nu() };
    F().lessen[les.id] = les; save();
    res.set('Cache-Control', 'no-store');
    res.json({ lesId: les.id, lescode: uit.lescode, token: uit.token, verloopt: uit.expires_at, les: lesPubliek(les) });
  });
  /* MEEDOEN IS DE CLAIM: de lescode telt een toetreding in de collectie-
     transactie en levert een eigen leerlingsleutel. De naam is alleen voor de
     begeleider; de sleutel draagt hem niet. Een naam die al meedoet krijgt 409 en
     nooit de sleutel van die ander -- zo kon je vroeger iemands schrift openen. */
  router.post('/les/join', async (req, res) => {
    const bak = 'lescode:' + ipVan(req);
    if (teVaak(res, bak)) return;
    const naam = schoon(req.body.naam, 40);
    if (!naam) return res.status(400).json({ error: 'Vul je naam in.' });
    const bezet = lesId => {
      const les = F().lessen[lesId];
      if (!les) return 'Deze les is afgelopen.';
      return Object.values(les.leerlingen).some(x => !x.ingetrokken_at && x.naam.toLowerCase() === naam.toLowerCase())
        ? 'Er doet al iemand mee met deze naam. Kies een andere naam, of vraag je begeleider om je oude toegang in te trekken.' : null;
    };
    const uit = await toegang.claim(req.body.lescode, bezet);
    if (!uit.ok) {
      if (uit.status === 404) misluktePoging(bak, 20, 10);
      return res.status(uit.status).json({ error: uit.error });
    }
    goedePoging(bak);
    const les = F().lessen[uit.lesId];
    const l = { studentId: uit.studentId, naam, schrift: { pages: [] }, at: nu() };
    les.leerlingen[l.studentId] = l; ruimOudeLessen(); save();
    res.set('Cache-Control', 'no-store');
    res.json({ token: uit.token, studentId: l.studentId, naam: l.naam, lesId: les.id, les: lesPubliek(les), bord: les.bord.strokes, schrift: l.schrift });
    presentie(les.id);
  });
  /* VIA lesVan() EN NIET RECHTSTREEKS, hoe verleidelijk kort dat ook staat: de
     rem op het raden van een lescode woont daar, en dit is juist de LEESkant
     waar raden loont. Wie hier weer `F().lessen[...]` schrijft, zet de rem uit
     voor precies de routes die de leerlingnamen tonen. */
  router.get('/les/:code', (req, res) => {
    const les = lesVan(req, res); if (!les) return;
    res.json({ les: lesPubliek(les) });
  });

  /* ---------- live meekijken (B25) ----------
     EventSource kan geen koppen sturen, en de sleutel mag niet in het adres.
     Dus eerst een stroomticket: POST met de sleutel in de kop, en het ticket
     (128 bits, dertig seconden, eenmalig, aan deze les en rol gebonden; zie
     ./stroomticket.js) is het enige dat in het adres van de stroom staat. Het
     ticket draagt de rol, dus `?role=` beslist niets meer; een afwijkende rol
     weigert alleen. Het kale ticket staat precies een keer in een antwoord
     (lib/eenmalig-geheim-routes.js). */
  router.post('/les/stroomticket', async (req, res) => {
    const les = lesVan(req, res); if (!les) return;
    const uit = await toegang.stroomticket(les.id, rolVanVerzoek(req).sleutel);
    res.set('Cache-Control', 'no-store');
    if (!uit.ok) return res.status(uit.status).json({ error: uit.error });
    res.json({ ticket: uit.ticket, rol: uit.rol, verloopt: uit.verloopt });
  });
  /* Ook de stroom loopt langs de rem op het raden (dezelfde bak als lesVan). */
  router.get('/les/:code/stream', async (req, res) => {
    if (sleutelInAdres(req, res)) return;
    const bak = 'lescode:' + ipVan(req);
    if (teVaak(res, bak)) return;
    const w = Object.prototype.hasOwnProperty.call(F().lessen, String(req.params.code || ''))
      ? await toegang.claimStroom(req.params.code, req.query.ticket) : { status: 404, error: 'Deze les kennen we niet.' };
    if (!w.ok) { misluktePoging(bak, 20, 10); return res.status(w.status).json({ error: w.error }); }
    goedePoging(bak);
    const les = F().lessen[w.lesId]; if (!les) return res.status(404).end();
    const role = w.rol === 'leraar' ? 'docent' : 'leerling';
    if (req.query.role && req.query.role !== role) return res.status(403).end();
    const studentId = w.studentId;
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    const client = { res, role, studentId };
    let set = sse.get(les.id); if (!set) { set = new Set(); sse.set(les.id, set); }
    set.add(client);
    presentie(les.id);
    const hart = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 25000);
    req.on('close', () => { clearInterval(hart); set.delete(client); presentie(les.id); });
  });

  /* ---------- het bord ---------- */
  router.post('/bord/stroke', (req, res) => {
    const les = lesVan(req, res); if (!les) return;
    if (!docentCheck(les, req, res)) return;
    const s = req.body.stroke;
    if (!s || !Array.isArray(s.points)) return res.status(400).json({ error: 'Geen geldige streek.' });
    const stroke = { id: rid(3),
      tool: ['pen', 'marker', 'gum'].includes(s.tool) ? s.tool : 'pen',
      kleur: /^#[0-9a-fA-F]{6}$/.test(s.kleur || '') ? s.kleur : '#ffffff',
      dikte: Math.min(60, Math.max(1, Number(s.dikte) || 3)),
      points: s.points.slice(0, 1500).map(p => [Math.round(Number(p[0]) || 0), Math.round(Number(p[1]) || 0)]) };
    les.bord.strokes.push(stroke);
    if (les.bord.strokes.length > 8000) les.bord.strokes.splice(0, les.bord.strokes.length - 8000);
    save();
    stuur(les.id, 'stroke', stroke, c => c.role === 'leerling');
    res.json({ ok: true, id: stroke.id });
  });
  router.post('/bord/wis', (req, res) => {
    const les = lesVan(req, res); if (!les) return; if (!docentCheck(les, req, res)) return;
    les.bord.strokes = []; save(); stuur(les.id, 'wis', {}, c => c.role === 'leerling'); res.json({ ok: true });
  });
  router.post('/bord/undo', (req, res) => {
    const les = lesVan(req, res); if (!les) return; if (!docentCheck(les, req, res)) return;
    les.bord.strokes.pop(); save(); stuur(les.id, 'bord', { strokes: les.bord.strokes }, c => c.role === 'leerling'); res.json({ ok: true });
  });
  router.get('/bord/:code', (req, res) => {
    const les = lesVan(req, res); if (!les) return;
    res.json({ strokes: les.bord.strokes });
  });
};
