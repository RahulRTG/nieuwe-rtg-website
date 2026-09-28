/* Routes "democratie", de kant van het lid (kern/democratie/, POLITIEK.md fase B).

   De sleutel komt UIT DE SESSIE en nooit uit het verzoek, en alleen een eigen
   account (`user-...`) kan een kwestie inbrengen. Een demosessie deelt haar
   sleutel met iedereen die dezelfde pas aanklikt; een kwestie op die sleutel
   zou van niemand en van iedereen zijn, en dan kan de terugkoppeling nergens
   heen. De kantoorkant staat in ./kantoor.js, binnen dezelfde domeingrens. */
'use strict';

module.exports = (kern) => {
  const { app, auth, officeAuth, boardroomWie, democratie } = kern;
  const stuur = (res, r) => (r && r.error)
    ? res.status(r.status || 400).json({ error: r.error })
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

  require('./kantoor')({ app, officeAuth, boardroomWie, democratie, stuur });
};
