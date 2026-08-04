/* School (deelmodule): de organisatie -- vestigingen, opleidingen/niveaus en
   de schooljaarovergang.

   Een enterprise-schoolsysteem is zelden EEN school: er zijn locaties met een
   eigen adres, een eigen huisstijl en eigen instellingen, en er zijn
   opleidingen met een capaciteit (waar de wachtlijst uit volgt).

   De schooljaarovergang staat hier ook, en die is het gevoeligste stuk van dit
   bestand. In de meeste systemen is dat een knop die 1200 leerlingen een klas
   opschuift. Hier is het twee stappen: eerst een VOORSTEL dat je kunt lezen en
   corrigeren, dan een uitvoering die alleen loopt op precies dat voorstel. Dat
   is dezelfde regel als bij het overgaan zelf (kern/onderwijs.js): het systeem
   adviseert, een mens beslist. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, eigenVeld, poort, log, leerlingLijst } = sctx;

  const V = (sch) => { if (!sch.vestigingen) sch.vestigingen = {}; return sch.vestigingen; };
  const O = (sch) => { if (!sch.opleidingen) sch.opleidingen = {}; return sch.opleidingen; };

  /* ---------- vestigingen ----------
     Huisstijl per vestiging blijft binnen de merkregels: een accentkleur en
     een naam, geen eigen fonts en geen eigen vormtaal. Een schoolsysteem dat
     elke locatie zijn eigen thema laat bouwen, ziet er na een jaar uit als
     dertien verschillende producten. */
  router.post('/school/vestiging/zet', (req, res) => {
    const g = poort(req, res); if (!g) return;
    if (!g.directie) return res.status(403).json({ error: 'Vestigingen beheert de directie.' });
    const id = (schoon(req.body.id, 20) || rid(4)).toUpperCase();
    const naam = schoon(req.body.naam, 80);
    if (!naam) return res.status(400).json({ error: 'Geef de vestiging een naam.' });
    const kleur = schoon(req.body.accent, 7);
    if (kleur && !/^#[0-9A-Fa-f]{6}$/.test(kleur)) return res.status(400).json({ error: 'Een accentkleur is een hexwaarde, bijvoorbeeld #7F1634.' });
    V(g.sch)[id] = { id, naam, adres: schoon(req.body.adres, 120) || null, plaats: schoon(req.body.plaats, 60) || null,
      telefoon: schoon(req.body.telefoon, 24) || null, accent: kleur || null,
      instellingen: { lestijden: schoon(req.body.lestijden, 60) || null, kantine: req.body.kantine === true },
      at: (V(g.sch)[id] || {}).at || nu() };
    save();
    res.json({ ok: true, vestiging: V(g.sch)[id] });
  });

  /* ---------- opleidingen en niveaus ----------
     De capaciteit hoort hier en niet bij de klas: een wachtlijst gaat over een
     opleiding, niet over lokaal 3B. */
  router.post('/school/opleiding/zet', (req, res) => {
    const g = poort(req, res); if (!g) return;
    if (!g.directie) return res.status(403).json({ error: 'Opleidingen beheert de directie.' });
    const id = schoon(req.body.id, 40) || rid(4);
    const naam = schoon(req.body.naam, 80);
    if (!naam) return res.status(400).json({ error: 'Geef de opleiding een naam.' });
    const plaatsen = req.body.plaatsen == null ? null : Math.max(0, Math.min(5000, Number(req.body.plaatsen) || 0));
    O(g.sch)[id] = { id, naam, niveau: schoon(req.body.niveau, 40) || null, duur: schoon(req.body.duur, 20) || null,
      vestiging: schoon(req.body.vestiging, 20) || null, plaatsen, at: (O(g.sch)[id] || {}).at || nu() };
    save();
    res.json({ ok: true, opleiding: O(g.sch)[id] });
  });

  /* ---------- het organisatiebeeld ----------
     Een aanroep die het scherm alles geeft: vestigingen, opleidingen met
     bezetting en wachtlijst, en de klassen per vestiging. */
  router.post('/school/organisatie', (req, res) => {
    const g = poort(req, res); if (!g) return;
    const alle = Object.values(leerlingLijst(g.sch));
    const opleidingen = Object.values(O(g.sch)).map(o => {
      const bezet = alle.filter(l => l.opleiding === o.id && l.status === 'ingeschreven').length;
      const wacht = alle.filter(l => l.opleiding === o.id && l.status === 'wachtlijst').length;
      return Object.assign({}, o, { bezet, wachtlijst: wacht,
        vol: o.plaatsen ? bezet >= o.plaatsen : false, vrij: o.plaatsen ? Math.max(0, o.plaatsen - bezet) : null });
    });
    const klassen = Object.values(K()).filter(k => k.schoolCode === g.sch.code);
    res.json({ ok: true, school: { code: g.sch.code, naam: g.sch.naam, plaats: g.sch.plaats },
      vestigingen: Object.values(V(g.sch)).map(v => Object.assign({}, v, {
        leerlingen: alle.filter(l => l.vestiging === v.id && l.status === 'ingeschreven').length,
        klassen: klassen.filter(k => k.vestiging === v.id).length })),
      opleidingen,
      klassen: klassen.map(k => ({ code: k.code, naam: k.naam, vestiging: k.vestiging || null, leerlingen: (k.leerlingen || []).length })),
      leerlingen: { ingeschreven: alle.filter(l => l.status === 'ingeschreven').length,
        aanmeldingen: alle.filter(l => l.status === 'aanmelding').length,
        wachtlijst: alle.filter(l => l.status === 'wachtlijst').length } });
  });

  // een klas aan een vestiging hangen (de klas zelf blijft van de leraar)
  router.post('/school/klas/vestiging', (req, res) => {
    const g = poort(req, res); if (!g) return;
    if (!g.directie) return res.status(403).json({ error: 'De indeling van klassen over vestigingen doet de directie.' });
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k || k.schoolCode !== g.sch.code) return res.status(404).json({ error: 'Die klas hoort niet bij deze school.' });
    const v = eigenVeld(V(g.sch), String(req.body.vestiging || '').toUpperCase());
    if (!v) return res.status(404).json({ error: 'Die vestiging kennen we niet.' });
    k.vestiging = v.id;
    save();
    res.json({ ok: true, klas: k.code, vestiging: v.id });
  });

  /* ---------- de schooljaarovergang: eerst het voorstel ----------
     Per ingeschreven leerling: van welke klas naar welke klas. Het voorstel
     kent de volgorde van de klassen niet uit zichzelf -- die geeft de directie
     mee (een lijst van {van, naar}), want alleen de school weet of 3B naar 4A
     of naar 4B gaat. Wat niet in de lijst staat, blijft staan. */
  router.post('/school/schooljaar/voorstel', (req, res) => {
    const g = poort(req, res); if (!g) return;
    if (!g.directie) return res.status(403).json({ error: 'De schooljaarovergang doet de directie.' });
    const paden = (Array.isArray(req.body.paden) ? req.body.paden : []).slice(0, 200)
      .map(p => ({ van: String((p && p.van) || '').trim().toUpperCase(), naar: String((p && p.naar) || '').trim().toUpperCase() }))
      .filter(p => p.van);
    if (!paden.length) return res.status(400).json({ error: 'Geef minstens een pad op: van welke klas naar welke klas.' });
    const fout = paden.filter(p => !eigenVeld(K(), p.van) || (p.naar && !eigenVeld(K(), p.naar)));
    if (fout.length) return res.status(400).json({ error: 'Onbekende klascode in het pad: ' + fout.map(p => p.van + '->' + (p.naar || '?')).join(', ') });
    const regels = [];
    for (const l of Object.values(leerlingLijst(g.sch))) {
      if (l.status !== 'ingeschreven' || !l.klasCode) continue;
      const pad = paden.find(p => p.van === l.klasCode);
      if (!pad) continue;
      regels.push({ leerlingId: l.id, naam: l.naam, van: l.klasCode, naar: pad.naar || null,
        wat: pad.naar ? 'over naar ' + pad.naar : 'verlaat de school (geen vervolgklas)' });
    }
    const voorstelId = rid(6);
    g.sch.overgangen = (g.sch.overgangen || []).concat([{ id: voorstelId, at: nu(), regels, uitgevoerd: false }]).slice(-10);
    save();
    res.json({ ok: true, voorstelId, aantal: regels.length, regels: regels.slice(0, 100),
      uitleg: 'Dit is een voorstel. Lees het na, pas de paden aan waar het niet klopt en voer het pas daarna uit.' });
  });

  /* ---------- en dan de uitvoering ----------
     Alleen op een bestaand voorstel, en maar een keer. Zonder dat wordt dit een
     knop die je twee keer indrukt en waarna niemand meer weet waar de leerling
     vandaan kwam. */
  router.post('/school/schooljaar/voer-uit', (req, res) => {
    const g = poort(req, res); if (!g) return;
    if (!g.directie) return res.status(403).json({ error: 'De schooljaarovergang doet de directie.' });
    const v = (g.sch.overgangen || []).find(x => x.id === String(req.body.voorstelId || ''));
    if (!v) return res.status(404).json({ error: 'Dat voorstel bestaat niet (meer). Maak eerst een nieuw voorstel.' });
    if (v.uitgevoerd) return res.status(409).json({ error: 'Dit voorstel is al uitgevoerd op ' + v.uitgevoerdAt + '.' });
    if (req.body.bevestig !== 'OVERGANG') return res.status(400).json({ error: 'Bevestig met het woord OVERGANG. Dit verplaatst ' + v.regels.length + ' leerling(en) naar een andere klas.' });
    let verplaatst = 0, verlaten = 0;
    for (const r of v.regels) {
      const l = eigenVeld(leerlingLijst(g.sch), r.leerlingId);
      if (!l || l.status !== 'ingeschreven') continue;
      const oud = eigenVeld(K(), l.klasCode || '');
      if (oud) oud.leerlingen = (oud.leerlingen || []).filter(x => x.sleutel !== l.sleutel);
      const nieuw = r.naar ? eigenVeld(K(), r.naar) : null;
      if (nieuw) {
        const sleutel = l.sleutel || 'L:' + l.id;
        l.sleutel = sleutel; l.klasCode = nieuw.code;
        if (!(nieuw.leerlingen || []).some(x => x.sleutel === sleutel))
          nieuw.leerlingen.push({ sleutel, gezinCode: l.gezinCode || null, profielId: l.profielId || null, naam: l.naam, at: nu(), leerlingId: l.id });
        verplaatst++;
      } else { l.klasCode = null; verlaten++; }
      l.overstappen = (l.overstappen || []).concat([{ at: nu(), van: { klas: r.van }, naar: { klas: r.naar || null }, reden: 'schooljaarovergang' }]).slice(-30);
    }
    v.uitgevoerd = true; v.uitgevoerdAt = nu();
    log(g.sch, g.p, 'schooljaarovergang', v.id, verplaatst + ' verplaatst, ' + verlaten + ' zonder vervolgklas');
    save();
    res.json({ ok: true, verplaatst, zonderVervolgklas: verlaten });
  });
};
