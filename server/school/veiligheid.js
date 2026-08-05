/* School (deelmodule): veiligheid in en om het gebouw -- toegangspassen,
   bezoekers -- en wie er op dit moment binnen is.

   Hier zit de scherpste ontwerpkeuze van de hele enterprise-laag, en die staat
   haaks op wat de meeste toegangssystemen doen:

   ER WORDT GEEN LOOPSPOOR BEWAARD. Van elke pas onthouden we alleen de
   HUIDIGE stand (binnen of buiten, sinds wanneer, bij welke ingang) plus een
   dagteller. Geen geschiedenis per persoon, en dus ook geen endpoint dat "waar
   was Sanne vandaag" kan beantwoorden. Dat is precies dezelfde regel als bij
   RTG Stad -- meten wat je nodig hebt, geen mensen volgen. Voor het enige doel
   dat er echt toe doet (wie moet ik bij een ontruiming terugvinden) is de
   huidige stand voldoende; voor alle andere doelen is een loopspoor te veel.

   Dit bestand gaat over de DEUR: passen en bezoekers. Wat er binnen gebeurt
   (incidenten, de ontruimingslijst, de calamiteitenmelding) staat in
   school/veiligheid-incident.js, dat de twee lijsten hier via de context
   meekrijgt. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, eigenVeld, poort, log, leerlingLijst } = sctx;

  const PAS = (sch) => { if (!sch.passen) sch.passen = {}; return sch.passen; };
  const BEZ = (sch) => { if (!sch.bezoekers) sch.bezoekers = []; return sch.bezoekers; };
  const dag = () => new Date().toISOString().slice(0, 10);

  /* ---------- toegangspassen ---------- */
  router.post('/school/pas/geef', (req, res) => {
    const g = poort(req, res, 'veiligheid'); if (!g) return;
    const soort = String(req.body.soort || '');
    if (!['leerling', 'personeel', 'bezoeker'].includes(soort)) return res.status(400).json({ error: 'Een pas is voor een leerling, een personeelslid of een bezoeker.' });
    let houder = schoon(req.body.houder, 60), leerlingId = null, personeelId = null;
    if (soort === 'leerling') {
      const l = eigenVeld(leerlingLijst(g.sch), req.body.leerlingId);
      if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
      if (l.status !== 'ingeschreven') return res.status(409).json({ error: 'Een pas hoort bij een ingeschreven leerling; deze staat op ' + l.status + '.' });
      leerlingId = l.id; houder = l.naam;
    }
    if (soort === 'personeel') {
      const p = eigenVeld(g.sch.personeel || {}, req.body.personeelId);
      if (!p) return res.status(404).json({ error: 'Dit personeelslid is niet gevonden.' });
      personeelId = p.id; houder = p.naam;
    }
    if (!houder) return res.status(400).json({ error: 'Op wiens naam staat de pas?' });
    const id = rid(6);
    PAS(g.sch)[id] = { id, soort, houder, leerlingId, personeelId, status: 'actief', at: nu(),
      vestiging: schoon(req.body.vestiging, 20) || null, stand: { binnen: false, sinds: null, ingang: null } };
    log(g.sch, g.p, 'pas-uitgegeven', id, soort + ' ' + houder);
    save();
    res.json({ ok: true, pas: PAS(g.sch)[id] });
  });

  router.post('/school/pas/blokkeer', (req, res) => {
    const g = poort(req, res, 'veiligheid'); if (!g) return;
    const pas = eigenVeld(PAS(g.sch), req.body.pasId);
    if (!pas) return res.status(404).json({ error: 'Die pas kennen we niet.' });
    pas.status = req.body.aan === true ? 'actief' : 'geblokkeerd';
    pas.stand = { binnen: false, sinds: null, ingang: null };
    log(g.sch, g.p, 'pas-' + pas.status, pas.id, schoon(req.body.reden, 120) || 'stand gewijzigd');
    save();
    res.json({ ok: true, pas: { id: pas.id, status: pas.status } });
  });

  /* ---------- passeren bij een ingang ----------
     Alleen de huidige stand wordt onthouden; de vorige overschrijft. De
     dagteller telt hoeveel keer er is gepasseerd, zonder wie of wanneer. */
  router.post('/school/pas/passeer', (req, res) => {
    const g = poort(req, res, 'veiligheid'); if (!g) return;
    const pas = eigenVeld(PAS(g.sch), req.body.pasId);
    if (!pas) return res.status(404).json({ error: 'Die pas kennen we niet.' });
    if (pas.status !== 'actief') return res.status(403).json({ error: 'Deze pas is geblokkeerd.' });
    const naarBinnen = req.body.richting !== 'uit';
    pas.stand = { binnen: naarBinnen, sinds: nu(), ingang: schoon(req.body.ingang, 30) || 'hoofdingang' };
    g.sch.pasTellers = g.sch.pasTellers || {};
    const d = dag();
    g.sch.pasTellers[d] = (g.sch.pasTellers[d] || 0) + 1;
    // hooguit veertig dagen tellingen; ook een teller is data die veroudert
    for (const oud of Object.keys(g.sch.pasTellers).sort().slice(0, -40)) delete g.sch.pasTellers[oud];
    save();
    res.json({ ok: true, binnen: naarBinnen,
      uitleg: 'Alleen de huidige stand wordt bewaard; er komt geen looproute in het systeem.' });
  });

  /* ---------- bezoekers ---------- */
  router.post('/school/bezoeker/aanmeld', (req, res) => {
    const g = poort(req, res, 'bezoeker'); if (!g) return;
    const naam = schoon(req.body.naam, 60);
    if (!naam) return res.status(400).json({ error: 'Vul de naam van de bezoeker in.' });
    const b = { id: rid(5), naam, organisatie: schoon(req.body.organisatie, 60) || null,
      voor: schoon(req.body.voor, 60) || null, doel: schoon(req.body.doel, 120) || null,
      binnen: true, at: nu(), uitAt: null, door: g.p.naam, vestiging: schoon(req.body.vestiging, 20) || null };
    BEZ(g.sch).unshift(b); g.sch.bezoekers = BEZ(g.sch).slice(0, 5000);
    save();
    res.json({ ok: true, bezoeker: b });
  });
  router.post('/school/bezoeker/uit', (req, res) => {
    const g = poort(req, res, 'bezoeker'); if (!g) return;
    const b = BEZ(g.sch).find(x => x.id === String(req.body.bezoekerId || ''));
    if (!b) return res.status(404).json({ error: 'Die bezoeker staat niet geregistreerd.' });
    b.binnen = false; b.uitAt = nu();
    save();
    res.json({ ok: true, bezoeker: { id: b.id, binnen: false } });
  });

  return { passen: PAS, bezoekers: BEZ };
};
