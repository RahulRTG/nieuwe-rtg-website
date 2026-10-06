/* ============================================================================
   DE AFSLUITERS: WAT ER GEBEURT ALS NIETS PASTE, EN ALS IETS BREKT.

   Twee vragen, allebei met een eigen antwoord:

   1. NIETS PASTE. Onder /api hoort dat JSON te zijn -- een client die daar een
      404-pagina in HTML terugkrijgt, meldt "onverwacht teken <" en niemand
      weet meer waar het misging. Daarbuiten hoort er een echte pagina te
      staan.
   2. IETS BRAK. Een client-invoerfout (400, 413) en een serverfout (5xx) zien
      er in een log hetzelfde uit als je ze niet uit elkaar houdt. Die van ons
      krijgt een eigen vlag, zodat de strenge testpoort er hard op faalt en de
      productielogs de twee soorten kunnen scheiden.

   DEZE MOETEN ALS LAATSTE GEREGISTREERD WORDEN. Express loopt de handlers in
   volgorde af; wie hier eerder gaat staan, vangt routes af die nog moesten
   komen. Daarom wordt dit vanuit ./start.js aangeroepen, onderaan server.js.
   ========================================================================== */
'use strict';

const OPSLAGWEIGERING = Object.freeze({ PG_REQUEST_CONFLICT: 409, PG_AUDIT_KETEN_GEBROKEN: 503,
  PG_SPOOR_GELIJKTIJDIG: 503, PG_REQUEST_GRAFSTEEN: 409 });

module.exports = function afsluiters({ app, path, PUBLIC_DIR, log }) {
  app.use('/api', (req, res) => res.status(404).json({ error: 'Onbekend eindpunt.' }));
  app.use((req, res) => {
    res.status(404).sendFile(path.join(PUBLIC_DIR, 'site', '404.html'));
  });
  app.use((err, req, res, next) => {
    /* Een WEIGERING VAN DE OPSLAG is geen programmafout. Een vroege commit die
       het auditspoor van het verzoek meeneemt (db/verzoekspoor.js) kan falen
       op een conflict of een gebroken spoor; dat is dan al de uitkomst van het
       verzoek (ctx.hardeFout, db/postgres-poorten.js) en de responspoort
       antwoordt ermee -- 409, of 503 met de reden. De auditwacht heeft een
       gebroken spoor al als alarm gemeld; hier hoort hij niet nog eens als
       "uitzondering met stack" te verschijnen, alsof de code omviel. */
    if (err && OPSLAGWEIGERING[err.code]) {
      log.warn('opslagweigering', { id: req && req.id, p: req && req.path, code: err.code });
      if (res.headersSent) return next(err);
      return res.status(OPSLAGWEIGERING[err.code]).json({ error: String(err.message || '').slice(0, 300), code: err.code });
    }
    const status = err && err.type === 'entity.too.large' ? 413 : ((err && err.status) || 500);
    // 5xx is een ECHTE serverfout (geen client-invoerfout zoals 400/413): apart
    // gemarkeerd zodat de strenge testpoort er hard op faalt en de productie-logs
    // de twee soorten uit elkaar houden.
    log.uitzondering(err instanceof Error ? err : new Error(String(err)),
      { id: req && req.id, p: req && req.path, status, ...(status >= 500 ? { serverfout: true } : {}) });
    if (res.headersSent) return next(err);
    res.status(status).json({ error: 'Er ging iets mis. Probeer het opnieuw.', id: req && req.id });
  });
};
