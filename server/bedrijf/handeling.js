/* ============================================================================
   RTG Werk OS (deellaag): HANDELEN VIA DE COMMANDOBALK -- met een bon.

   Tot hier mocht de balk zoeken en openen. Handelen mocht hij niet, en de reden
   die daarbij stond was juist: een machine die zelf iets verandert in een
   werksysteem heeft een actiebon en een bevestigingsmodel nodig. Dit bestand
   is die twee.

   DE KETEN, EN ER WORDT GEEN SCHAKEL OVERGESLAGEN

     bedoeling -> plan -> geraakte objecten -> rechtencontrole -> BEVESTIGING
     door een mens -> uitvoering -> actiebon

   VIJF REGELS DIE HIER NIET TE OMZEILEN ZIJN

   1. PLANNEN VERANDERT NIETS. `/plan` leest, rekent en legt een voornemen weg;
      er komt geen taak, geen ticket en geen artikel uit. Dat is te toetsen met
      een vingerafdruk voor en na, en dat gebeurt ook.

   2. BEVESTIGEN DOET DE MENS. Een plan draagt een geheim dat één keer wordt
      getoond; zonder dat geheim voert `/doe` niets uit. Dit is dezelfde regel
      als in LIFE.md: samenstellen en klaarzetten mag een machine, bevestigen
      niet.

   3. HET RECHT WORDT BIJ DE UITVOERING OPNIEUW GEREKEND. Niet alleen bij het
      plan. Anders is een plan dat om tien uur is gemaakt om elf uur nog
      uitvoerbaar terwijl de rol om half elf is ingetrokken -- en dan is een
      tijdelijke rol een permanente.

   4. EEN PLAN IS VAN EEN PERSOON EN VOOR EEN KEER. Het geheim van een ander
      lid werkt niet, en een tweede uitvoering ook niet.

   5. DE BEDOELING WORDT MET REGELS GELEZEN EN NIET MET EEN MODEL. CLAUDE.md
      zegt het al: controleerbare extractie gebruikt geen model. Wat de zeef
      niet begrijpt, wordt geen plan -- er komt dan een eerlijk "dit begrijp ik
      niet" in plaats van een gok die iemand bevestigt omdat er een knop staat.
   ========================================================================== */
'use strict';
const { nu: klokNu } = require('../lib/klok');

const { veiligGelijk } = require('../kern/util');

const GELDIG_MS = 10 * 60 * 1000;      // een voornemen is tien minuten houdbaar
const MAX_BONNEN = 5000;

/* De tabel met werkwoorden staat in ./handeling-lijst.js -- wie er een bijzet
   wil in een blik zien wat er al is, en dit bestand ging met de tabel erin over
   de 10 kB van keuringsregel 13. Zelfde splitsing als rollen/rollen-register. */
const { HANDELINGEN } = require('./handeling-lijst');

module.exports = (sctx) => {
  /* BEVOEGDHEID GROEIT NOOIT (VERTROUWEN.md laag 4): loopt het gedeclareerde
     recht uit de pas met wat een werkwoord RAAKT, dan controleert de
     rechtencontrole hieronder keurig het verkeerde recht. Constante tabel, dus
     bij het opstarten -- en hij gooit. Zie kern/vertrouwen/insluiting.js. */
  require('../kern/vertrouwen/insluiting').eisTabel(HANDELINGEN);

  const { app, save, schoon, nu, rid, crypto, werkPoort, eigenVeld } = sctx;

  const P = (w) => { if (!w.handelplannen) w.handelplannen = {}; return w.handelplannen; };
  const B = (w) => { if (!w.actiebonnen) w.actiebonnen = []; return w.actiebonnen; };

  /* Verlopen voornemens opruimen bij elke aanraking. Een plannenlijst die
     alleen groeit, is een lijst met geheimen die niemand meer bekijkt. */
  function veeg(w) {
    const p = P(w);
    const grens = klokNu() - GELDIG_MS;
    for (const id of Object.keys(p)) if (Date.parse(p[id].at) < grens) delete p[id];
  }

  /* De zeef. Geeft de eerste handeling die past, of niets. Bewust geen
     "de beste gok": een bijna-treffer die iemand bevestigt omdat er nu eenmaal
     een knop staat, is erger dan geen voorstel. */
  function lees(bedoeling) {
    const t = String(bedoeling || '').trim();
    for (const [id, h] of Object.entries(HANDELINGEN)) {
      for (const re of h.zeef) {
        const m = re.exec(t);
        if (m) return { id, h, velden: h.velden(m) };
      }
    }
    return null;
  }

  /* ---------- 1. het plan ---------- */
  app.post('/api/bedrijf/handeling/plan', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    veeg(g.w);
    const bedoeling = schoon(req.body.bedoeling, 300);
    if (!bedoeling) return res.status(400).json({ error: 'Wat wilt u dat er gebeurt?' });

    const gelezen = lees(bedoeling);
    if (!gelezen) {
      return res.json({ ok: true, plan: null,
        let: 'Dit begrijp ik niet als een handeling, dus ik stel er geen voor. Wat ik wel kan: ' +
          Object.values(HANDELINGEN).map(h => h.wat).join(', ') + '. Zoeken kan altijd.' });
    }

    /* De rechtencontrole hoort BIJ HET PLAN te staan en niet pas bij de
       uitvoering -- iemand die het recht mist, hoort geen knop te zien die hij
       toch niet mag indrukken. Hij staat er straks nog een keer, en dat is geen
       dubbeling maar het verschil tussen tonen en toestaan. */
    const mag = g.directie || g.rechten.includes(gelezen.h.recht);
    if (!mag) {
      return res.status(403).json({ error: 'Daar heeft u het recht "' + gelezen.h.recht + '" voor nodig.',
        recht: gelezen.h.recht, plan: null });
    }

    const plan = {
      id: rid(6), handeling: gelezen.id, bedoeling,
      velden: gelezen.velden, recht: gelezen.h.recht,
      samenvatting: gelezen.h.samenvat(gelezen.velden),
      raakt: gelezen.h.raakt(gelezen.velden),
      lidId: g.l ? g.l.id : null, door: g.l ? g.l.naam : 'beheer',
      /* Het geheim heet `token`, en dat is met opzet: de uitvoerlaag haalt
         velden met die naam eruit (kern/tenant/uitgang.js, GEHEIM), dus dit
         komt nooit in de export van een vertrekkende klant terecht. */
      token: crypto.randomBytes(18).toString('hex'), at: nu()
    };
    P(g.w)[plan.id] = plan;
    save();

    res.json({ ok: true,
      plan: { id: plan.id, handeling: plan.handeling, samenvatting: plan.samenvatting,
        raakt: plan.raakt, recht: plan.recht, bevestiging: plan.token, geldigMinuten: GELDIG_MS / 60000 },
      let: 'Er is nog NIETS gebeurd. Dit is een voornemen; het gaat pas door als u het bevestigt met de meegegeven code.' });
  });

  /* ---------- 2. de uitvoering ---------- */
  app.post('/api/bedrijf/handeling/doe', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    veeg(g.w);
    const plan = eigenVeld(P(g.w), String(req.body.planId || ''));
    if (!plan) return res.status(404).json({ error: 'Dit voornemen bestaat niet meer. Voornemens verlopen na ' + (GELDIG_MS / 60000) + ' minuten; maak een nieuw plan.' });

    const eigen = plan.lidId === (g.l ? g.l.id : null);
    if (!eigen && !g.directie) return res.status(403).json({ error: 'Dit voornemen is van iemand anders. Bevestigen doet degene die het maakte.' });

    const gegeven = String(req.body.bevestiging || '');
    if (!gegeven || !veiligGelijk(gegeven, plan.token))
      return res.status(400).json({ error: 'Zonder de bevestigingscode gebeurt er niets. Dat is geen formaliteit: een machine mag klaarzetten, bevestigen doet een mens.' });

    /* Regel 3: het recht OPNIEUW. Tussen het plan en dit moment kan een
       tijdelijke rol zijn verlopen, en een plan hoort dat niet te overleven. */
    const h = HANDELINGEN[plan.handeling];
    if (!h) { delete P(g.w)[plan.id]; save(); return res.status(409).json({ error: 'Deze handeling bestaat niet meer.' }); }
    if (!g.directie && !g.rechten.includes(h.recht)) {
      delete P(g.w)[plan.id]; save();
      return res.status(403).json({ error: 'U had het recht "' + h.recht + '" toen dit plan werd gemaakt, en nu niet meer. Er is niets uitgevoerd.', recht: h.recht });
    }

    const uit = voerUit(g, plan, h);
    delete P(g.w)[plan.id];                       // een plan is voor EEN keer

    const bon = { id: rid(5), handeling: plan.handeling, bedoeling: plan.bedoeling,
      samenvatting: plan.samenvatting, recht: h.recht, door: plan.door, lidId: plan.lidId,
      gepland: plan.at, uitgevoerd: nu(), resultaat: uit.verwijzing, gelukt: !!uit.ok,
      reden: uit.reden || null };
    const bonnen = B(g.w);
    bonnen.unshift(bon);
    if (bonnen.length > MAX_BONNEN) bonnen.length = MAX_BONNEN;
    sctx.log(g.w, g.l, 'handeling:' + plan.handeling, uit.verwijzing && uit.verwijzing.id, plan.bedoeling);
    save();

    if (!uit.ok) return res.status(uit.status || 400).json({ error: uit.reden, actiebon: bon });
    res.json({ ok: true, actiebon: bon, resultaat: uit.resultaat,
      let: 'Uitgevoerd, en vastgelegd in een actiebon. Die staat ook in het journaal van deze werkruimte.' });
  });

  /* De uitvoering zelf. Elke handeling schrijft in de bak waar dat soort al
     woonde -- er komt geen tweede opslag naast de modules, want dan staat
     dezelfde taak op twee plekken. */
  function voerUit(g, plan, h) {
    if (plan.handeling === 'taak.maak') {
      const T = (g.w.taken = g.w.taken || {});
      const t = { id: rid(5), titel: plan.velden.titel, projectId: null, ouderId: null,
        omschrijving: null, deadline: null, prioriteit: 'normaal', kolom: 'te doen',
        wachtOp: [], uren: 0, sprint: null, at: nu(), door: plan.door };
      sctx.zetWie(g.w, t, 'wie', plan.door);
      T[t.id] = t;
      return { ok: true, resultaat: t, verwijzing: { soort: 'taak', id: t.id, titel: t.titel } };
    }
    if (plan.handeling === 'ticket.maak') {
      const S = (g.w.tickets = g.w.tickets || {});
      const t = { id: rid(5), titel: plan.velden.titel, klantId: null, prioriteit: 'normaal',
        status: 'open', reacties: [], at: nu(), door: plan.door };
      S[t.id] = t;
      return { ok: true, resultaat: t, verwijzing: { soort: 'ticket', id: t.id, titel: t.titel } };
    }
    return { ok: false, status: 409, reden: 'Deze handeling heeft geen uitvoering.', verwijzing: null };
  }

  /* ---------- 3. de bonnen ---------- */
  app.post('/api/bedrijf/handeling/bonnen', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const rijen = B(g.w).slice(0, 200);
    res.json({ ok: true, aantal: B(g.w).length, bonnen: rijen,
      kan: Object.entries(HANDELINGEN).map(([id, h]) => ({ id, wat: h.wat, recht: h.recht })),
      let: 'Elke uitvoering staat hier en in het journaal. Wat de balk NIET kan, staat in `kan`: er is geen algemene uitvoerknop.' });
  });
};
