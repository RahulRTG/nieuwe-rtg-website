/* School (deelbestand): DE SCHOOLJAAROVERGANG.

   Het gevoeligste stuk van de schoolorganisatie, en daarom apart: in de meeste
   systemen is dit EEN knop die twaalfhonderd leerlingen een klas opschuift.
   Hier is het twee stappen, en die scheiding is de hele functie:

     voorstel   per ingeschreven leerling: van welke klas naar welke klas.
                Te lezen, na te kijken en te corrigeren voordat er iets
                gebeurt. Het voorstel kent de volgorde van de klassen NIET uit
                zichzelf -- die geeft de directie mee, want alleen de school
                weet of 3B naar 4A of naar 4B gaat. Wat niet in de lijst staat,
                blijft staan.
     voer-uit   loopt alleen op precies dat voorstel, en maar EEN keer. Zonder
                dat wordt dit een knop die je twee keer indrukt en waarna
                niemand meer weet waar de leerling vandaan kwam.

   Dezelfde regel als bij het overgaan zelf (kern/onderwijs.js): het systeem
   adviseert, een mens beslist. En alleen de directie -- een mentor die zijn
   eigen klas doorschuift is geen schooljaarovergang.

   Krijgt dezelfde sctx als ./organisatie.js. */
'use strict';

module.exports = (sctx) => {
  const { router, save, rid, nu, K, eigenVeld, poort, log, leerlingLijst } = sctx;

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
