/* RTG Werk OS (deellaag): feature flags. Hoort bij bedrijf/bouw.js.

   Een vlag is een schakelaar met een houdbaarheidsdatum. Dat tweede is het
   hele punt van deze module: vlaggen die eeuwig blijven staan zijn de stilste
   technische schuld die er is. Na een jaar durft niemand ze meer uit te zetten
   omdat niemand nog weet wat eronder zit, en elke nieuwe vlag maakt de
   combinatie onbegrijpelijker.

   Daarom:
   1. EEN VLAG ZONDER OPRUIMDATUM BESTAAT NIET. De datum is verplicht bij het
      aanmaken; hem verzetten mag, met een reden.
   2. WAT OVER DE DATUM IS, STAAT BOVENAAN met het aantal dagen erbij, en
      wordt NIET automatisch uitgezet -- een vlag uitzetten is een besluit met
      gevolgen, geen opruimactie van een automaat.
   3. DE STAND STAAT PER OMGEVING. Een vlag die overal tegelijk aan of uit
      moet, is geen vlag maar een release. */
'use strict';

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, dag, werkPoort, log, eigenVeld, OMGEVINGEN, VLAGGEN: F } = sctx;
  const dagenTot = (d) => Math.round((Date.parse(d) - Date.parse(dag())) / 86400000);

  app.post('/api/bedrijf/vlag/zet', (req, res) => {
    const g = werkPoort(req, res, 'bouw'); if (!g) return;
    const naam = schoon(req.body.naam, 60);
    if (!naam) return res.status(400).json({ error: 'Hoe heet de vlag?' });
    const bestaand = eigenVeld(F(g.w), naam);
    const opruimen = schoon(req.body.opruimen, 10) || (bestaand ? bestaand.opruimen : null);
    if (!opruimen) return res.status(400).json({
      error: 'Wanneer wordt deze vlag opgeruimd? Een vlag zonder opruimdatum blijft eeuwig staan, en na een jaar durft niemand hem nog uit te zetten.' });

    const v = bestaand || { naam, standen: {}, historie: [], at: nu(), door: g.l.naam };
    if (bestaand && bestaand.opruimen !== opruimen) {
      const reden = schoon(req.body.reden, 200);
      if (!reden) return res.status(400).json({ error: 'De opruimdatum verzetten mag, maar noteer waarom; anders schuift hij elke maand een maand op.' });
      v.historie.push({ wat: 'opruimdatum ' + bestaand.opruimen + ' -> ' + opruimen, reden, door: g.l.naam, at: nu() });
    }
    v.opruimen = opruimen;
    v.omschrijving = schoon(req.body.omschrijving, 300) || v.omschrijving || null;
    if (req.body.standen && typeof req.body.standen === 'object') {
      for (const [omg, aan] of Object.entries(req.body.standen)) {
        if (!OMGEVINGEN.includes(omg)) return res.status(400).json({ error: 'Onbekende omgeving: ' + omg + '.' });
        const was = v.standen[omg];
        v.standen[omg] = aan === true;
        if (was !== v.standen[omg]) v.historie.push({ wat: omg + ' ' + (aan ? 'aan' : 'uit'), door: g.l.naam, at: nu() });
      }
    }
    v.historie = v.historie.slice(-100);
    F(g.w)[naam] = v;
    log(g.w, g.l, 'vlag-gezet', naam, JSON.stringify(v.standen));
    save();
    res.json({ ok: true, vlag: Object.assign({}, v, { dagenTeGaan: dagenTot(v.opruimen) }) });
  });

  app.post('/api/bedrijf/vlaggen', (req, res) => {
    const g = werkPoort(req, res, 'bouw'); if (!g) return;
    const rijen = Object.values(F(g.w))
      .map(v => Object.assign({}, v, { dagenTeGaan: dagenTot(v.opruimen), over: dagenTot(v.opruimen) < 0 }))
      .sort((a, b) => a.dagenTeGaan - b.dagenTeGaan);
    res.json({ ok: true, aantal: rijen.length, over: rijen.filter(v => v.over).length,
      vlaggen: rijen, omgevingen: OMGEVINGEN,
      let: 'Wat over de opruimdatum is, staat bovenaan en wordt NIET automatisch uitgezet: een vlag uitzetten is een besluit met gevolgen, geen opruimactie van een automaat.' });
  });

  app.post('/api/bedrijf/vlag/weg', (req, res) => {
    const g = werkPoort(req, res, 'bouw'); if (!g) return;
    const naam = schoon(req.body.naam, 60);
    const v = eigenVeld(F(g.w), naam);
    if (!v) return res.status(404).json({ error: 'Die vlag kennen we niet.' });
    if (Object.values(v.standen).some(x => x === true))
      return res.status(409).json({ error: 'Deze vlag staat nog ergens aan. Zet hem eerst overal uit; een vlag weghalen die nog aanstaat, laat code achter waar niemand meer bij kan.' });
    delete F(g.w)[naam];
    log(g.w, g.l, 'vlag-opgeruimd', naam, null);
    save();
    res.json({ ok: true, opgeruimd: naam });
  });

  sctx.startBron('bouw', 'bouw', (g) => {
    const vlaggen = Object.values(F(g.w));
    return { openIssues: Object.values(sctx.ISSUES(g.w)).filter(i => i.status === 'open' || i.status === 'bezig').length,
      vlaggenOverDatum: vlaggen.filter(v => dagenTot(v.opruimen) < 0).length,
      laatsteRelease: Object.values(sctx.RELEASES(g.w)).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null };
  });
};
