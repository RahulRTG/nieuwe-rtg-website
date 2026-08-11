/* RTG Werk OS (deellaag): klantenservice -- tickets, SLA en storingen.

   Een SLA is alleen zoveel waard als de eerlijkheid van zijn klok. Vier dingen
   staan daarom in de code:

   1. DE REACTIETIJD STOPT BIJ EEN MENS, NIET BIJ EEN ONTVANGSTBEVESTIGING.
      Een automatisch "wij hebben uw melding ontvangen" zet de klok hier niet
      stil; alleen een antwoord van een medewerker doet dat. Anders haalt elk
      systeem zijn eigen norm.
   2. EEN OVERSCHRIJDING WORDT GETOOND MET ZIJN GETAL, en verdwijnt niet als
      het ticket alsnog wordt opgelost. Wat te laat was, blijft te laat.
   3. SLUITEN VRAAGT EEN OPLOSSING. Een ticket dat dichtgaat met een leeg veld
      leert de organisatie niets en de klant al helemaal niet.
   4. EEN STORING BUNDELT TICKETS. Vijftig meldingen over hetzelfde zijn een
      storing en geen vijftig problemen; het ticket houdt zijn eigen klok, maar
      de evaluatie hangt aan de storing.

   Tevredenheid werkt zoals overal in dit huis: onder de vijf antwoorden staat
   er geen cijfer. Een gemiddelde uit twee antwoorden is geen gemiddelde. */
'use strict';

/* Statusovergangen lopen via de gebeurtenislaag, zodat de toestand van toen
   te reconstrueren is (./verloop.js). Zonder deze weg merkt het vangnet de
   wijziging alsnog op, maar dan zonder tijdstip en zonder naam. */
const { verloopZet } = require('./verloop');

const PRIO = {
  kritiek: { reactieMin: 15, oplosMin: 240 },
  hoog: { reactieMin: 60, oplosMin: 480 },
  normaal: { reactieMin: 240, oplosMin: 2880 },
  laag: { reactieMin: 1440, oplosMin: 10080 }
};
const MIN_ANTWOORDEN = 5;

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, werkPoort, log, eigenVeld } = sctx;

  const T = (w) => { if (!w.tickets) w.tickets = {}; return w.tickets; };
  const S = (w) => { if (!w.storingen) w.storingen = {}; return w.storingen; };
  const minuten = (van, tot) => Math.max(0, Math.round((Date.parse(tot || nu()) - Date.parse(van)) / 60000));

  /* De stand van de SLA: twee klokken, allebei met hun norm ernaast. Wat te
     laat was blijft te laat, ook als het ticket later netjes wordt opgelost. */
  function sla(t) {
    const n = PRIO[t.prioriteit];
    const reactie = t.eersteReactieAt ? minuten(t.at, t.eersteReactieAt) : minuten(t.at, null);
    const oplos = t.geslotenAt ? minuten(t.at, t.geslotenAt) : minuten(t.at, null);
    return {
      reactieMinuten: reactie, reactieNorm: n.reactieMin,
      reactieGehaald: t.eersteReactieAt ? reactie <= n.reactieMin : null,
      reactieOverschreden: Math.max(0, reactie - n.reactieMin),
      oplosMinuten: oplos, oplosNorm: n.oplosMin,
      oplosGehaald: t.geslotenAt ? oplos <= n.oplosMin : null,
      oplosOverschreden: Math.max(0, oplos - n.oplosMin),
      let: 'De reactieklok stopt bij een antwoord van een MENS; een ontvangstbevestiging zet hem niet stil.'
    };
  }

  app.post('/api/bedrijf/ticket/maak', (req, res) => {
    const g = werkPoort(req, res, 'service'); if (!g) return;
    const onderwerp = schoon(req.body.onderwerp, 120);
    if (!onderwerp) return res.status(400).json({ error: 'Waar gaat de melding over?' });
    const prioriteit = String(req.body.prioriteit || 'normaal');
    if (!PRIO[prioriteit]) return res.status(400).json({ error: 'Kies een prioriteit: ' + Object.keys(PRIO).join(', ') + '.' });
    const t = { id: rid(5), onderwerp, prioriteit,
      tekst: schoon(req.body.tekst, 4000) || null,
      klantId: schoon(req.body.klantId, 20) || null,
      melder: schoon(req.body.melder, 60) || null,
      status: 'open', storingId: null, reacties: [], eersteReactieAt: null,
      at: nu(), door: g.l.naam };
    const wie = sctx.zetWie(g.w, t, 'wie', schoon(req.body.wie, 60));
    T(g.w)[t.id] = t;
    save();
    res.json({ ok: true, ticket: t, sla: sla(t), normen: PRIO, wieLet: wie.reden });
  });

  /* Reageren. Een automatische bevestiging mag, maar hij zet de klok niet
     stil: `automatisch: true` telt niet als eerste reactie. */
  app.post('/api/bedrijf/ticket/reageer', (req, res) => {
    const g = werkPoort(req, res, 'service'); if (!g) return;
    const t = eigenVeld(T(g.w), String(req.body.ticketId || ''));
    if (!t) return res.status(404).json({ error: 'Dat ticket kennen we niet.' });
    const tekst = schoon(req.body.tekst, 4000);
    if (!tekst) return res.status(400).json({ error: 'Wat is het antwoord?' });
    const automatisch = req.body.automatisch === true;
    t.reacties.push({ id: rid(3), tekst, automatisch, door: automatisch ? 'systeem' : g.l.naam, at: nu() });
    if (!automatisch && !t.eersteReactieAt) t.eersteReactieAt = nu();
    save();
    res.json({ ok: true, reacties: t.reacties.length, sla: sla(t),
      let: automatisch ? 'Dit was een automatische bevestiging; de reactieklok loopt door tot een mens antwoordt.' : null });
  });

  app.post('/api/bedrijf/ticket/sluit', (req, res) => {
    const g = werkPoort(req, res, 'service'); if (!g) return;
    const t = eigenVeld(T(g.w), String(req.body.ticketId || ''));
    if (!t) return res.status(404).json({ error: 'Dat ticket kennen we niet.' });
    if (t.status === 'gesloten') return res.status(409).json({ error: 'Dit ticket is al gesloten.' });
    const oplossing = schoon(req.body.oplossing, 1000);
    if (!oplossing) return res.status(400).json({ error: 'Noteer hoe het is opgelost. Een ticket dat dichtgaat met een leeg veld leert niemand iets.' });
    verloopZet(g.w, 'ticket', t, 'status', 'gesloten', g.l.naam);
    t.oplossing = oplossing; t.geslotenAt = nu(); t.geslotenDoor = g.l.naam;
    log(g.w, g.l, 'ticket-gesloten', t.id, t.onderwerp);
    save();
    const s = sla(t);
    res.json({ ok: true, ticket: { id: t.id, status: t.status }, sla: s,
      let: s.oplosOverschreden ? 'Dit ticket stond ' + s.oplosOverschreden + ' minuten boven de norm. Dat blijft staan; wat te laat was, wordt niet alsnog op tijd.' : null });
  });

  sctx.startBron('service', 'service', (g) => {
    const mijn = Object.values(T(g.w)).filter(t => t.status !== 'gesloten' && (!t.wie || t.wie === g.l.naam));
    return { open: mijn.length,
      buitenNorm: mijn.filter(t => { const s = sla(t); return s.reactieOverschreden || s.oplosOverschreden; }).length };
  });

  return { PRIO, sla, MIN_ANTWOORDEN, TICKETS: T, STORINGEN: S, minuten };
};
