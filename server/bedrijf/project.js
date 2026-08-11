/* RTG Werk OS (deellaag): projecten, taken, sprints en voortgang.

   Een projectmodule staat of valt bij wat hij WEIGERT. Vier dingen staan
   daarom in de code en niet in een handleiding:

   1. GEEN ZELFGEMELD PERCENTAGE. Voortgang wordt geteld uit taken die af zijn,
      niet uit een invulveld. "90% klaar" is de bekendste leugen in
      projectland, en een systeem dat er een veld voor heeft, vraagt erom.
   2. EEN AFHANKELIJKHEID DIE EEN CIRKEL MAAKT WORDT GEWEIGERD. Twee taken die
      op elkaar wachten leggen een plan stil zonder dat iemand ziet waarom.
   3. EEN TAAK GAAT NIET AF ZOLANG HIJ OP IETS WACHT. Anders is een
      afhankelijkheid een aantekening in plaats van een afspraak.
   4. EEN BUDGETOVERSCHRIJDING WORDT GEMELD, NIET GEBLOKKEERD. Het werk
      stilzetten omdat een teller vol is, kost meer dan het bespaart -- maar
      niemand mag kunnen zeggen dat hij het niet wist.

   De werkvormen (software, stadsuitrol, horeca- en schoolimplementatie,
   juridisch traject, campagne, expansie) zijn een LABEL en geen apart proces:
   zeven processen naast elkaar is zeven keer onderhoud, en de verschillen
   zitten in de taken en niet in de machinerie. */
'use strict';

const WERKVORMEN = ['software', 'stadsuitrol', 'horeca-implementatie', 'school-implementatie',
  'juridisch', 'campagne', 'expansie', 'algemeen'];
const KOLOMMEN = ['te doen', 'bezig', 'review', 'klaar'];
const PRIORITEITEN = ['laag', 'normaal', 'hoog', 'kritiek'];

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, dag, werkPoort, log, eigenVeld } = sctx;

  const P = (w) => { if (!w.projecten) w.projecten = {}; return w.projecten; };
  const T = (w) => { if (!w.taken) w.taken = {}; return w.taken; };
  const takenVan = (w, id) => Object.values(T(w)).filter(t => t.projectId === id);
  const centen = (x) => Math.round(Math.max(0, Math.min(100000000, Number(x) || 0)) * 100);

  function voortgang(w, p) {
    const t = takenVan(w, p.id);
    const klaar = t.filter(x => x.kolom === 'klaar');
    const teLaat = t.filter(x => x.kolom !== 'klaar' && x.deadline && x.deadline < dag());
    const uren = t.reduce((n, x) => n + (x.uren || 0), 0);
    const kosten = Math.round(uren * (p.uurtariefCenten || 0));
    return {
      taken: t.length, klaar: klaar.length, teLaat: teLaat.length,
      perKolom: KOLOMMEN.reduce((o, k) => Object.assign(o, { [k]: t.filter(x => x.kolom === k).length }), {}),
      urenGeschreven: Math.round(uren * 10) / 10, kostenCenten: kosten,
      budgetCenten: p.budgetCenten || 0,
      overBudget: p.budgetCenten ? Math.max(0, kosten - p.budgetCenten) : 0,
      deel: t.length ? Math.round(klaar.length / t.length * 100) : null,
      let: t.length
        ? 'Het percentage is GETELD uit taken die af zijn; er is geen veld waarin iemand zijn eigen voortgang invult.'
        : 'Nog geen taken, dus geen voortgang. Nul procent van niets is geen nul procent.'
    };
  }

  /* ---------- projecten ---------- */
  app.post('/api/bedrijf/project/maak', (req, res) => {
    const g = werkPoort(req, res, 'project'); if (!g) return;
    const naam = schoon(req.body.naam, 80);
    if (!naam) return res.status(400).json({ error: 'Hoe heet dit project?' });
    const werkvorm = String(req.body.werkvorm || 'algemeen');
    if (!WERKVORMEN.includes(werkvorm)) return res.status(400).json({ error: 'Kies een werkvorm: ' + WERKVORMEN.join(', ') + '.' });
    const p = { id: rid(5), naam, werkvorm, status: 'loopt',
      omschrijving: schoon(req.body.omschrijving, 500) || null,
      start: schoon(req.body.start, 10) || dag(), eind: schoon(req.body.eind, 10) || null,
      budgetCenten: req.body.budget != null ? centen(req.body.budget) : 0,
      uurtariefCenten: req.body.uurtarief != null ? centen(req.body.uurtarief) : 0,
      mijlpalen: [], risicos: [], at: nu(), door: g.l.naam };
    // naam blijft vrij, id komt ernaast als hij onbedubbelzinnig is
    const eig = sctx.zetWie(g.w, p, 'eigenaar', schoon(req.body.eigenaar, 60) || g.l.naam);
    P(g.w)[p.id] = p;
    log(g.w, g.l, 'project-gemaakt', p.id, naam);
    save();
    res.json({ ok: true, project: p, eigenaarLet: eig.reden });
  });

  app.post('/api/bedrijf/project/mijlpaal', (req, res) => {
    const g = werkPoort(req, res, 'project'); if (!g) return;
    const p = eigenVeld(P(g.w), String(req.body.projectId || ''));
    if (!p) return res.status(404).json({ error: 'Dat project kennen we niet.' });
    const naam = schoon(req.body.naam, 80);
    const datum = schoon(req.body.datum, 10);
    if (!naam || !datum) return res.status(400).json({ error: 'Een mijlpaal heeft een naam en een datum.' });
    p.mijlpalen.push({ id: rid(3), naam, datum, gehaald: false, at: nu() });
    p.mijlpalen = p.mijlpalen.slice(-50);
    save();
    res.json({ ok: true, mijlpalen: p.mijlpalen });
  });

  app.post('/api/bedrijf/project/risico', (req, res) => {
    const g = werkPoort(req, res, 'project'); if (!g) return;
    const p = eigenVeld(P(g.w), String(req.body.projectId || ''));
    if (!p) return res.status(404).json({ error: 'Dat project kennen we niet.' });
    const wat = schoon(req.body.wat, 200);
    const maatregel = schoon(req.body.maatregel, 200);
    if (!wat) return res.status(400).json({ error: 'Welk risico?' });
    if (!maatregel) return res.status(400).json({ error: 'Wat doen we eraan? Een risico zonder maatregel is een zorg, geen risico dat je beheerst.' });
    p.risicos.unshift({ id: rid(3), wat, maatregel, kans: schoon(req.body.kans, 10) || 'middel',
      eigenaar: schoon(req.body.eigenaar, 60) || g.l.naam, at: nu() });
    p.risicos = p.risicos.slice(0, 100);
    save();
    res.json({ ok: true, risicos: p.risicos });
  });

  app.post('/api/bedrijf/project', (req, res) => {
    const g = werkPoort(req, res, 'project'); if (!g) return;
    const id = String(req.body.projectId || '');
    if (id) {
      const p = eigenVeld(P(g.w), id);
      if (!p) return res.status(404).json({ error: 'Dat project kennen we niet.' });
      return res.json({ ok: true, project: p, voortgang: voortgang(g.w, p),
        taken: takenVan(g.w, p.id).sort((a, b) => String(a.deadline || '~').localeCompare(String(b.deadline || '~'))) });
    }
    const rijen = Object.values(P(g.w))
      .filter(p => !req.body.werkvorm || p.werkvorm === String(req.body.werkvorm))
      .map(p => Object.assign({ id: p.id, naam: p.naam, werkvorm: p.werkvorm, status: p.status,
        eigenaar: p.eigenaar, eind: p.eind }, { voortgang: voortgang(g.w, p) }));
    res.json({ ok: true, aantal: rijen.length, projecten: rijen, werkvormen: WERKVORMEN });
  });

  /* Onder eigen namen naar de gedeelde context. Kort exporteren als P en T
     botste met de tickets van de servicedesk, en dan hangt het van de
     mountvolgorde af welke van de twee je krijgt -- precies het soort
     verborgen draad waar dit huis eerder op is gestruikeld. */
  return { WERKVORMEN, KOLOMMEN, PRIORITEITEN, voortgang, PROJECTEN: P, TAKEN: T, takenVan };
};
