/* School (deelmodule): uitschrijven en overstappen. Hoort bij
   school/inschrijving.js (aanmelding, wachtlijst, plaatsing), dat de
   leerlingenlijst via de context meegeeft.

   UITSCHRIJVEN WIST NIET. De leerling gaat uit de klas en de toegang gaat
   dicht, maar het dossier blijft staan met een einddatum -- een school moet
   jaren later nog een diploma kunnen bevestigen. Wat wanneer echt weg mag,
   hoort bij de bewaartermijnen (server/bewaartermijnen.js) en niet bij een
   knop in de administratie.

   Een overstap laat een SPOOR na: van welke klas of vestiging naar welke. Dat
   is precies wat een school later nodig heeft en wat in de meeste systemen
   verdwijnt zodra iemand een veld overschrijft. */
module.exports = (sctx) => {
  const { router, save, nu, schoon, K, eigenVeld, poort, log, meld, leerlingLijst: L, leerlingKort: kort, leerlingSleutel } = sctx;

  /* ---------- uitschrijven ----------
     Uit de klas, toegang dicht, dossier blijft. De reden is verplicht: een
     uitschrijving zonder reden is later niet meer uit te leggen. */
  router.post('/school/leerling/uitschrijf', (req, res) => {
    const g = poort(req, res, 'leerling.schrijf'); if (!g) return;
    const l = eigenVeld(L(g.sch), req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const reden = schoon(req.body.reden, 200);
    if (!reden) return res.status(400).json({ error: 'Noteer waarom de leerling wordt uitgeschreven (verhuizing, overstap, einde opleiding).' });
    const k = l.klasCode ? eigenVeld(K(), l.klasCode) : null;
    if (k) k.leerlingen = (k.leerlingen || []).filter(x => x.sleutel !== l.sleutel);
    l.status = 'uitgeschreven'; l.uitgeschrevenAt = nu(); l.reden = reden; l.klasCode = null; l.toegang = 'gesloten';
    log(g.sch, g.p, 'leerling-uitgeschreven', l.id, reden);
    save();
    meld(g.sch, 'leerling.uitgeschreven', { leerlingId: l.id });
    res.json({ ok: true, leerling: kort(l),
      uitleg: 'De toegang is gesloten en de leerling staat uit de klas. Het dossier blijft bewaard volgens de bewaartermijnen; het wordt hier niet gewist.' });
  });

  /* ---------- overstap ----------
     Tussen klassen, vestigingen of scholen. De overstap staat als regel in het
     dossier, want "waar kwam dit kind vandaan" is precies wat een school later
     nodig heeft -- en wat in de meeste systemen verdwijnt. */
  router.post('/school/leerling/overstap', (req, res) => {
    const g = poort(req, res, 'leerling.schrijf'); if (!g) return;
    const l = eigenVeld(L(g.sch), req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const naarKlas = String(req.body.naarKlas || '').trim().toUpperCase();
    const naarVestiging = schoon(req.body.naarVestiging, 20);
    const k = naarKlas ? eigenVeld(K(), naarKlas) : null;
    if (naarKlas && (!k || k.schoolCode !== g.sch.code)) return res.status(404).json({ error: 'Die klas hoort niet bij deze school.' });
    const oud = eigenVeld(K(), l.klasCode || '');
    if (oud) oud.leerlingen = (oud.leerlingen || []).filter(x => x.sleutel !== l.sleutel);
    const van = { klas: l.klasCode || null, vestiging: l.vestiging || null };
    if (k) {
      l.klasCode = k.code;
      const sleutel = l.sleutel || (l.gezinCode && l.profielId ? leerlingSleutel(l.gezinCode, l.profielId) : 'L:' + l.id);
      l.sleutel = sleutel;
      if (!(k.leerlingen || []).some(x => x.sleutel === sleutel))
        k.leerlingen.push({ sleutel, gezinCode: l.gezinCode || null, profielId: l.profielId || null, naam: l.naam, at: nu(), leerlingId: l.id });
    }
    if (naarVestiging) l.vestiging = naarVestiging;
    l.overstappen = (l.overstappen || []).concat([{ at: nu(), van, naar: { klas: l.klasCode, vestiging: l.vestiging }, reden: schoon(req.body.reden, 160) || null }]).slice(-30);
    log(g.sch, g.p, 'leerling-overstap', l.id, 'van ' + (van.klas || '-') + ' naar ' + (l.klasCode || '-'));
    save();
    meld(g.sch, 'leerling.overstap', { leerlingId: l.id, van: van.klas || null, naar: l.klasCode || null });
    res.json({ ok: true, leerling: kort(l), overstappen: l.overstappen });
  });
};
