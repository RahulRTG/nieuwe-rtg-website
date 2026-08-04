/* RTG Werk OS (deellaag): de taken zelf -- kanban, subtaken, afhankelijkheden
   en geschreven uren. Hoort bij bedrijf/project.js, dat de projecten, de
   mijlpalen, de risico's en de voortgangstelling draagt.

   De twee weigeringen die deze module maken:

   1. EEN CIRKEL IN DE AFHANKELIJKHEDEN WORDT GEWEIGERD, ook via een omweg van
      drie taken. Twee taken die op elkaar wachten leggen een plan stil zonder
      dat iemand ziet waarom -- en dat merk je pas als de deadline er is.
   2. EEN TAAK GAAT NIET AF zolang hij wacht op iets dat niet af is, of zolang
      er subtaken openstaan. Anders is een afhankelijkheid een aantekening in
      plaats van een afspraak, en betekent "klaar" niets meer.

   Uren worden GESCHREVEN en niet geschat: elke regel draagt een naam en een
   datum. Loopt een project daarmee over zijn budget, dan zegt het antwoord dat
   -- er wordt niets geblokkeerd, want werk stilzetten omdat een teller vol is
   kost meer dan het bespaart. */
'use strict';

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, dag, werkPoort, eigenVeld, KOLOMMEN, PRIORITEITEN, voortgang, P, T } = sctx;

  app.post('/api/bedrijf/taak/maak', (req, res) => {
    const g = werkPoort(req, res, 'project'); if (!g) return;
    const titel = schoon(req.body.titel, 120);
    if (!titel) return res.status(400).json({ error: 'Wat moet er gebeuren?' });
    const projectId = String(req.body.projectId || '');
    if (projectId && !eigenVeld(P(g.w), projectId)) return res.status(404).json({ error: 'Dat project kennen we niet.' });
    const ouder = String(req.body.ouderId || '');
    if (ouder && !eigenVeld(T(g.w), ouder)) return res.status(404).json({ error: 'Die hoofdtaak kennen we niet.' });
    const prioriteit = String(req.body.prioriteit || 'normaal');
    if (!PRIORITEITEN.includes(prioriteit)) return res.status(400).json({ error: 'Kies een prioriteit: ' + PRIORITEITEN.join(', ') + '.' });
    const t = { id: rid(5), titel, projectId: projectId || null, ouderId: ouder || null,
      omschrijving: schoon(req.body.omschrijving, 1000) || null,
      wie: schoon(req.body.wie, 60) || null, deadline: schoon(req.body.deadline, 10) || null,
      prioriteit, kolom: 'te doen', wachtOp: [], uren: 0, sprint: null, at: nu(), door: g.l.naam };
    T(g.w)[t.id] = t;
    save();
    res.json({ ok: true, taak: t });
  });

  /* Afhankelijkheden. Een cirkel wordt geweigerd: twee taken die op elkaar
     wachten leggen een plan stil zonder dat iemand ziet waarom. */
  app.post('/api/bedrijf/taak/wacht-op', (req, res) => {
    const g = werkPoort(req, res, 'project'); if (!g) return;
    const t = eigenVeld(T(g.w), String(req.body.taakId || ''));
    const op = eigenVeld(T(g.w), String(req.body.wachtOpId || ''));
    if (!t || !op) return res.status(404).json({ error: 'Die taak kennen we niet.' });
    if (t.id === op.id) return res.status(400).json({ error: 'Een taak kan niet op zichzelf wachten.' });
    const bezocht = new Set();
    const leidtNaar = (van, doel) => {
      if (van === doel) return true;
      if (bezocht.has(van)) return false;
      bezocht.add(van);
      const x = eigenVeld(T(g.w), van);
      return (x ? x.wachtOp : []).some(y => leidtNaar(y, doel));
    };
    if (leidtNaar(op.id, t.id))
      return res.status(409).json({ error: 'Dat maakt een cirkel: ' + op.titel + ' wacht (via een omweg) al op ' + t.titel + '.' });
    if (!t.wachtOp.includes(op.id)) t.wachtOp.push(op.id);
    save();
    res.json({ ok: true, taak: { id: t.id, titel: t.titel, wachtOp: t.wachtOp } });
  });

  app.post('/api/bedrijf/taak/kolom', (req, res) => {
    const g = werkPoort(req, res, 'project'); if (!g) return;
    const t = eigenVeld(T(g.w), String(req.body.taakId || ''));
    if (!t) return res.status(404).json({ error: 'Die taak kennen we niet.' });
    const kolom = String(req.body.kolom || '');
    if (!KOLOMMEN.includes(kolom)) return res.status(400).json({ error: 'Kies een kolom: ' + KOLOMMEN.join(', ') + '.' });
    if (kolom === 'klaar') {
      const open = (t.wachtOp || []).map(id => eigenVeld(T(g.w), id)).filter(x => x && x.kolom !== 'klaar');
      if (open.length) return res.status(409).json({
        error: 'Deze taak wacht nog op: ' + open.map(x => x.titel).join(', ') + '.',
        wachtOp: open.map(x => ({ id: x.id, titel: x.titel, kolom: x.kolom }) ) });
      const kinderen = Object.values(T(g.w)).filter(x => x.ouderId === t.id && x.kolom !== 'klaar');
      if (kinderen.length) return res.status(409).json({
        error: 'Er staan nog ' + kinderen.length + ' subtaak/subtaken open onder deze taak.' });
    }
    t.kolom = kolom;
    if (kolom === 'klaar') { t.klaarAt = nu(); t.klaarDoor = g.l.naam; } else { t.klaarAt = null; }
    save();
    res.json({ ok: true, taak: { id: t.id, titel: t.titel, kolom: t.kolom, klaarAt: t.klaarAt || null } });
  });

  app.post('/api/bedrijf/taak/uren', (req, res) => {
    const g = werkPoort(req, res, 'project'); if (!g) return;
    const t = eigenVeld(T(g.w), String(req.body.taakId || ''));
    if (!t) return res.status(404).json({ error: 'Die taak kennen we niet.' });
    const uren = Math.max(0, Math.min(24, Number(req.body.uren) || 0));
    if (!uren) return res.status(400).json({ error: 'Hoeveel uur is eraan gewerkt?' });
    t.urenlijst = (t.urenlijst || []).concat([{ uren, wie: g.l.naam, datum: schoon(req.body.datum, 10) || dag(), at: nu() }]).slice(-500);
    t.uren = Math.round(t.urenlijst.reduce((n, x) => n + x.uren, 0) * 10) / 10;
    save();
    const p = t.projectId ? eigenVeld(P(g.w), t.projectId) : null;
    const v = p ? voortgang(g.w, p) : null;
    res.json({ ok: true, taak: { id: t.id, uren: t.uren }, project: v,
      let: v && v.overBudget ? 'Let op: dit project staat ' + (v.overBudget / 100).toFixed(2) + ' boven budget. Er wordt niets geblokkeerd; het werk stilzetten kost meer dan het bespaart, maar niemand kan zeggen dat hij het niet wist.' : null });
  });

  app.post('/api/bedrijf/taken', (req, res) => {
    const g = werkPoort(req, res, 'project'); if (!g) return;
    const rijen = Object.values(T(g.w))
      .filter(t => !req.body.projectId || t.projectId === String(req.body.projectId))
      .filter(t => !req.body.wie || t.wie === String(req.body.wie))
      .filter(t => !req.body.kolom || t.kolom === String(req.body.kolom))
      .map(t => Object.assign({}, t, {
        geblokkeerd: (t.wachtOp || []).some(id => (eigenVeld(T(g.w), id) || {}).kolom !== 'klaar'),
        teLaat: !!(t.kolom !== 'klaar' && t.deadline && t.deadline < dag()) }));
    res.json({ ok: true, aantal: rijen.length, kolommen: KOLOMMEN, taken: rijen.slice(0, 500) });
  });

  // de twee blokken voor het startscherm; alleen voor wie het recht heeft
  sctx.startBron('taken', 'project', (g) => {
    const mijn = Object.values(T(g.w)).filter(t => t.wie === g.l.naam && t.kolom !== 'klaar');
    return { aantal: mijn.length, teLaat: mijn.filter(t => t.deadline && t.deadline < dag()).length,
      taken: mijn.slice(0, 10).map(t => ({ id: t.id, titel: t.titel, deadline: t.deadline, prioriteit: t.prioriteit })) };
  });
  sctx.startBron('projecten', 'project', (g) => {
    const rijen = Object.values(P(g.w)).filter(p => p.status === 'loopt');
    return { aantal: rijen.length,
      projecten: rijen.slice(0, 8).map(p => ({ id: p.id, naam: p.naam, voortgang: voortgang(g.w, p).deel })) };
  });

  return {};
};
