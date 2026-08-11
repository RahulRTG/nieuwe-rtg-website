/* Concern (deelmodule): DE VERBOUWING -- impact, momentopname, uitdienst,
   overname en fusie.

   ELKE INGREEP HIER IS IN TWEEEN GEKNIPT: eerst een route die TOONT, dan een
   route die DOET. Dat is geen vormelijkheid. "Maak alle Finance centraal" is
   één zin en zes BV's; wie dat in één aanroep laat gebeuren, geeft iemand de
   kans een reorganisatie te starten met een dubbele muisklik.

   Afgesplitst van ../concern.js om dezelfde reden als ./mensen.js: het
   modulebeleid van 10 kB, met de naad op een echte grens. */
module.exports = (kern, hulp) => {
  const { app, auth, concernImpact, concernOpnameMaak, concernOpnames, concernOpnameHerstel,
    concernOffboardingBeeld, concernOffboardingDoe, concernOvername,
    concernFusieBeeld, concernFusieDoe, entiteitVind } = kern;
  const { mijn, stuur, nietGevonden } = hulp;

  /* ---- impact ---- */
  app.post('/api/concern/impact', auth, (req, res) => {
    const b = req.body || {};
    /* Alleen over eigen entiteiten. Zonder deze zeef zou een lijst id's uit het
       lichaam een telling van andermans bedrijf opleveren -- en een telling is
       ook informatie. */
    const eigen = (Array.isArray(b.entiteiten) ? b.entiteiten : [])
      .map(entiteitVind).filter(e => e && e.eigenaar === req.session.key).map(e => e.id);
    stuur(res, concernImpact(req.session.key, Object.assign({}, b, { entiteiten: eigen })));
  });

  /* ---- momentopname en terugdraaien ---- */
  app.post('/api/concern/opname/maak', auth, (req, res) => {
    stuur(res, concernOpnameMaak(req.session.key, (req.body || {}).waarom));
  });

  app.post('/api/concern/opnames', auth, (req, res) => {
    res.json({ ok: true, opnames: concernOpnames(req.session.key) });
  });

  app.post('/api/concern/opname/herstel', auth, (req, res) => {
    stuur(res, concernOpnameHerstel(req.session.key, String((req.body || {}).opname || '')));
  });

  /* ---- uit dienst ----
     Eerst de inventarisatie (wat laat deze persoon achter), dan pas beëindigen. */
  app.post('/api/concern/uitdienst/beeld', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    stuur(res, concernOffboardingBeeld(String((req.body || {}).persoon || ''), e.id));
  });

  app.post('/api/concern/uitdienst/doe', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const b = req.body || {};
    stuur(res, concernOffboardingDoe(String(b.persoon || ''), e.id, b.per));
  });

  /* ---- overname ----
     Een bedrijf dat van eigenaar wisselt wordt niet opnieuw aangemaakt: de
     eigendomsgraaf wijzigt en de geschiedenis blijft staan. */
  app.post('/api/concern/overname', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    stuur(res, concernOvername(e, Object.assign({}, req.body, { wie: req.session.key })));
  });

  /* ---- fusie ----
     `naar` moet OOK van deze aanvrager zijn. Zonder die tweede controle kon
     iemand zijn eigen entiteit in die van een ander laten opgaan, en dan staat
     zijn personeel opeens bij een vreemde werkgever. */
  function beide(req) {
    const van = mijn(req);
    if (!van) return null;
    const naar = entiteitVind(String((req.body || {}).naar || ''));
    if (!naar || naar.eigenaar !== req.session.key) return null;
    return { van, naar };
  }

  app.post('/api/concern/fusie/beeld', auth, (req, res) => {
    const p = beide(req);
    if (!p) return stuur(res, nietGevonden);
    stuur(res, concernFusieBeeld(p.van, p.naar));
  });

  app.post('/api/concern/fusie/doe', auth, (req, res) => {
    const p = beide(req);
    if (!p) return stuur(res, nietGevonden);
    stuur(res, concernFusieDoe(p.van, p.naar, (req.body || {}).per));
  });
};
