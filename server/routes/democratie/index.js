/* Routes "democratie", de kant van het lid (kern/democratie/, POLITIEK.md fase B).

   De sleutel komt UIT DE SESSIE en nooit uit het verzoek, en alleen een eigen
   account (`user-...`) kan een kwestie inbrengen. Een demosessie deelt haar
   sleutel met iedereen die dezelfde pas aanklikt; een kwestie op die sleutel
   zou van niemand en van iedereen zijn, en dan kan de terugkoppeling nergens
   heen. De kantoorkant staat in ./kantoor.js, binnen dezelfde domeingrens. */
'use strict';

module.exports = (app, auth, officeAuth, boardroomWie, democratie) => {
  const stuur = (res, r) => (r && r.error)
    ? res.status(r.status || 400).json(r.actie ? { error: r.error, actie: r.actie } : { error: r.error })
    : res.json(r);

  const alsLid = async (req, res, werk) => {
    const sleutel = String(req.session.key || '');
    if (!sleutel.startsWith('user-')) {
      return res.status(403).json({ error: 'Een kwestie inbrengen kan met elk eigen account, ook een gratis account. Met een demosessie niet: dan kan niemand u later terugkoppelen.' });
    }
    try { stuur(res, await werk(sleutel, req.body || {})); }
    catch (e) { console.error('[democratie]', e); res.status(500).json({ error: 'Dit lukte niet; er is niets veranderd dat u niet terugziet.' }); }
  };

  app.post('/api/member/democratie/kwestie/inbreng', auth, (req, res) =>
    alsLid(req, res, (k, b) => democratie.inbreng(k, b)));

  app.post('/api/member/democratie/kwestie/mijn', auth, (req, res) =>
    alsLid(req, res, (k) => democratie.mijn(k)));

  app.post('/api/member/democratie/kwestie/gezien', auth, (req, res) =>
    alsLid(req, res, (k, b) => democratie.gezien(k, b.id)));

  app.post('/api/member/democratie/kwestie/intrek', auth, (req, res) =>
    alsLid(req, res, (k, b) => democratie.intrek(k, b.id)));

  /* Het DoeNetwerk (kern/democratie/doe.js): een actie die bij de burger begint.
     Dezelfde deur en dezelfde regel voor de sleutel als hierboven. */
  const doe = democratie.doe;
  app.post('/api/member/democratie/actie/start', auth, (req, res) => alsLid(req, res, (k, b) => doe.start(k, b)));
  app.post('/api/member/democratie/actie/lijst', auth, (req, res) => alsLid(req, res, (k) => doe.lijst(k)));
  app.post('/api/member/democratie/actie/aansluit', auth, (req, res) => alsLid(req, res, (k, b) => doe.aansluit(k, b.id)));
  app.post('/api/member/democratie/actie/verlaat', auth, (req, res) => alsLid(req, res, (k, b) => doe.verlaat(k, b.id)));
  app.post('/api/member/democratie/actie/plan', auth, (req, res) => alsLid(req, res, (k, b) => doe.plan(k, b.id, b)));
  app.post('/api/member/democratie/actie/afgelast', auth, (req, res) => alsLid(req, res, (k, b) => doe.afgelast(k, b.id, b)));
  app.post('/api/member/democratie/actie/antwoord', auth, (req, res) => alsLid(req, res, (k, b) => doe.antwoord(k, b.id, b)));
  app.post('/api/member/democratie/actie/resultaat', auth, (req, res) => alsLid(req, res, (k, b) => doe.resultaat(k, b.id, b)));
  app.post('/api/member/democratie/actie/stop', auth, (req, res) => alsLid(req, res, (k, b) => doe.stop(k, b.id, b)));

  /* De voorstellen van partijen bij een openbare kwestie, of bij een eigen
     kwestie. Lezen, en voor elk lid hetzelfde beeld. */
  app.post('/api/member/democratie/kwestie/voorstellen', auth, (req, res) =>
    alsLid(req, res, (k, b) => democratie.voorstellenBij(k, b.id)));

  require('./kantoor')({ app, officeAuth, boardroomWie, democratie, stuur });
  require('./partij')({ app, democratie, stuur });
};
