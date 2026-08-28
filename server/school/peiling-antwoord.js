/* School (deelmodule): meedoen aan de peiling -- de kant van het gezin en van
   het personeel. Hoort bij school/peiling.js (uitzetten, sluiten, uitslag),
   dat de lijst, het merk en de uitslagrekening via de context meegeeft.

   Het merk is de hele anonimiteit in een regel: een hash van het schoolgeheim,
   de peiling en de deelnemer. Hij staat in `merken` en zegt DAT er geantwoord
   is; het antwoord zelf gaat los in `antwoorden`, zonder enige verwijzing
   terug. Zo kan er niet twee keer gestemd worden en is er toch geen weg van een
   score naar een mens. Er is met opzet ook geen tijdstip bij een antwoord --
   alleen de dag, want "17:42:03" is bij een kleine groep al bijna een naam. */
module.exports = (sctx) => {
  const { router, save, nu, K, gezinSessie, personeelVan, leerlingSleutel,
    peilingLijst: P, peilingMerk: merk, peilingUitslag: uitslag, S } = sctx;

  /* ---------- meedoen: gezin ---------- */
  function openVoor(sch, doelgroep, klassen) {
    return P(sch).filter(p => p.open && p.doelgroep === doelgroep && (!p.klasCode || klassen.includes(p.klasCode)));
  }

  router.post('/school/peiling/mijn', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const doelgroep = s.beheerder ? 'ouders' : 'leerlingen';
    const uit = [];
    for (const sch of Object.values(S())) {
      const mijnKlassen = Object.values(K()).filter(k => k.schoolCode === sch.code
        && (k.leerlingen || []).some(l => l.gezinCode === s.g.code)).map(k => k.code);
      if (!mijnKlassen.length) continue;
      for (const p of openVoor(sch, doelgroep, mijnKlassen))
        uit.push({ school: sch.naam, id: p.id, titel: p.titel, stellingen: p.stellingen, tot: p.tot,
          alGeantwoord: p.merken.includes(merk(sch, p, leerlingSleutel(s.g.code, s.p.id))) });
    }
    res.json({ ok: true, peilingen: uit.slice(0, 20),
      uitleg: 'Anoniem: alleen uw scores worden bewaard, niet wie u bent. Daarom is er ook geen open tekstveld.' });
  });

  function antwoord(sch, p, wie, scores, res) {
    const stempel = merk(sch, p, wie);
    if (p.merken.includes(stempel)) return res.status(409).json({ error: 'Er is voor u al geantwoord op deze peiling.' });
    const nette = p.stellingen.map((_, i) => {
      const x = Math.round(Number(scores[i]));
      return x >= 1 && x <= 5 ? x : null;
    });
    if (nette.every(x => x == null)) return res.status(400).json({ error: 'Antwoord per stelling met 1 tot en met 5.' });
    p.merken.push(stempel);
    p.antwoorden.push({ scores: nette, at: nu().slice(0, 10) }); // dag, niet het tijdstip: dat is al bijna een vingerafdruk
    save();
    const u = uitslag(p);
    res.json({ ok: true, bedankt: true, antwoorden: u.aantal, uitslagZichtbaar: u.genoeg,
      uitleg: 'Uw scores staan los van uw naam opgeslagen; ook de school kan ze niet naar u herleiden.' });
  }

  router.post('/school/peiling/antwoord', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const scores = Array.isArray(req.body.scores) ? req.body.scores : [];
    for (const sch of Object.values(S())) {
      const p = P(sch).find(x => x.id === String(req.body.peilingId || ''));
      if (!p) continue;
      if (!p.open) return res.status(409).json({ error: 'Deze peiling is gesloten.' });
      const doelgroep = s.beheerder ? 'ouders' : 'leerlingen';
      if (p.doelgroep !== doelgroep) return res.status(403).json({ error: 'Deze peiling is voor ' + p.doelgroep + '.' });
      const mijnKlassen = Object.values(K()).filter(k => k.schoolCode === sch.code
        && (k.leerlingen || []).some(l => l.gezinCode === s.g.code)).map(k => k.code);
      if (p.klasCode && !mijnKlassen.includes(p.klasCode)) return res.status(403).json({ error: 'Deze peiling is voor een andere klas.' });
      if (!mijnKlassen.length) return res.status(403).json({ error: 'U hebt geen kind op deze school.' });
      return antwoord(sch, p, leerlingSleutel(s.g.code, s.p.id), scores, res);
    }
    res.status(404).json({ error: 'Die peiling kennen we niet.' });
  });

  /* Welke peilingen staan er voor MIJ open? Het gezin had die vraag al
     (/peiling/mijn); het personeel niet, en daarmee was de personeelspeiling
     onbereikbaar: je kon alleen antwoorden als je het id van een peiling
     ergens vandaan toverde. Zelfde vorm, zelfde anonimiteit -- alGeantwoord
     komt uit het merk en niet uit een lijst met namen. */
  router.post('/school/peiling/mijn-personeel', (req, res) => {
    const pv = personeelVan(req, res); if (!pv) return;
    const uit = P(pv.sch).filter(p => p.open && p.doelgroep === 'personeel')
      .map(p => ({ id: p.id, titel: p.titel, stellingen: p.stellingen, tot: p.tot,
        alGeantwoord: p.merken.includes(merk(pv.sch, p, 'p:' + pv.p.id)) }));
    res.json({ ok: true, peilingen: uit.slice(0, 20),
      uitleg: 'Anoniem: alleen uw scores worden bewaard, niet wie u bent. De school ziet pas een uitslag vanaf vijf antwoorden.' });
  });

  // en het personeel, met hetzelfde slot en dezelfde anonimiteit
  router.post('/school/peiling/antwoord-personeel', (req, res) => {
    const pv = personeelVan(req, res); if (!pv) return;
    const p = P(pv.sch).find(x => x.id === String(req.body.peilingId || ''));
    if (!p) return res.status(404).json({ error: 'Die peiling kennen we niet.' });
    if (!p.open) return res.status(409).json({ error: 'Deze peiling is gesloten.' });
    if (p.doelgroep !== 'personeel') return res.status(403).json({ error: 'Deze peiling is voor ' + p.doelgroep + '.' });
    antwoord(pv.sch, p, 'p:' + pv.p.id, Array.isArray(req.body.scores) ? req.body.scores : [], res);
  });

};
