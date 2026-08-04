/* School (deelmodule): het machtigingenregister -- wie heeft getekend voor
   automatische incasso, voor welk maximum, en tot wanneer.

   Dit is met opzet de HALVE stap, en dat is een besluit en geen tekortkoming.
   Er is hier GEEN incasso-run: er wordt niets geïnd, niets afgeschreven en
   niets "verwerkt". Een school die dat wel wil, heeft een contract met een
   bank of betaaldienst nodig; software kan dat niet vervangen, en doen alsof
   breekt de regel die overal in dit huis geldt -- nooit claimen dat een
   boeking daadwerkelijk is verwerkt. Elk antwoord zegt dat zelf met
   `geindNu: false`.

   Wat het register wél doet, en wat een school echt nodig heeft:

   - WAT ER GETEKEND IS, staat vast: houder, kenmerk, maximum, frequentie, de
     datum en het kanaal (papier, in de app, aan de balie). Zonder maximum geen
     machtiging -- een open volmacht is geen toestemming maar een blanco cheque.
   - HET VOLLEDIGE REKENINGNUMMER STAAT ER NIET IN. Alleen de laatste vier
     cijfers, want we innen niet, dus hebben we de rest niet nodig. Zodra er
     een echte betaaldienst achter hangt, hoort dat nummer daar te liggen en
     niet hier (dataminimalisatie is geen instelling maar een ontwerp).
   - INTREKKEN KAN ALTIJD, door de school EN door het gezin zelf, zonder reden
     en per direct. Een machtiging die je alleen telefonisch kunt stoppen, is
     precies het patroon waar mensen boos over worden. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, eigenVeld, poort, log, gezinSessie, leerlingLijst } = sctx;

  const M = (sch) => { if (!sch.machtigingen) sch.machtigingen = []; return sch.machtigingen; };
  const FREQ = ['eenmalig', 'maandelijks', 'per periode', 'per schooljaar'];
  const NOOIT = { geindNu: false,
    uitleg: 'RTG School int niets. Dit register legt vast wat er is getekend; het afschrijven gebeurt bij de bank of betaaldienst van de school.' };

  const publiek = (m) => ({ id: m.id, kenmerk: m.kenmerk, leerlingId: m.leerlingId, houder: m.houder,
    ibanEinde: m.ibanEinde, bank: m.bank, maxCenten: m.maxCenten, frequentie: m.frequentie,
    getekendOp: m.getekendOp, kanaal: m.kanaal, actief: m.actief, ingetrokkenAt: m.ingetrokkenAt || null,
    ingetrokkenDoor: m.ingetrokkenDoor || null });

  // de geldige machtiging van een leerling (of null). Ook door financien.js
  // gebruikt, zodat "mag dit geïncasseerd worden" op één plek wordt beantwoord.
  function actief(sch, leerlingId) {
    return M(sch).find(m => m.leerlingId === String(leerlingId || '') && m.actief) || null;
  }
  sctx.machtigingActief = actief;

  router.post('/school/machtiging/zet', (req, res) => {
    const g = poort(req, res, 'financieel'); if (!g) return;
    const l = eigenVeld(leerlingLijst(g.sch), req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const houder = schoon(req.body.houder, 80);
    if (!houder) return res.status(400).json({ error: 'Op wiens naam staat de rekening?' });
    const einde = String(req.body.ibanEinde || '').replace(/\s/g, '').slice(-4);
    if (!/^[0-9A-Za-z]{4}$/.test(einde)) return res.status(400).json({ error: 'Geef de laatste vier tekens van het rekeningnummer. Het volledige nummer bewaren we niet: er wordt hier niets geïnd.' });
    const maxCenten = Math.round(Math.max(0, Math.min(1000000, Number(req.body.max) || 0)) * 100);
    if (!maxCenten) return res.status(400).json({ error: 'Noteer het maximumbedrag per incasso. Een machtiging zonder maximum is een blanco cheque.' });
    const frequentie = String(req.body.frequentie || 'maandelijks');
    if (!FREQ.includes(frequentie)) return res.status(400).json({ error: 'Kies een frequentie: ' + FREQ.join(', ') + '.' });
    const m = { id: rid(6), kenmerk: 'M' + String(M(g.sch).length + 1).padStart(5, '0'),
      leerlingId: l.id, houder, ibanEinde: einde, bank: schoon(req.body.bank, 60) || null,
      maxCenten, frequentie, getekendOp: schoon(req.body.getekendOp, 10) || nu().slice(0, 10),
      kanaal: schoon(req.body.kanaal, 30) || 'papier', actief: true, at: nu(), door: g.p.naam };
    // een tweede machtiging vervangt de eerste: twee geldige naast elkaar is
    // precies hoe iemand twee keer wordt afgeschreven
    for (const oud of M(g.sch)) if (oud.leerlingId === l.id && oud.actief) {
      oud.actief = false; oud.ingetrokkenAt = nu(); oud.ingetrokkenDoor = 'vervangen door ' + m.kenmerk;
    }
    M(g.sch).unshift(m); g.sch.machtigingen = M(g.sch).slice(0, 20000);
    log(g.sch, g.p, 'machtiging-gezet', l.id, m.kenmerk + ', max ' + (maxCenten / 100).toFixed(2));
    save();
    res.json(Object.assign({ ok: true, machtiging: publiek(m) }, NOOIT));
  });

  router.post('/school/machtiging/lijst', (req, res) => {
    const g = poort(req, res, 'financieel.lees'); if (!g) return;
    const alleen = req.body.actief === true;
    const rijen = M(g.sch).filter(m => !alleen || m.actief).slice(0, 500).map(publiek);
    res.json(Object.assign({ ok: true, aantal: rijen.length,
      actief: M(g.sch).filter(m => m.actief).length, machtigingen: rijen }, NOOIT));
  });

  // intrekken door de school
  router.post('/school/machtiging/intrek', (req, res) => {
    const g = poort(req, res, 'financieel'); if (!g) return;
    const m = M(g.sch).find(x => x.id === String(req.body.machtigingId || ''));
    if (!m) return res.status(404).json({ error: 'Die machtiging kennen we niet.' });
    if (!m.actief) return res.status(409).json({ error: 'Deze machtiging is al ingetrokken.' });
    m.actief = false; m.ingetrokkenAt = nu(); m.ingetrokkenDoor = g.p.naam;
    log(g.sch, g.p, 'machtiging-ingetrokken', m.leerlingId, m.kenmerk);
    save();
    res.json(Object.assign({ ok: true, machtiging: publiek(m) }, NOOIT));
  });

  /* ---------- de gezinskant ----------
     Zien wat er over je is getekend, en het zelf stoppen. Zonder reden en per
     direct: dat is het verschil tussen een machtiging en een val. */
  router.post('/school/machtiging/mijn', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    if (!s.beheerder) return res.status(403).json({ error: 'Machtigingen regelt een ouder of verzorger.' });
    const uit = [];
    for (const sch of Object.values(sctx.S())) {
      const mijn = Object.values(sch.leerlingen || {}).filter(l => l.gezinCode === s.g.code).map(l => l.id);
      for (const m of M(sch)) if (mijn.includes(m.leerlingId))
        uit.push(Object.assign({ school: sch.naam, schoolCode: sch.code }, publiek(m)));
    }
    res.json(Object.assign({ ok: true, machtigingen: uit.slice(0, 50) }, NOOIT));
  });

  router.post('/school/machtiging/stop', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    if (!s.beheerder) return res.status(403).json({ error: 'Machtigingen regelt een ouder of verzorger.' });
    for (const sch of Object.values(sctx.S())) {
      const m = M(sch).find(x => x.id === String(req.body.machtigingId || ''));
      if (!m) continue;
      const l = eigenVeld(sch.leerlingen || {}, m.leerlingId);
      if (!l || l.gezinCode !== s.g.code) return res.status(403).json({ error: 'Deze machtiging hoort niet bij uw gezin.' });
      if (!m.actief) return res.status(409).json({ error: 'Deze machtiging is al gestopt.' });
      m.actief = false; m.ingetrokkenAt = nu(); m.ingetrokkenDoor = 'het gezin zelf';
      log(sch, { naam: 'het gezin', rollen: [] }, 'machtiging-ingetrokken', m.leerlingId, m.kenmerk + ' door het gezin');
      save();
      return res.json(Object.assign({ ok: true, machtiging: publiek(m),
        let: 'Gestopt. De school ziet dit meteen; er hoeft niemand gebeld te worden.' }, NOOIT));
    }
    res.status(404).json({ error: 'Die machtiging kennen we niet.' });
  });

  return { machtigingActief: actief, MACHTIGING_NOOIT: NOOIT };
};
