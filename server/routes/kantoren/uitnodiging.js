/* Kantoren, deel "uitnodiging": de kantoorrol op naam (AUTHORITY.md fase 2).

   Besluit van de eigenaar (23 september 2026): de uitnodiging komt er nu, en de
   gedeelde kantoorcode blijft werken tot de schaduw een week heeft gemeten. De
   eigenaar maakt een uitnodiging op codenaam; alleen dat account kan hem, een
   keer en binnen zeven dagen, verzilveren via /api/account/koppel met
   `uitnodiging` in plaats van `code`. De code zelf ziet alleen de eigenaar, een
   keer, in dit antwoord; de opslag houdt een hash.

   MAKEN IS ZWAAR, om dezelfde reden als boardroomtoegang geven (./regie-toegang.js):
   een gestolen sessie zou zichzelf anders een blijvende tweede ingang maken.

   HET EERSTE KANTOORACCOUNT (besluit B23, 4 oktober 2026). In productie opent
   de gedeelde code niets (B10); het eerste kantooraccount op naam ontstaat
   HIER: de eigenaar opent het kantoor met zijn eigen passkey (zijn afgeleide
   kantoorsleutel, kern/eenaccount/afgeleid.js) en machtigt met een VERSE
   passkey. Er is geen startcode. In productie zonder terugval: ontbreekt de
   passkeylaag, dan 503; heeft het account geen passkey, dan 403. Het spoor
   noemt de sleutel uit de sessie (de envelop van de boardroompoort), niet een
   vaste naam -- wie wie machtigde moet achteraf te herleiden zijn. */
const { wie: envelopWie } = require('../../opzet/envelop');
const { isProductie } = require('../../kern/kantoor/productiedeur');
const wieDeed = (req) => envelopWie(req) || 'eigenaar';
module.exports = (ctx) => {
  const { app, boardroomAuth, keyVanCodenaam, afdelingen, zwaar, boardroomUser, kern } = ctx;
  const bron = () => kern.kantoorUitnodiging;

  app.post('/api/office/kantoor/uitnodiging', boardroomAuth, async (req, res) => {
    try {
      if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar nodigt iemand uit voor het kantoor.' });
      if (!bron()) return res.status(503).json({ error: 'De kantooruitnodiging is niet bedraad in deze server.' });
      if (!zwaar || typeof zwaar.eis !== 'function')
        return res.status(503).json({ error: 'De passkeycontrole is op deze server niet ingericht; er wordt niemand gemachtigd.' });
      const t = await keyVanCodenaam(req.body.codenaam);
      if (!t) return res.status(404).json({ error: 'Deze codenaam kennen we niet.' });
      const bewijs = await zwaar.eis(boardroomUser(req), 'eigenaar-kantooruitnodiging',
        zwaar.sessieSleutel(req), req, 'Een uitnodiging voor het kantoor maken', { zonderTerugval: isProductie() });
      if (bewijs.error) return zwaar.stuur(res, bewijs);
      const r = await bron().maak({ voorKey: t.key, codenaam: t.codename, door: wieDeed(req) });
      if (r.error) return res.status(r.status || 400).json({ error: r.error });
      afdelingen.audit(wieDeed(req), 'Kantooruitnodiging gemaakt voor ' + t.codename +
        (bewijs.bewezen ? ' (passkey bevestigd)' : ' (ZONDER passkey: terugval buiten productie)'));
      res.json(Object.assign({ codenaam: t.codename }, r));
    } catch (e) { console.error('[uitnodiging]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* Intrekken is geen zware handeling: een uitgelekte uitnodiging dichtzetten
     hoort geen drempel te hebben. Wel alleen de eigenaar, net als uitgeven. */
  app.post('/api/office/kantoor/uitnodiging/intrek', boardroomAuth, async (req, res) => {
    try {
      if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar trekt een kantooruitnodiging in.' });
      if (!bron()) return res.status(503).json({ error: 'De kantooruitnodiging is niet bedraad in deze server.' });
      const r = await bron().intrek(String((req.body || {}).id || '').slice(0, 60), wieDeed(req));
      if (r.error) return res.status(r.status || 400).json({ error: r.error });
      afdelingen.audit(wieDeed(req), 'Kantooruitnodiging ingetrokken (' + r.id + ')');
      res.json(r);
    } catch (e) { console.error('[uitnodiging]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  app.post('/api/office/kantoor/uitnodigingen', boardroomAuth, (req, res) => {
    if (!bron()) return res.status(503).json({ error: 'De kantooruitnodiging is niet bedraad in deze server.' });
    res.json(Object.assign({ ok: true }, bron().overzicht()));
  });
};
