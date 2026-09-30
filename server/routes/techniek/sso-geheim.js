/* Het clientgeheim van een SSO-koppeling zetten en roteren (besluit B16).

   Alleen de eigenaar (techAuth + eigenaarAlleen), net als de koppeling zelf.
   Het geheim gaat erin en komt er nooit meer uit: elk antwoord draagt de STAND
   (vingerafdruk, gezet, verval, overlap) en nooit de tekst. Beide routes staan
   in lib/eenmalig-geheim-routes.js: het verzoek draagt een geheim, en geen
   antwoordcache mag een rotatie herhalen zonder langs de verse stand te gaan.

   Roteren met overlap: het nieuwe geheim wordt het eerste dat de tokenruil
   probeert, het vorige blijft `overlapDagen` bruikbaar (standaard 7, hoogstens
   30) zodat de klant bij zijn provider zonder uitval kan wisselen. Is hij over,
   dan sluit /overlap/sluit het vorige meteen af.

   Gemount vanuit routes/techniek/sso.js. */
'use strict';
const koppelingen = require('../../sso/koppelingen');
const { log } = require('../../log');
const { veiligeFout } = require('../../kern/util');

module.exports = (tctx, wie) => {
  const { app, techAuth, eigenaarAlleen } = tctx;

  const fout = (res, e) => res.status(e && [409, 503].includes(e.status) ? e.status : 400)
    .json({ error: veiligeFout(e), code: (e && e.code) || null });

  app.post('/api/techniek/sso/geheim', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    let uit;
    try {
      uit = koppelingen.roteerGeheim(b.org, b.clientSecret,
        { dagen: b.dagen, vervalt: b.vervalt, overlapDagen: b.overlapDagen });
    } catch (e) { return fout(res, e); }
    if (!uit) return res.status(404).json({ error: 'Maak eerst de SSO-koppeling aan; een clientgeheim hoort bij een organisatie.' });
    log.warn('sso.geheim geroteerd', { org: String(b.org).trim().toLowerCase(), door: wie(req),
      vingerafdruk: uit.stand.vingerafdruk, ongewijzigd: uit.ongewijzigd });
    res.json({ ok: true, ongewijzigd: uit.ongewijzigd, geheim: uit.stand,
      let_op: uit.stand.overlap
        ? 'Het vorige geheim werkt nog tot ' + uit.stand.overlap.tot + '. Sluit de overlap zodra de klant over is.'
        : 'Er loopt geen overlap: alleen dit geheim werkt.' });
  });

  app.post('/api/techniek/sso/geheim/overlap/sluit', techAuth, eigenaarAlleen, (req, res) => {
    const org = req.body && req.body.org;
    let stand;
    try { stand = koppelingen.sluitOverlap(org); }
    catch (e) { return fout(res, e); }
    if (!stand) return res.status(404).json({ error: 'Onbekende koppeling.' });
    log.warn('sso.geheim overlap gesloten', { org: String(org).trim().toLowerCase(), door: wie(req) });
    res.json({ ok: true, geheim: stand });
  });
};
