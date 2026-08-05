/* School (deelmodule): personeel en organisatie -- dossier, contract,
   beschikbaarheid, verlof en ziekte, vervanging, urenregistratie,
   gesprekken, interne trainingen en bevoegdheden.

   Twee dingen die hier bewust anders zijn dan in het gemiddelde HR-pakket:

   1. EEN GESPREK LEGT AFSPRAKEN VAST, GEEN CIJFER. Er is geen score, geen
      beoordelingsschaal en geen ranglijst van docenten. Wat erin gaat is wat
      er is besproken en wat beide kanten gaan doen -- en de medewerker kan er
      zijn eigen reactie bij zetten, die niemand kan verwijderen.
   2. HET DOSSIER IS VAN HR, NIET VAN DE LERARENKAMER. Alleen het recht 'hr'
      (en de directie) komt erin, elke blik gaat het journaal in, en de
      medewerker kan zijn eigen dossier altijd zelf opvragen -- dat laatste is
      geen gunst maar het inzagerecht.

   Vervanging haakt op wat er al is: de waarnemer op de klas (school/verbonden.js).
   Er komt hier dus geen tweede plek waar staat wie er voor de klas staat. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, eigenVeld, poort, log, personeelVan } = sctx;

  const D = (sch) => { if (!sch.hr) sch.hr = {}; return sch.hr; };
  const dos = (sch, p) => {
    const d = D(sch);
    if (!d[p.id]) d[p.id] = { personeelId: p.id, naam: p.naam, contract: null, bevoegdheden: [], trainingen: [],
      beschikbaarheid: null, verlof: [], uren: [], gesprekken: [] };
    return d[p.id];
  };

  /* ---------- dossier en contract ---------- */
  router.post('/school/hr/zet', (req, res) => {
    const g = poort(req, res, 'hr'); if (!g) return;
    const p = eigenVeld(g.sch.personeel || {}, req.body.personeelId);
    if (!p) return res.status(404).json({ error: 'Dit personeelslid is niet gevonden.' });
    const d = dos(g.sch, p);
    if (req.body.contract) {
      const c = req.body.contract;
      d.contract = { soort: schoon(c.soort, 40) || 'onbepaalde tijd', uren: Math.max(0, Math.min(60, Number(c.uren) || 0)),
        van: schoon(c.van, 10) || null, tot: schoon(c.tot, 10) || null, functie: schoon(c.functie, 60) || null,
        schaal: schoon(c.schaal, 20) || null, at: nu(), door: g.p.naam };
    }
    if (req.body.beschikbaarheid !== undefined) d.beschikbaarheid = schoon(req.body.beschikbaarheid, 200) || null;
    if (req.body.bevoegdheid) {
      d.bevoegdheden.unshift({ id: rid(3), wat: schoon(req.body.bevoegdheid, 80), vak: schoon(req.body.vak, 40) || null,
        geldigTot: schoon(req.body.geldigTot, 10) || null, at: nu() });
      d.bevoegdheden = d.bevoegdheden.slice(0, 50);
    }
    if (req.body.training) {
      d.trainingen.unshift({ id: rid(3), wat: schoon(req.body.training, 80), op: schoon(req.body.op, 10) || null,
        afgerond: req.body.afgerond === true, at: nu() });
      d.trainingen = d.trainingen.slice(0, 50);
    }
    log(g.sch, g.p, 'hr-dossier-gewijzigd', p.id, schoon(req.body.reden, 120) || 'dossier bijgewerkt');
    save();
    res.json({ ok: true, dossier: d });
  });

  router.post('/school/hr/dossier', (req, res) => {
    const g = poort(req, res, 'hr'); if (!g) return;
    const p = eigenVeld(g.sch.personeel || {}, req.body.personeelId);
    if (!p) return res.status(404).json({ error: 'Dit personeelslid is niet gevonden.' });
    const reden = schoon(req.body.reden, 120);
    if (!reden) return res.status(400).json({ error: 'Noteer waarom u dit personeelsdossier opent; dat komt in het journaal.', redenNodig: true });
    log(g.sch, g.p, 'hr-dossier-geopend', p.id, reden);
    res.json({ ok: true, dossier: dos(g.sch, p) });
  });

  // het inzagerecht van de medewerker zelf: geen recht 'hr' nodig, wel het
  // eigen personeel-token, en alleen het eigen dossier
  router.post('/school/hr/mijn', (req, res) => {
    const pv = personeelVan(req, res); if (!pv) return;
    const d = dos(pv.sch, pv.p);
    save();
    res.json({ ok: true, dossier: d, uitleg: 'Dit is uw eigen dossier. Wat hier staat, staat er ook voor HR.' });
  });

  return { dossierVan: dos };
};
