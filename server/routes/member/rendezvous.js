/* Member-submodule: Rendez-vous -- de besloten AI-datingapp voor Signature.
   Lifestyle en Business zijn beide Signature. De logica woont in
   kern/rendezvous.js. Gemount vanuit routes/member.js.

   HIER STAAT ALLEEN DE PAS-EIS. Welke pas toegang geeft is een productkeuze en
   verschilt per app; de ontmoetpoort (18+ met geverifieerd paspoort) is dat niet
   en staat daarom in de kern, gedeeld met Vonk -- zie kern/ontmoetpoort.js. Wie
   hier ooit ook de leeftijd zou controleren, bouwt de tweede kopie van een grens
   en dat is precies hoe deze app hem eerder helemaal misliep. */
module.exports = (kern) => {
  const { app, auth, accounts, leeftijdVan, rvProfielGet, rvProfiel, rvKandidaten, rvKies, rvMatches,
    rvDate, rvAanwezigWis, rvArrange, rvAkkoord,
    rvTafels, rvTafelAntwoord, rvIntroducties, rvIntroAntwoord, rvEncounter, rvSamen, rvSamenZet,
    rvEdge, rvStateGuard } = kern;
  const { rvConciergeList, rvConciergeRequest, rvConciergeApprove } = kern;
  const { rvCircles, rvCircleRsvp } = kern;
  const State = require('../../kern/connection-state-rendezvous');
  const { eis: eisCapability } = require('../connection-policy')({ product: 'rendezvous', accounts, leeftijdVan });

  /* Twee lagen, met opzet: de HANDHAVER is kern/ontmoetpoort.js (elke
     kernfunctie draagt hem), en deze eis() is de voordeur die er nette
     foutCODES bij geeft -- de schermen tonen op IDENTITY_REQUIRED en
     AGE_REQUIRED elk hun eigen deur. Drift faalt veilig: wie hier per ongeluk
     doorkomt, strandt alsnog op de kernpoort. */
  const stuur = (res, r) => r && r.error
    ? res.status(r.status || 400).json({ error: r.error, ...(r.code ? { code: r.code } : {}) })
    : res.json(r);
  /* De paden staan voluit en niet als '/api/member/rendezvous/' + pad. Een opgebouwd pad
     ziet scripts/schakelbaar.js niet, en wat die census niet ziet is vanuit de
     boardroom niet uit te zetten en niet per stad te sluiten (scripts/check.js
     regel 45). De pas-eis en het vangnet blijven op EEN plek; alleen de
     registratie is uitgeschreven. */
  const doe = (capability, werk, actor) => (req, res) => {
    if (!eisCapability(req, res, capability, actor)) return;
    try { stuur(res, werk(req.session.key, req.body || {})); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };
  const overgang = (capability, event, context, werk, facts) => doe(capability, (k, b) => {
    const c = { ...context(b), stateRevision: b.stateRevision };
    const g = rvStateGuard(k, c, capability, event, facts ? facts(b) : null);
    return g.ok ? werk(k, b) : g;
  });
  require('./rendezvous-connection')(kern, { stuur, doe, eisCapability });

  app.post('/api/member/rendezvous/profiel', auth, doe('connection.profile.read', (k) => rvProfielGet(k)));
  app.post('/api/member/rendezvous/profiel/zet', auth, doe('connection.profile.manage', (k, b) => rvProfiel(k, b)));
  app.post('/api/member/rendezvous/kandidaten', auth, doe('connection.discover', (k) => rvKandidaten(k)));
  app.post('/api/member/rendezvous/edge', auth, doe('connection.profile.read', (k, b) => rvEdge(k, b)));
  app.post('/api/member/rendezvous/like', auth, overgang('connection.match.choose', State.EVENTS.CHOOSE_CANDIDATE,
    b => ({ kind: 'candidate', id: String(b.id || '') }), (k, b) => rvKies(k, String(b.id || ''), 'like')));
  app.post('/api/member/rendezvous/pas', auth, overgang('connection.match.choose', State.EVENTS.CHOOSE_CANDIDATE,
    b => ({ kind: 'candidate', id: String(b.id || '') }), (k, b) => rvKies(k, String(b.id || ''), 'pas')));
  app.post('/api/member/rendezvous/matches', auth, doe('connection.match.read', (k) => rvMatches(k)));
  app.post('/api/member/rendezvous/blokkeer', auth, doe('connection.safety.block', (k, b) => rvKies(k, String(b.id || ''), 'blokkeer', b.meld)));
  app.post('/api/member/rendezvous/aanwezig/wis', auth, doe('connection.presence.manage', (k) => rvAanwezigWis(k)));
  app.post('/api/member/rendezvous/arrange', auth, overgang('connection.meet.plan', State.EVENTS.PLAN_ARRANGE,
    b => ({ kind: 'match', id: String(b.id || '') }), (k, b) => rvArrange(k, String(b.id || ''), b.setting)));
  app.post('/api/member/rendezvous/akkoord', auth, overgang('connection.meet.accept', State.EVENTS.ACCEPT_ARRANGE,
    b => ({ kind: 'match', id: String(b.id || '') }), (k, b) => rvAkkoord(k, String(b.id || ''), b.ja)));
  app.post('/api/member/rendezvous/tafels', auth, doe('connection.table.read', (k) => rvTafels(k)));
  app.post('/api/member/rendezvous/tafel/antwoord', auth, overgang('connection.table.accept', State.EVENTS.RESPOND_TABLE,
    b => ({ kind: 'table', id: String(b.id || '') }), (k, b) => rvTafelAntwoord(k, String(b.id || ''), b.ja)));
  app.post('/api/member/rendezvous/introducties', auth, doe('connection.introduction.read', (k) => rvIntroducties(k)));
  app.post('/api/member/rendezvous/introductie/antwoord', auth, overgang('connection.introduction.answer', State.EVENTS.ANSWER_INTRODUCTION,
    b => ({ kind: 'introduction', id: String(b.id || '') }), (k, b) => rvIntroAntwoord(k, String(b.id || ''), b.ja)));
  app.post('/api/member/rendezvous/encounter', auth, overgang('connection.encounter.confirm', State.EVENTS.CONFIRM_ENCOUNTER,
    () => ({ kind: 'encounter' }), (k, b) => rvEncounter(k, b.pin)));
  app.post('/api/member/rendezvous/samen', auth, doe('connection.relationship.declare', (k) => rvSamen(k)));
  app.post('/api/member/rendezvous/samen/zet', auth, overgang('connection.relationship.declare', State.EVENTS.DECLARE_TOGETHER,
    b => b.ja === false ? ({ kind: 'together' }) : ({ kind: 'relationship', id: String(b.met || '') }),
    (k, b) => rvSamenZet(k, String(b.met || ''), b.ja)));
  app.post('/api/member/rendezvous/concierge', auth, doe('connection.concierge.request', (k) => rvConciergeList(k)));
  app.post('/api/member/rendezvous/concierge/request', auth, doe('connection.concierge.request', (k, b) => rvConciergeRequest(k, b)));
  app.post('/api/member/rendezvous/concierge/approve', auth, doe('connection.concierge.request', (k, b) => rvConciergeApprove(k, b.id, b.approve)));
  app.post('/api/member/rendezvous/circles', auth, doe('connection.circle.read', (k) => rvCircles(k)));
  app.post('/api/member/rendezvous/circle/rsvp', auth, doe('connection.circle.read', (k,b) => rvCircleRsvp(k,b.circleId,b.gatheringId,b.yes)));

  // de AI-date is async (Rahul de koppelaar), dus een eigen handler
  app.post('/api/member/rendezvous/date', auth, async (req, res) => {
    /* Rahul is hier de actor, maar de policy eist eerst exact dezelfde toegang
       van het lid. Een modelprovider kan deze voordeur dus nooit verruimen. */
    if (!eisCapability(req, res, 'connection.meet.plan', 'rahul')) return;
    try { stuur(res, await rvDate(req.session.key, String((req.body || {}).id || ''), (req.body || {}).vraag)); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
