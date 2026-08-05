/* School (deelmodule): aanwezigheid -- de presentielijst per les en het
   verzuimbeeld. Verlof (aanvraag en besluit) staat in school/verlof.js, dat de
   reeks hieronder via de context meekrijgt.

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
  const { router, save, rid, nu, schoon, K, eigenVeld, poort, meld, leerlingLijst } = sctx;

  const STANDEN = ['aanwezig', 'telaat', 'afwezig', 'ziek', 'verlof'];
  const P = (sch) => { if (!sch.presentie) sch.presentie = []; return sch.presentie; };
  const VL = (sch) => { if (!sch.verlof) sch.verlof = []; return sch.verlof; };
  sctx.verlofLijst = VL;
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
    meld(g.sch, 'aanwezigheid.gezet', { klasCode: les.klasCode, datum: les.datum, uur: les.uur, regels: les.regels.length });
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

  return { verlofLijst: VL };
};
