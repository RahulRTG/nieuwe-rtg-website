/* RTG Werk OS (deellaag): storingen en het servicebeeld. Hoort bij
   bedrijf/service.js, dat de tickets en de SLA-klokken draagt.

   Twee dingen staan hier en niet daar, omdat ze over de GROEP meldingen gaan
   en niet over een enkele:

   1. EEN STORING BUNDELT TICKETS. Vijftig meldingen over hetzelfde zijn een
      storing en geen vijftig problemen. Elk ticket houdt zijn eigen klok --
      de klant heeft er niets aan dat wij het intern een storing noemen.
   2. EEN EVALUATIE NOEMT OORZAAK EN MAATREGEL. Zonder dat tweede is het een
      verslag, en een verslag voorkomt niets.

   In het servicebeeld staat wat BUITEN DE NORM viel met zijn getal, en dat
   blijft staan ook als het ticket later netjes is opgelost. Tevredenheid
   verschijnt pas vanaf vijf antwoorden; een gemiddelde uit twee antwoorden is
   geen gemiddelde. */
'use strict';

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, werkPoort, log, eigenVeld, PRIO, sla, MIN_ANTWOORDEN, T, S, minuten } = sctx;

  /* ---------- storingen ---------- */
  app.post('/api/bedrijf/storing/meld', (req, res) => {
    const g = werkPoort(req, res, 'service'); if (!g) return;
    const wat = schoon(req.body.wat, 200);
    if (!wat) return res.status(400).json({ error: 'Wat is er aan de hand?' });
    const s = { id: rid(5), wat, ernst: schoon(req.body.ernst, 20) || 'verstoring',
      begonnenAt: schoon(req.body.begonnen, 30) || nu(), opgelostAt: null,
      tickets: [], evaluatie: null, at: nu(), door: g.l.naam };
    S(g.w)[s.id] = s;
    log(g.w, g.l, 'storing-gemeld', s.id, wat);
    save();
    res.json({ ok: true, storing: s });
  });

  app.post('/api/bedrijf/storing/koppel', (req, res) => {
    const g = werkPoort(req, res, 'service'); if (!g) return;
    const s = eigenVeld(S(g.w), String(req.body.storingId || ''));
    const t = eigenVeld(T(g.w), String(req.body.ticketId || ''));
    if (!s || !t) return res.status(404).json({ error: 'Die storing of dat ticket kennen we niet.' });
    if (!s.tickets.includes(t.id)) s.tickets.push(t.id);
    t.storingId = s.id;
    save();
    res.json({ ok: true, storing: { id: s.id, tickets: s.tickets.length },
      let: 'Het ticket houdt zijn eigen klok; vijftig meldingen over hetzelfde zijn een storing en geen vijftig problemen.' });
  });

  app.post('/api/bedrijf/storing/evalueer', (req, res) => {
    const g = werkPoort(req, res, 'service'); if (!g) return;
    const s = eigenVeld(S(g.w), String(req.body.storingId || ''));
    if (!s) return res.status(404).json({ error: 'Die storing kennen we niet.' });
    const oorzaak = schoon(req.body.oorzaak, 600);
    const maatregel = schoon(req.body.maatregel, 600);
    if (!oorzaak || !maatregel)
      return res.status(400).json({ error: 'Een evaluatie noemt de oorzaak EN wat er is gedaan zodat het niet terugkomt. Zonder dat tweede is het een verslag.' });
    s.opgelostAt = s.opgelostAt || nu();
    s.evaluatie = { oorzaak, maatregel, door: g.l.naam, at: nu(),
      duurMinuten: minuten(s.begonnenAt, s.opgelostAt), geraakteTickets: s.tickets.length };
    log(g.w, g.l, 'storing-geevalueerd', s.id, oorzaak.slice(0, 60));
    save();
    res.json({ ok: true, storing: s });
  });

  /* ---------- het servicebeeld ---------- */
  app.post('/api/bedrijf/service/beeld', (req, res) => {
    const g = werkPoort(req, res, 'service'); if (!g) return;
    const alle = Object.values(T(g.w));
    const open = alle.filter(t => t.status !== 'gesloten');
    const gesloten = alle.filter(t => t.status === 'gesloten');
    const teLaat = alle.map(t => ({ t, s: sla(t) }))
      .filter(x => x.s.reactieOverschreden || x.s.oplosOverschreden);
    const cijfers = alle.map(t => t.tevredenheid).filter(x => typeof x === 'number');
    res.json({ ok: true,
      open: { aantal: open.length, perPrioriteit: Object.keys(PRIO).reduce((o, p) =>
        Object.assign(o, { [p]: open.filter(t => t.prioriteit === p).length }), {}) },
      gesloten: gesloten.length,
      buitenNorm: { aantal: teLaat.length, tickets: teLaat.slice(0, 20).map(x => ({ id: x.t.id,
        onderwerp: x.t.onderwerp, reactieOver: x.s.reactieOverschreden, oplosOver: x.s.oplosOverschreden })) },
      storingen: Object.values(S(g.w)).filter(s => !s.opgelostAt).length,
      tevredenheid: cijfers.length >= MIN_ANTWOORDEN
        ? { gemiddelde: Math.round(cijfers.reduce((a, b) => a + b, 0) / cijfers.length * 10) / 10, aantal: cijfers.length }
        : null,
      tevredenheidUitleg: cijfers.length >= MIN_ANTWOORDEN ? null
        : 'Nog ' + (MIN_ANTWOORDEN - cijfers.length) + ' antwoord(en) nodig voor een cijfer; een gemiddelde uit ' + cijfers.length + ' antwoord(en) is geen gemiddelde.',
      normen: PRIO });
  });

  app.post('/api/bedrijf/ticket/waardeer', (req, res) => {
    const g = werkPoort(req, res, 'service'); if (!g) return;
    const t = eigenVeld(T(g.w), String(req.body.ticketId || ''));
    if (!t) return res.status(404).json({ error: 'Dat ticket kennen we niet.' });
    if (t.status !== 'gesloten') return res.status(409).json({ error: 'Waarderen kan pas als het ticket gesloten is.' });
    const cijfer = Math.round(Number(req.body.cijfer) || 0);
    if (cijfer < 1 || cijfer > 5) return res.status(400).json({ error: 'Geef een cijfer van 1 tot en met 5.' });
    t.tevredenheid = cijfer;
    t.tevredenheidAt = nu();
    save();
    res.json({ ok: true, ticket: { id: t.id, tevredenheid: cijfer } });
  });
};
