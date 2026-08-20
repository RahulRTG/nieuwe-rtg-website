/* Routes "festival" (deelmodule): DE GEREEDHEID.

   Zie kern/festival/gereed.js voor de doctrine; dit is de deur. Twee dingen
   staan hier en niet in de kern, en het zijn allebei dezelfde soort regel als
   de serverklok bij de scan:

   1. DE NAAM KOMT UIT DE SESSIE EN NOOIT UIT HET LICHAAM. De kern weigert dat
      dezelfde mens indient en aftekent (kern/festival/gereed.js). Zou de route
      `door` uit de body overnemen, dan is die scheiding een formaliteit: je
      typt een andere naam en tekent je eigen stuk af. Wie het deed, staat in
      req.actor, en daar komt hij vandaan.

   2. DE PEILDATUM KOMT VAN DE SERVER. "Verlopen" bestaat alleen ten opzichte
      van een dag; wie die dag mag meesturen, keurt zijn festival goed op een
      datum die hem uitkomt. */
'use strict';

module.exports = (kern, deur) => {
  const { app, festival, logActivity, managerOnly, supplierAuth } = kern;
  const { mijn, editieVan, geenFestival, stuur } = deur;

  const vandaag = () => new Date().toISOString().slice(0, 10);
  const wie = (req) => (req.actor && req.actor.name) || null;

  app.post('/api/festival/controls/seed', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const r = festival.controlsSeed(f.id, editieVan(req));
    if (r.ok) logActivity(req.supplier.code, req.actor, 'zette de startlijst controls klaar');
    stuur(res, r);
  });

  app.post('/api/festival/control', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    /* `door` gaat mee voor het spoor bij een afzwakking, en komt uit de sessie. */
    stuur(res, festival.controlZet(f.id, editieVan(req), { ...(req.body || {}), door: wie(req) }));
  });

  app.post('/api/festival/control/weg', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.controlWeg(f.id, editieVan(req), (req.body || {}).control));
  });

  /* Indienen mag elk personeelslid: wie het stuk heeft, levert het aan. */
  app.post('/api/festival/bewijs', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const b = req.body || {};
    const r = festival.bewijsIndienen(f.id, editieVan(req), {
      control: b.control, soort: b.soort, nummer: b.nummer, geldigTot: b.geldigTot,
      door: wie(req)                       // NA de body: het lichaam zet geen naam
    });
    if (r.ok) logActivity(req.supplier.code, req.actor, 'diende een stuk in voor ' + r.control.naam);
    stuur(res, r);
  });

  /* Aftekenen is managerwerk, en de kern weigert alsnog wie zelf indiende. */
  app.post('/api/festival/bewijs/teken', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const r = festival.bewijsAftekenen(f.id, editieVan(req), {
      control: (req.body || {}).control, door: wie(req)
    });
    if (r.ok) logActivity(req.supplier.code, req.actor, 'tekende ' + r.control.naam + ' af');
    stuur(res, r);
  });

  app.post('/api/festival/gereed', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.gereedheid(f.id, editieVan(req), { op: vandaag() }));
  });
};
