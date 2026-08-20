/* School (deelmodule): rapporten en studievoortgang.

   Het rapport is het document waar alles samenkomt, en precies daarom staat
   hier de strengste regel van de hele enterprise-laag:

   EEN RAPPORT WORDT DOOR EEN MENS VASTGESTELD. De motor rekent de cijfers uit,
   de AI mag een CONCEPTTEKST schrijven, maar niets daarvan bereikt het gezin
   voordat een leraar of mentor het heeft gelezen en vastgesteld. Een concept
   staat in de eigen werkbank; `/school/rapport/mijn` (de gezinskant) toont
   alleen wat is vastgesteld. Dat is geen instelling die je aan kunt zetten --
   er is geen route die publiceert zonder vaststelling.

   De AI-tekst is bovendien altijd gemarkeerd als concept met de bron erbij, en
   zonder AI-sleutel komt er geen verzonnen tekst maar een feitelijke opzet uit
   de cijfers zelf. Zo staat er nooit iets in het rapport van een kind wat
   niemand heeft nagekeken. */
const { maakAI } = require('../ai');
const { tekst: aiTekst } = require('../ai-kort');

module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, eigenVeld, poort, log, gezinSessie, gemiddelde } = sctx;

  const R = (sch) => { if (!sch.rapporten) sch.rapporten = []; return sch.rapporten; };
  const gem = (cijfers) => (gemiddelde ? gemiddelde(cijfers) : null);

  // per vak de cijfers en het gewogen gemiddelde van een leerling
  function perVak(k, sleutel) {
    const uit = {};
    for (const c of (k.cijfers || []).filter(x => x.leerling === sleutel)) {
      const vak = c.vak || 'algemeen';
      (uit[vak] || (uit[vak] = [])).push(c);
    }
    return Object.entries(uit).map(([vak, cijfers]) => ({ vak, aantal: cijfers.length, gemiddelde: gem(cijfers),
      cijfers: cijfers.map(c => ({ cijfer: c.cijfer, weging: c.weging || 1, omschrijving: c.omschrijving, at: c.at })) }))
      .sort((a, b) => a.vak.localeCompare(b.vak));
  }

  /* ---------- het rapport klaarzetten ----------
     Een periode, een klas: voor elke leerling een concept met de cijfers, de
     aanwezigheid en een leeg tekstvak. Niets gaat de deur uit. */
  router.post('/school/rapport/maak', (req, res) => {
    const g = poort(req, res, 'leerling'); if (!g) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k || k.schoolCode !== g.sch.code) return res.status(404).json({ error: 'Die klas hoort niet bij deze school.' });
    const periode = schoon(req.body.periode, 30);
    if (!periode) return res.status(400).json({ error: 'Welke periode is dit rapport? (bijvoorbeeld "Periode 2" of "2026-2027 T1")' });
    const bestaand = R(g.sch).find(r => r.klasCode === k.code && r.periode === periode);
    if (bestaand && bestaand.vastgesteld) return res.status(409).json({ error: 'Dit rapport is al vastgesteld; maak een nieuwe periode aan.' });
    const presentie = (g.sch.presentie || []).filter(l => l.klasCode === k.code);
    const rap = bestaand || { id: rid(6), klasCode: k.code, klas: k.naam, periode, at: nu(), door: g.p.naam, vastgesteld: false, leerlingen: [] };
    rap.leerlingen = (k.leerlingen || []).map(l => {
      const oud = (rap.leerlingen || []).find(x => x.sleutel === l.sleutel) || {};
      let lessen = 0, gemist = 0, telaat = 0;
      for (const les of presentie) for (const r of les.regels) if (r.leerling === l.sleutel) {
        lessen++;
        if (r.stand === 'afwezig' || r.stand === 'ziek') gemist++;
        if (r.stand === 'telaat') telaat++;
      }
      return { sleutel: l.sleutel, naam: l.naam, gezinCode: l.gezinCode || null,
        vakken: perVak(k, l.sleutel), gemiddelde: gem((k.cijfers || []).filter(c => c.leerling === l.sleutel)),
        aanwezigheid: { lessen, gemist, telaat },
        tekst: oud.tekst || null, tekstBron: oud.tekstBron || null };
    });
    if (!bestaand) R(g.sch).unshift(rap);
    g.sch.rapporten = R(g.sch).slice(0, 2000);
    save();
    res.json({ ok: true, rapport: { id: rap.id, klas: rap.klas, periode: rap.periode, leerlingen: rap.leerlingen.length, vastgesteld: false },
      uitleg: 'Dit is een concept. Het gezin ziet het pas als u het vaststelt.' });
  });

  router.post('/school/rapport/lijst', (req, res) => {
    const g = poort(req, res, 'leerling'); if (!g) return;
    const rap = R(g.sch).find(r => r.id === String(req.body.rapportId || ''));
    if (req.body.rapportId && !rap) return res.status(404).json({ error: 'Dat rapport kennen we niet.' });
    if (rap) return res.json({ ok: true, rapport: rap });
    res.json({ ok: true, rapporten: R(g.sch).map(r => ({ id: r.id, klas: r.klas, periode: r.periode, at: r.at,
      leerlingen: (r.leerlingen || []).length, vastgesteld: !!r.vastgesteld, vastgesteldAt: r.vastgesteldAt || null })) });
  });

  return { rapporten: R, perVak };
};
