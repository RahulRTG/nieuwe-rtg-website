/* School (deelmodule): de tevredenheidspeiling. Tot deze ronde stond
   `tevredenheid: null` op het dashboard met de reden erbij -- we maten het
   nergens, dus verzonnen we het ook niet. Dit bestand meet het, en doet dat op
   de enige manier die eerlijk is.

   Vier regels, en ze zijn geen van alle cosmetisch:

   1. ECHT ANONIEM. Van een antwoord wordt alleen de score bewaard. Om te
      voorkomen dat iemand tien keer stemt, gaat de deelnemer door een hash met
      het geheim van de school erin; die hash zegt DAT er geantwoord is, en
      staat los van het antwoord zelf. Er is dus geen enkele weg terug van een
      score naar een gezin.
   2. GEEN VRIJE TEKST. Een open opmerking is de snelste manier om een anonieme
      peiling alsnog herleidbaar te maken -- aan de inhoud, aan de schrijfstijl,
      aan wie er die week iets meemaakte. Wie iets wil zeggen, heeft de
      berichtenlijn met de leraar; die is niet anoniem en hoort dat ook niet te
      zijn.
   3. EEN ONDERGRENS VOOR DE UITSLAG. Onder de vijf antwoorden komt er geen
      cijfer uit, alleen "nog te weinig antwoorden". In een klas van acht is
      "anoniem" met drie antwoorden een leugen.
   4. GEEN CIJFER PER DOCENT. De stellingen gaan over de school en het
      onderwijs; er is geen veld om een medewerker aan een score te hangen. Dat
      is bewust, want zo'n cijfer wordt binnen een jaar een beoordeling. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, crypto, K, eigenVeld, poort } = sctx;

  const MIN_ANTWOORDEN = 5;
  const DOELGROEPEN = ['ouders', 'leerlingen', 'personeel'];
  const P = (sch) => { if (!sch.peilingen) sch.peilingen = []; return sch.peilingen; };
  const merk = (sch, p, wie) => crypto.createHash('sha256').update(String(sch.token) + ':' + p.id + ':' + wie).digest('hex').slice(0, 24);

  function uitslag(p) {
    const n = p.antwoorden.length;
    if (n < MIN_ANTWOORDEN) return { aantal: n, genoeg: false, gemiddelde: null,
      let: 'Nog te weinig antwoorden (' + n + ' van ' + MIN_ANTWOORDEN + '). Onder die grens is een uitslag niet anoniem.' };
    const per = p.stellingen.map((s, i) => {
      const scores = p.antwoorden.map(a => a.scores[i]).filter(x => x >= 1 && x <= 5);
      const som = scores.reduce((t, x) => t + x, 0);
      return { stelling: s, aantal: scores.length, gemiddelde: scores.length ? Math.round((som / scores.length) * 10) / 10 : null };
    });
    const alle = per.filter(x => x.gemiddelde != null);
    return { aantal: n, genoeg: true, stellingen: per,
      gemiddelde: alle.length ? Math.round((alle.reduce((t, x) => t + x.gemiddelde, 0) / alle.length) * 10) / 10 : null };
  }

  // het dashboardbeeld: de laatste peiling met genoeg antwoorden, of niets
  sctx.peilingBeeld = function peilingBeeld(sch) {
    for (const p of P(sch)) {
      const u = uitslag(p);
      if (u.genoeg) return { titel: p.titel, doelgroep: p.doelgroep, gemiddelde: u.gemiddelde, aantal: u.aantal, schaal: '1-5' };
    }
    return null;
  };

  /* ---------- een peiling uitzetten ---------- */
  router.post('/school/peiling/maak', (req, res) => {
    const g = poort(req, res, 'analyse'); if (!g) return;
    const titel = schoon(req.body.titel, 100);
    if (!titel) return res.status(400).json({ error: 'Geef de peiling een titel.' });
    const stellingen = (Array.isArray(req.body.stellingen) ? req.body.stellingen : [])
      .slice(0, 8).map(s => schoon(s, 160)).filter(Boolean);
    if (!stellingen.length) return res.status(400).json({ error: 'Geef minstens een stelling; iedereen antwoordt met 1 tot en met 5.' });
    const doelgroep = String(req.body.doelgroep || 'ouders');
    if (!DOELGROEPEN.includes(doelgroep)) return res.status(400).json({ error: 'Kies een doelgroep: ' + DOELGROEPEN.join(', ') + '.' });
    const klasCode = String(req.body.klasCode || '').trim().toUpperCase();
    const k = klasCode ? eigenVeld(K(), klasCode) : null;
    if (klasCode && (!k || k.schoolCode !== g.sch.code)) return res.status(404).json({ error: 'Die klas hoort niet bij deze school.' });
    const p = { id: rid(5), titel, stellingen, doelgroep, klasCode: k ? k.code : null,
      tot: schoon(req.body.tot, 10) || null, open: true, at: nu(), door: g.p.naam, antwoorden: [], merken: [] };
    P(g.sch).unshift(p); g.sch.peilingen = P(g.sch).slice(0, 200);
    save();
    res.json({ ok: true, peiling: { id: p.id, titel: p.titel, stellingen: p.stellingen, doelgroep: p.doelgroep, klasCode: p.klasCode },
      uitleg: 'Antwoorden zijn anoniem: alleen de scores worden bewaard. Vanaf ' + MIN_ANTWOORDEN + ' antwoorden komt er een uitslag.' });
  });

  router.post('/school/peiling/sluit', (req, res) => {
    const g = poort(req, res, 'analyse'); if (!g) return;
    const p = P(g.sch).find(x => x.id === String(req.body.peilingId || ''));
    if (!p) return res.status(404).json({ error: 'Die peiling kennen we niet.' });
    p.open = false; p.geslotenAt = nu();
    save();
    res.json({ ok: true, peiling: { id: p.id, open: false }, uitslag: uitslag(p) });
  });

  router.post('/school/peiling/uitslag', (req, res) => {
    const g = poort(req, res, 'analyse'); if (!g) return;
    const p = P(g.sch).find(x => x.id === String(req.body.peilingId || ''));
    if (req.body.peilingId && !p) return res.status(404).json({ error: 'Die peiling kennen we niet.' });
    if (p) return res.json({ ok: true, titel: p.titel, doelgroep: p.doelgroep, open: p.open,
      uitslag: uitslag(p), minimum: MIN_ANTWOORDEN,
      let: 'Geen scores per medewerker: de stellingen gaan over de school.' });
    res.json({ ok: true, peilingen: P(g.sch).map(x => ({ id: x.id, titel: x.titel, doelgroep: x.doelgroep,
      open: x.open, klasCode: x.klasCode, antwoorden: x.antwoorden.length, genoeg: x.antwoorden.length >= MIN_ANTWOORDEN })) });
  });

  return { peilingUitslag: uitslag, MIN_ANTWOORDEN, peilingLijst: P, peilingMerk: merk };
};
