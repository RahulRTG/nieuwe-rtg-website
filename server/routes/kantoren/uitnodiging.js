/* Kantoren, deel "uitnodiging": de kantoorrol op naam (AUTHORITY.md fase 2).

   Besluit van de eigenaar (23 september 2026): de uitnodiging komt er nu, en de
   gedeelde kantoorcode blijft werken tot de schaduw een week heeft gemeten. De
   eigenaar maakt een uitnodiging op codenaam; alleen dat account kan hem, een
   keer en binnen zeven dagen, verzilveren via /api/account/koppel met
   `uitnodiging` in plaats van `code`. De code zelf ziet alleen de eigenaar, een
   keer, in dit antwoord; de opslag houdt een hash.

   MAKEN IS ZWAAR, om dezelfde reden als boardroomtoegang geven (./regie-toegang.js):
   een gestolen sessie zou zichzelf anders een blijvende tweede ingang maken. */
module.exports = (ctx) => {
  const { app, boardroomAuth, keyVanCodenaam, afdelingen, zwaar, boardroomUser, kern } = ctx;
  const bron = () => kern.kantoorUitnodiging;

  app.post('/api/office/kantoor/uitnodiging', boardroomAuth, async (req, res) => {
    try {
      if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar nodigt iemand uit voor het kantoor.' });
      if (!bron()) return res.status(503).json({ error: 'De kantooruitnodiging is niet bedraad in deze server.' });
      const t = await keyVanCodenaam(req.body.codenaam);
      if (!t) return res.status(404).json({ error: 'Deze codenaam kennen we niet.' });
      const bewijs = await zwaar.eis(boardroomUser(req), 'eigenaar-kantooruitnodiging',
        zwaar.sessieSleutel(req), req, 'Een uitnodiging voor het kantoor maken');
      if (bewijs.error) return zwaar.stuur(res, bewijs);
      const r = bron().maak({ voorKey: t.key, codenaam: t.codename, door: 'eigenaar' });
      if (r.error) return res.status(r.status || 400).json({ error: r.error });
      afdelingen.audit('eigenaar', 'Kantooruitnodiging gemaakt voor ' + t.codename);
      res.json(Object.assign({ codenaam: t.codename }, r));
    } catch (e) { console.error('[uitnodiging]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  app.post('/api/office/kantoor/uitnodigingen', boardroomAuth, (req, res) => {
    if (!bron()) return res.status(503).json({ error: 'De kantooruitnodiging is niet bedraad in deze server.' });
    res.json(Object.assign({ ok: true }, bron().overzicht()));
  });
};
