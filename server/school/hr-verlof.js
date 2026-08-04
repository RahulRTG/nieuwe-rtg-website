/* School (deelmodule): personeel, deel twee -- verlof en ziekte, vervanging,
   urenregistratie en de gesprekken. Hoort bij school/hr.js (dossier, contract,
   bevoegdheden, trainingen), dat het dossier via de context meegeeft.

   Twee dingen die hier bewust anders zijn dan in het gemiddelde HR-pakket: een
   ziekmelding vraagt GEEN reden (een werkgever hoort niet te weten wat iemand
   heeft, en mag dat ook niet vastleggen), en een gesprek legt AFSPRAKEN vast en
   geen cijfer -- geen score, geen schaal, geen ranglijst van docenten. De
   medewerker zet er zijn eigen reactie bij, en die blijft staan.

   Vervanging haakt op wat er al is: de waarnemer op de klas
   (school/verbonden.js). Er komt hier dus geen tweede plek waar staat wie er
   voor de klas staat. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, eigenVeld, poort, log, personeelVan, dossierVan: dos } = sctx;

  /* ---------- verlof en ziekte ----------
     Een ziekmelding vraagt geen diagnose en het veld ervoor bestaat niet: een
     werkgever hoeft niet te weten wat iemand heeft (dat mag hij ook niet
     vastleggen). Alleen: van wanneer tot wanneer, en of er vervanging nodig is. */
  router.post('/school/hr/afwezig', (req, res) => {
    const pv = personeelVan(req, res); if (!pv) return;
    const soort = String(req.body.soort || '');
    if (!['ziek', 'verlof', 'beter'].includes(soort)) return res.status(400).json({ error: 'Kies ziek, verlof of beter.' });
    const d = dos(pv.sch, pv.p);
    if (soort === 'beter') {
      const lopend = d.verlof.find(v => v.soort === 'ziek' && !v.tot);
      if (!lopend) return res.status(404).json({ error: 'Er staat geen ziekmelding open.' });
      lopend.tot = new Date().toISOString().slice(0, 10); lopend.beterAt = nu();
      save();
      return res.json({ ok: true, verlof: lopend });
    }
    const v = { id: rid(4), soort, van: schoon(req.body.van, 10) || new Date().toISOString().slice(0, 10),
      tot: schoon(req.body.tot, 10) || null, vervangingNodig: req.body.vervangingNodig !== false,
      toelichting: soort === 'verlof' ? (schoon(req.body.toelichting, 200) || null) : null,
      status: soort === 'verlof' ? 'ingediend' : 'gemeld', at: nu() };
    d.verlof.unshift(v); d.verlof = d.verlof.slice(0, 200);
    save();
    res.json({ ok: true, verlof: v,
      let: soort === 'ziek' ? 'Een ziekmelding vraagt geen reden en legt geen medische gegevens vast.' : 'Verlof wordt door een mens beoordeeld.' });
  });

  router.post('/school/hr/verlof/besluit', (req, res) => {
    const g = poort(req, res, 'hr'); if (!g) return;
    const p = eigenVeld(g.sch.personeel || {}, req.body.personeelId);
    if (!p) return res.status(404).json({ error: 'Dit personeelslid is niet gevonden.' });
    const d = dos(g.sch, p);
    const v = d.verlof.find(x => x.id === String(req.body.verlofId || ''));
    if (!v) return res.status(404).json({ error: 'Die aanvraag kennen we niet.' });
    if (v.soort !== 'verlof') return res.status(400).json({ error: 'Over een ziekmelding wordt niet besloten.' });
    const besluit = String(req.body.besluit || '');
    if (!['toegekend', 'afgewezen'].includes(besluit)) return res.status(400).json({ error: 'Kies toegekend of afgewezen.' });
    v.status = besluit; v.besluitReden = schoon(req.body.reden, 200) || null; v.besluitDoor = g.p.naam; v.besluitAt = nu();
    save();
    res.json({ ok: true, verlof: v });
  });

  /* ---------- vervanging ----------
     Wie is er vandaag vrij? De lijst komt uit de eigen gegevens: personeel dat
     niet ziek of met verlof is. Toewijzen zet de bestaande waarnemer op de
     klas, dus het lerarenteam en de online les weten het meteen. */
  router.post('/school/hr/vervanging', (req, res) => {
    const g = poort(req, res, 'hr'); if (!g) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k || k.schoolCode !== g.sch.code) return res.status(404).json({ error: 'Die klas hoort niet bij deze school.' });
    const vandaag = new Date().toISOString().slice(0, 10);
    const bezet = (p) => (dos(g.sch, p).verlof || []).some(v => (v.soort === 'ziek' || v.status === 'toegekend')
      && v.van <= vandaag && (!v.tot || v.tot >= vandaag));
    const vrij = Object.values(g.sch.personeel || {}).filter(p => p.status === 'actief' && p.rol === 'leraar' && p.id !== k.leraarId && !bezet(p));
    if (!req.body.personeelId) return res.json({ ok: true, klas: k.naam, beschikbaar: vrij.map(p => ({ id: p.id, naam: p.naam })) });
    const p = eigenVeld(g.sch.personeel || {}, req.body.personeelId);
    if (!p || p.status !== 'actief') return res.status(404).json({ error: 'Dit personeelslid is niet gevonden of nog niet toegelaten.' });
    if (bezet(p)) return res.status(409).json({ error: p.naam + ' staat zelf als ziek of met verlof genoteerd.' });
    k.waarnemer = { id: p.id, naam: p.naam, at: nu(), via: 'hr' };
    log(g.sch, g.p, 'vervanging', k.code, p.naam);
    save();
    res.json({ ok: true, klas: k.naam, waarnemer: k.waarnemer });
  });

  /* ---------- urenregistratie ----------
     Door de medewerker zelf; HR ziet het totaal. Uren die iemand anders voor
     je invult zijn geen urenregistratie maar een aanname. */
  router.post('/school/hr/uren', (req, res) => {
    const pv = personeelVan(req, res); if (!pv) return;
    const d = dos(pv.sch, pv.p);
    if (req.body.uren != null) {
      const uren = Math.max(0, Math.min(24, Number(req.body.uren) || 0));
      if (!uren) return res.status(400).json({ error: 'Vul het aantal uren in.' });
      d.uren.unshift({ id: rid(3), datum: schoon(req.body.datum, 10) || new Date().toISOString().slice(0, 10),
        uren, wat: schoon(req.body.wat, 80) || null, at: nu() });
      d.uren = d.uren.slice(0, 1000);
      save();
    }
    const maand = (schoon(req.body.maand, 7) || new Date().toISOString().slice(0, 7));
    const vanMaand = d.uren.filter(u => String(u.datum).startsWith(maand));
    res.json({ ok: true, maand, totaal: vanMaand.reduce((n, u) => n + u.uren, 0), regels: vanMaand.slice(0, 100) });
  });

  /* ---------- gesprekken ----------
     Afspraken, geen score. De medewerker mag zijn eigen reactie toevoegen; die
     staat er dan naast en blijft staan. */
  router.post('/school/hr/gesprek', (req, res) => {
    const g = poort(req, res, 'hr'); if (!g) return;
    const p = eigenVeld(g.sch.personeel || {}, req.body.personeelId);
    if (!p) return res.status(404).json({ error: 'Dit personeelslid is niet gevonden.' });
    const besproken = schoon(req.body.besproken, 1000);
    if (!besproken) return res.status(400).json({ error: 'Noteer wat er is besproken.' });
    const d = dos(g.sch, p);
    d.gesprekken.unshift({ id: rid(4), op: schoon(req.body.op, 10) || new Date().toISOString().slice(0, 10),
      soort: schoon(req.body.soort, 30) || 'functioneringsgesprek', besproken,
      afspraken: (Array.isArray(req.body.afspraken) ? req.body.afspraken : []).slice(0, 10).map(a => schoon(a, 200)).filter(Boolean),
      door: g.p.naam, at: nu(), reactie: null });
    d.gesprekken = d.gesprekken.slice(0, 50);
    log(g.sch, g.p, 'gesprek-vastgelegd', p.id, 'gespreksverslag');
    save();
    res.json({ ok: true, gesprek: d.gesprekken[0], let: 'Er staat bewust geen cijfer of ranglijst in.' });
  });

  router.post('/school/hr/gesprek/reactie', (req, res) => {
    const pv = personeelVan(req, res); if (!pv) return;
    const d = dos(pv.sch, pv.p);
    const gesp = d.gesprekken.find(x => x.id === String(req.body.gesprekId || ''));
    if (!gesp) return res.status(404).json({ error: 'Dat gesprek staat niet in uw dossier.' });
    const tekst = schoon(req.body.reactie, 1000);
    if (!tekst) return res.status(400).json({ error: 'Schrijf uw reactie.' });
    gesp.reactie = { tekst, at: nu() };
    save();
    res.json({ ok: true, gesprek: gesp });
  });

  /* ---------- het HR-overzicht ----------
     Bezetting, wie er vandaag uit is, en welke bevoegdheden verlopen. Geen
     verzuimpercentage per persoon op het scherm: dat is een cijfer waar in de
     praktijk mensen op worden afgerekend zonder dat het iets verklaart. */
  router.post('/school/hr/overzicht', (req, res) => {
    const g = poort(req, res, 'hr'); if (!g) return;
    const vandaag = new Date().toISOString().slice(0, 10);
    const over = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const mensen = Object.values(g.sch.personeel || {}).filter(p => p.status === 'actief');
    const uit = [], verloopt = [];
    for (const p of mensen) {
      const d = dos(g.sch, p);
      for (const v of d.verlof) if ((v.soort === 'ziek' || v.status === 'toegekend') && v.van <= vandaag && (!v.tot || v.tot >= vandaag))
        uit.push({ naam: p.naam, soort: v.soort, van: v.van, tot: v.tot, vervangingNodig: v.vervangingNodig !== false });
      for (const b of d.bevoegdheden) if (b.geldigTot && b.geldigTot <= over)
        verloopt.push({ naam: p.naam, wat: b.wat, geldigTot: b.geldigTot, verlopen: b.geldigTot < vandaag });
    }
    res.json({ ok: true, personeel: mensen.length, vandaagUit: uit.length, uit,
      bevoegdhedenLet: verloopt.sort((a, b) => String(a.geldigTot).localeCompare(String(b.geldigTot))).slice(0, 50),
      zonderContract: mensen.filter(p => !dos(g.sch, p).contract).map(p => p.naam) });
  });
};
