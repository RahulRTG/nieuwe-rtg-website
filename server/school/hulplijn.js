/* School (deelmodule), golf 4: de hulplijn -- veiligheid van het kind als
   EEN keten tussen school en RTFoundation, zonder surveillance.

   De regels die dit deel dragen:
   1. EEN KNOP VAN HET KIND ZELF. Alleen het kind start de hulplijn; niemand
      kan namens het kind om hulp "vragen" en niemand volgt het kind.
   2. TOESTEMMING BEPAALT WIE MEELEEST. Standaard zien de ouders de melding
      gewoon mee (zoals alles op school). Zet het kind hem op VERTROUWELIJK,
      dan ziet alleen de mentor hem: de wettelijke vertrouwenspersoon-route,
      juist voor als het thuis niet veilig is. Het kind ziet zijn eigen
      meldingen altijd, en de app zegt vooraf eerlijk wie wat ziet.
   3. GEEN SURVEILLANCE. Er is geen locatie, geen meelezen, geen logboek
      van kindgedrag; alleen wat het kind zelf op de knop zet. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, eigenVeld, K, klasVan, gezinSessie, leerlingVan } = sctx;

  const lijst = (k) => { if (!Array.isArray(k.hulplijn)) k.hulplijn = []; return k.hulplijn; };

  // de ene knop: alleen het kind zelf, in de eigen klas
  router.post('/school/hulplijn', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    const l = k && leerlingVan(k, s.g, s.p.id);
    if (!l) return res.status(403).json({ error: 'De hulplijn is van het kind zelf: open hem vanuit je eigen klas.' });
    const vertrouwelijk = req.body.vertrouwelijk === true;
    const m = { id: rid(4), sleutel: l.sleutel, naam: l.naam,
      tekst: schoon(req.body.tekst, 500) || 'Ik wil graag even met je praten.',
      vertrouwelijk, acuut: req.body.acuut === true, status: 'open', at: nu() };
    lijst(k).unshift(m); k.hulplijn = k.hulplijn.slice(0, 200);
    save();
    res.json({ ok: true, melding: { id: m.id, vertrouwelijk: m.vertrouwelijk, acuut: m.acuut },
      wieZietDit: vertrouwelijk
        ? 'Alleen je mentor ziet dit. Jij bepaalt zelf wat je vertelt en wanneer.'
        : 'Je mentor ziet dit, en je ouders kunnen het ook zien.' });
  });

  // de mentor: acuut bovenaan, dan de rest; oppakken met een notitie
  router.post('/school/hulplijn/klas', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const open = lijst(k).slice().sort((a, b) => (b.acuut ? 1 : 0) - (a.acuut ? 1 : 0));
    res.json({ ok: true, meldingen: open.map(m => ({ id: m.id, naam: m.naam, tekst: m.tekst,
      vertrouwelijk: m.vertrouwelijk, acuut: m.acuut, status: m.status, at: m.at, notitie: m.notitie || null })) });
  });

  router.post('/school/hulplijn/oppakken', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const m = lijst(k).find(x => x.id === String(req.body.id || ''));
    if (!m) return res.status(404).json({ error: 'Melding niet gevonden.' });
    /* Oppakken IS "gezien" in de keten van No-Lost-Child: hier stopt de klok
       die bewaakt of er uberhaupt iemand heeft gekeken. Het blijft een aparte
       stap van afronden -- kijken is niet hetzelfde als klaar. */
    m.status = 'opgepakt'; m.notitie = schoon(req.body.notitie, 300) || null; m.opgepaktAt = nu();
    m.gezienAt = m.gezienAt || m.opgepaktAt;
    save();
    res.json({ ok: true, volgende: 'Spreek af wanneer en met wie, of rond het af.' });
  });

  /* het gezin: ouders zien de gewone meldingen van hun kinderen mee;
     VERTROUWELIJKE meldingen ziet alleen het kind zelf terug. Dat is een
     bewuste uitzondering op "de ouder kijkt standaard mee": de
     vertrouwenspersoon-route moet ook werken als het thuis niet veilig is. */
  router.post('/school/hulplijn/mijn', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const mijnIds = s.beheerder ? Object.keys(s.g.profielen) : [s.p.id];
    const eigenSleutel = s.g.code + ':' + s.p.id;
    const mijn = lijst(k).filter(m => {
      const [gz, pid] = String(m.sleutel).split(':');
      if (gz !== s.g.code || !mijnIds.includes(pid)) return false;
      if (m.vertrouwelijk && m.sleutel !== eigenSleutel) return false; // alleen het kind zelf
      return true;
    });
    res.json({ ok: true, meldingen: mijn.map(m => ({ id: m.id, naam: m.naam, tekst: m.tekst,
      vertrouwelijk: m.vertrouwelijk, acuut: m.acuut, status: m.status, at: m.at })) });
  });
};
