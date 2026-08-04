/* School (deelmodule): incidenten, de ontruimingslijst en de calamiteiten-
   melding. Hoort bij school/veiligheid.js (passen en bezoekers) en draait op
   dezelfde schoolcontext; apart bestand omdat dit een andere vraag beantwoordt:
   veiligheid.js gaat over de deur, dit gaat over wat er binnen gebeurt.

   Incidenten kennen een vertrouwelijke stand: dan lezen alleen de
   vertrouwenspersoon en de directie mee, net als bij de hulplijn van het kind.
   Een incident met een leerling erin is een dossier over een kind, en dat gaat
   niet standaard rond in de lerarenkamer.

   De ontruimingslijst valt terug op de presentie van vandaag als er geen
   poortjes zijn. Een ontruimingslijst die leeg blijft omdat de techniek anders
   is, is de gevaarlijkste lege lijst die er is. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, poort, log, passen, bezoekers } = sctx;

  const INC = (sch) => { if (!sch.incidenten) sch.incidenten = []; return sch.incidenten; };
  const dag = () => new Date().toISOString().slice(0, 10);

  /* ---------- incidenten ----------
     Feitelijk opschrijven wat er is gebeurd, met een ernst en een afhandeling.
     Vertrouwelijk = alleen de vertrouwenspersoon en de directie. */
  router.post('/school/incident/meld', (req, res) => {
    const g = poort(req, res, 'incident'); if (!g) return;
    const wat = schoon(req.body.wat, 600);
    if (!wat) return res.status(400).json({ error: 'Beschrijf wat er is gebeurd.' });
    const ERNST = ['licht', 'ernstig', 'zeer ernstig'];
    const ernst = String(req.body.ernst || 'licht');
    if (!ERNST.includes(ernst)) return res.status(400).json({ error: 'Ernst is licht, ernstig of zeer ernstig.' });
    const i = { id: rid(5), at: nu(), door: g.p.naam, wat, ernst,
      vertrouwelijk: req.body.vertrouwelijk === true,
      plek: schoon(req.body.plek, 60) || null, klasCode: String(req.body.klasCode || '').trim().toUpperCase() || null,
      betrokkenen: (Array.isArray(req.body.betrokkenen) ? req.body.betrokkenen : []).slice(0, 20).map(String),
      afgehandeld: false, afhandeling: null };
    INC(g.sch).unshift(i); g.sch.incidenten = INC(g.sch).slice(0, 5000);
    log(g.sch, g.p, 'incident-gemeld', i.id, ernst + (i.vertrouwelijk ? ', vertrouwelijk' : ''));
    save();
    res.json({ ok: true, incident: { id: i.id, ernst: i.ernst, vertrouwelijk: i.vertrouwelijk } });
  });

  router.post('/school/incident/lijst', (req, res) => {
    const g = poort(req, res, 'incident'); if (!g) return;
    const magVertrouwelijk = g.directie || sctx.mag(g.p, 'incident.vertrouwelijk');
    const alle = INC(g.sch);
    const zichtbaar = alle.filter(i => magVertrouwelijk || !i.vertrouwelijk);
    log(g.sch, g.p, 'incidenten-gelezen', g.sch.code, schoon(req.body.reden, 120) || 'incidentoverzicht');
    res.json({ ok: true, aantal: zichtbaar.length,
      verborgen: alle.length - zichtbaar.length,
      verborgenUitleg: alle.length > zichtbaar.length ? 'Vertrouwelijke meldingen ziet alleen de vertrouwenspersoon of de directie.' : null,
      incidenten: zichtbaar.slice(0, 200) });
  });

  router.post('/school/incident/handel-af', (req, res) => {
    const g = poort(req, res, 'incident'); if (!g) return;
    const i = INC(g.sch).find(x => x.id === String(req.body.incidentId || ''));
    if (!i) return res.status(404).json({ error: 'Dat incident kennen we niet.' });
    if (i.vertrouwelijk && !(g.directie || sctx.mag(g.p, 'incident.vertrouwelijk')))
      return res.status(403).json({ error: 'Dit is een vertrouwelijke melding.' });
    const afhandeling = schoon(req.body.afhandeling, 600);
    if (!afhandeling) return res.status(400).json({ error: 'Noteer hoe het incident is afgehandeld.' });
    i.afgehandeld = true; i.afhandeling = afhandeling; i.afgehandeldDoor = g.p.naam; i.afgehandeldAt = nu();
    save();
    res.json({ ok: true, incident: { id: i.id, afgehandeld: true } });
  });

  /* ---------- de ontruimingslijst ----------
     Wie is er nu binnen: leerlingen en personeel met een pas die binnen staat,
     plus de bezoekers die nog niet zijn uitgetekend. Bij een lege paslijst valt
     hij terug op de presentie van vandaag, want een school zonder poortjes moet
     dit net zo goed kunnen printen -- en een ontruimingslijst die leeg blijft
     omdat de techniek anders is, is de gevaarlijkste lege lijst die er is. */
  function ontruiming(sch) {
    const alle = Object.values(passen(sch));
    const binnen = alle.filter(p => p.status === 'actief' && p.stand && p.stand.binnen);
    const binnenBezoek = bezoekers(sch).filter(b => b.binnen);
    const uit = { bron: 'passen', leerlingen: binnen.filter(p => p.soort === 'leerling').map(p => ({ naam: p.houder, sinds: p.stand.sinds, ingang: p.stand.ingang })),
      personeel: binnen.filter(p => p.soort === 'personeel').map(p => ({ naam: p.houder, sinds: p.stand.sinds })),
      bezoekers: binnenBezoek.map(b => ({ naam: b.naam, organisatie: b.organisatie, voor: b.voor, sinds: b.at })) };
    if (!binnen.length) {
      const vandaag = dag();
      const namen = new Map();
      for (const les of (sch.presentie || [])) {
        if (les.datum !== vandaag) continue;
        for (const r of les.regels) if (r.stand === 'aanwezig' || r.stand === 'telaat') namen.set(r.leerling, r.naam);
      }
      uit.bron = namen.size ? 'presentie van vandaag' : 'geen bron';
      uit.leerlingen = [...namen.values()].map(n => ({ naam: n, sinds: null, ingang: null }));
    }
    uit.totaal = uit.leerlingen.length + uit.personeel.length + uit.bezoekers.length;
    return uit;
  }

  router.post('/school/ontruiming', (req, res) => {
    const g = poort(req, res, 'veiligheid'); if (!g) return;
    const lijst = ontruiming(g.sch);
    log(g.sch, g.p, 'ontruimingslijst', g.sch.code, schoon(req.body.reden, 120) || 'ontruimingslijst opgevraagd');
    res.json(Object.assign({ ok: true }, lijst));
  });

  /* ---------- de calamiteitenmelding ----------
     Een noodmelding gaat naar ALLE klassen (en dus naar alle gezinnen), staat
     apart gemarkeerd, en komt met de ontruimingslijst terug voor wie hem
     verstuurt. Afmelden hoort erbij: een alarm dat aan blijft staan, wordt
     genegeerd. */
  router.post('/school/calamiteit', (req, res) => {
    const g = poort(req, res, 'veiligheid'); if (!g) return;
    if (req.body.stop === true) {
      g.sch.calamiteit = null;
      for (const k of Object.values(K()).filter(x => x.schoolCode === g.sch.code))
        k.mededelingen.unshift({ id: rid(3), tekst: 'Het alarm is afgemeld. De situatie is voorbij.', at: nu(), vanDirectie: true, van: g.sch.naam, nood: true });
      log(g.sch, g.p, 'calamiteit-af', g.sch.code, 'alarm afgemeld');
      save();
      return res.json({ ok: true, actief: false });
    }
    const tekst = schoon(req.body.tekst, 400);
    if (!tekst) return res.status(400).json({ error: 'Schrijf wat er aan de hand is en wat mensen moeten doen.' });
    const soort = schoon(req.body.soort, 40) || 'calamiteit';
    g.sch.calamiteit = { soort, tekst, at: nu(), door: g.p.naam };
    let klassen = 0;
    for (const k of Object.values(K()).filter(x => x.schoolCode === g.sch.code)) {
      k.mededelingen.unshift({ id: rid(3), tekst: '[' + soort.toUpperCase() + '] ' + tekst, at: nu(), vanDirectie: true, van: g.sch.naam, nood: true });
      k.mededelingen = k.mededelingen.slice(0, 100);
      klassen++;
    }
    log(g.sch, g.p, 'calamiteit', g.sch.code, soort);
    save();
    res.json({ ok: true, actief: true, klassen, ontruiming: ontruiming(g.sch) });
  });

  return { ontruiming };
};
