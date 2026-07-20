/* RTFoundation-gezin (deelmodule): het Ochtendritme -- een persoonlijk
   ochtend-lijstje (tanden poetsen, aankleden, ontbijt, tas inpakken...) dat elke
   ochtend weer op nul staat. Wie alles afvinkt houdt een rustige reeks bij: geen
   druk, geen tellertjes die je opjagen, gewoon een schouderklopje voor een goed
   begonnen dag. Gedeeld per gezin (s.g), dicht voor gasten. Een kind beheert zijn
   eigen ritme; een ouder mag het ritme van een kind mee klaarzetten.
   Gemount vanuit foundation/gasten.js op de gedeelde context. */
module.exports = (ctx) => {
  const { router, nu, save, rid, schoon, familieVan } = ctx;

  // Een paar kant-en-klare stappen om mee te beginnen -- de app is meteen nuttig.
  const VOORBEELDEN = [
    'Tanden poetsen', 'Aankleden', 'Ontbijten', 'Haren doen', 'Bed opmaken',
    'Tas inpakken', 'Drinkbeker vullen', 'Jas en schoenen klaar', 'Medicijn innemen',
    'Even bewegen', 'Agenda checken', 'Ochtendgroet aan het gezin'
  ];
  const vandaagStr = () => new Date().toISOString().slice(0, 10);
  const gisterenStr = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  function bak(g) {
    if (!g.ochtend || typeof g.ochtend !== 'object') g.ochtend = {};
    return g.ochtend;
  }
  // haal (of maak) het ritme-object voor een profiel, met de dag-reset ingebouwd
  function persoon(g, pid) {
    const o = bak(g);
    if (!o[pid] || typeof o[pid] !== 'object') o[pid] = { stappen: [], dag: '', done: [], reeks: 0, laatste: '', record: 0 };
    const p = o[pid];
    if (!Array.isArray(p.stappen)) p.stappen = [];
    if (p.dag !== vandaagStr()) { p.dag = vandaagStr(); p.done = []; }   // nieuwe ochtend: schoon lijstje
    return p;
  }
  const naamVan = (g, pid) => (pid && g.profielen[pid] ? g.profielen[pid].naam : '');
  const isGastPid = (g, pid) => !!(g.profielen[pid] && g.profielen[pid].rol === 'gast');
  // wie mag het ritme van 'doel' beheren: jezelf, of een ouder/beheerder voor een ander
  function magBeheer(s, doelPid) {
    if (doelPid === s.p.id) return true;
    return ['beheerder', 'ouder'].includes(s.p.rol) && !isGastPid(s.g, doelPid);
  }

  /* ---------- de stappen van een ritme klaarzetten ---------- */
  router.post('/gezin/ochtend/stap', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const doelPid = req.body.voor && s.g.profielen[req.body.voor] ? req.body.voor : s.p.id;
    if (isGastPid(s.g, doelPid)) return res.status(400).json({ error: 'Een gast heeft geen ochtendritme.' });
    if (!magBeheer(s, doelPid)) return res.status(403).json({ error: 'Je kunt alleen je eigen ritme klaarzetten.' });
    const tekst = schoon(req.body.tekst, 60);
    if (!tekst) return res.status(400).json({ error: 'Wat is de stap?' });
    const p = persoon(s.g, doelPid);
    if (p.stappen.length >= 20) return res.status(400).json({ error: 'Twintig stappen is genoeg voor een ochtend.' });
    if (p.stappen.some(x => x.tekst.toLowerCase() === tekst.toLowerCase())) return res.json({ ok: true });
    p.stappen.push({ id: rid(3), tekst }); save();
    res.json({ ok: true });
  });
  router.post('/gezin/ochtend/stap/verwijder', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const doelPid = req.body.voor && s.g.profielen[req.body.voor] ? req.body.voor : s.p.id;
    if (!magBeheer(s, doelPid)) return res.status(403).json({ error: 'Je kunt alleen je eigen ritme aanpassen.' });
    const p = persoon(s.g, doelPid);
    p.stappen = p.stappen.filter(x => x.id !== req.body.stapId);
    p.done = p.done.filter(id => id !== req.body.stapId); save();
    res.json({ ok: true });
  });

  /* ---------- vandaag afvinken (alleen je eigen ritme) ---------- */
  router.post('/gezin/ochtend/vink', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const p = persoon(s.g, s.p.id);
    const stap = p.stappen.find(x => x.id === req.body.stapId);
    if (!stap) return res.status(404).json({ error: 'Die stap staat niet in je ritme.' });
    const aan = req.body.aan === true;
    const had = p.done.includes(stap.id);
    if (aan && !had) p.done.push(stap.id);
    if (!aan && had) p.done = p.done.filter(id => id !== stap.id);
    // reeks: net alles af vandaag, en nog niet eerder vandaag geteld -> reeks bij
    const allesAf = p.stappen.length > 0 && p.stappen.every(x => p.done.includes(x.id));
    let netKlaar = false;
    if (allesAf && p.laatste !== vandaagStr()) {
      p.reeks = (p.laatste === gisterenStr()) ? (p.reeks || 0) + 1 : 1;
      p.laatste = vandaagStr();
      p.record = Math.max(p.record || 0, p.reeks);
      netKlaar = true;
    }
    save();
    res.json({ ok: true, klaar: allesAf, netKlaar, reeks: p.reeks || 0 });
  });

  /* ---------- het overzicht: mijn ritme van vandaag + het gezinsbord ---------- */
  router.get('/gezin/:code/ochtend', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const mij = persoon(s.g, s.p.id);
    const klaarVandaag = p => p.stappen.length > 0 && p.stappen.every(x => p.done.includes(x.id));
    // het gezinsbord: elk niet-gast-lid, of het vandaag al rond is en de reeks
    const bord = Object.entries(s.g.profielen)
      .filter(([, pr]) => pr.rol !== 'gast')
      .map(([id, pr]) => {
        const p = persoon(s.g, id);
        return { pid: id, naam: pr.naam, avatar: pr.avatar, kleur: pr.kleur,
          heeftRitme: p.stappen.length > 0, klaar: klaarVandaag(p),
          gedaan: p.done.filter(d => p.stappen.some(x => x.id === d)).length,
          totaal: p.stappen.length, reeks: p.reeks || 0 };
      })
      .sort((a, b) => (b.reeks - a.reeks) || a.naam.localeCompare(b.naam));
    res.json({
      mijn: {
        stappen: mij.stappen.map(x => ({ id: x.id, tekst: x.tekst, af: mij.done.includes(x.id) })),
        klaar: klaarVandaag(mij), reeks: mij.reeks || 0, record: mij.record || 0
      },
      voorbeelden: VOORBEELDEN,
      bord,
      // een ouder/beheerder mag ook de ritmes van de kinderen klaarzetten
      kinderen: ['beheerder', 'ouder'].includes(s.p.rol)
        ? Object.entries(s.g.profielen)
          .filter(([id, pr]) => pr.rol !== 'gast' && id !== s.p.id)
          .map(([id, pr]) => ({ pid: id, naam: pr.naam,
            stappen: persoon(s.g, id).stappen.map(x => ({ id: x.id, tekst: x.tekst })) }))
        : [],
      mijnId: s.p.id, magKinderen: ['beheerder', 'ouder'].includes(s.p.rol)
    });
  });
};
