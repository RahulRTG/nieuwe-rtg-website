/* RTMAIL, de kantoorkant van de bewaartermijn van
   sollicitatiepost (besluit 584A, kern/rtmail-leidingtermijn.js en
   kern/rtmail-leidinghold.js). Twee dingen die onomkeerbaar verwijderen raken
   of tegenhouden, en dus allebei achter de boardroom met een VERSE passkey
   zonder terugval -- zoals bank en incasso.

   1. DE JURIDISCHE TOETS (migratie): alleen de eigenaar. Eerst `stap: 'omvang'`
      -- wat er onder de regel zou verdwijnen, per zaak, op de dag afgerond, met
      een vingerafdruk -- en daarna bevestigen met precies die vingerafdruk. Is
      de set intussen veranderd, dan weigert de kern.
   2. DE BEOORDELING VAN EEN HOLD: de eigenaar of een boardroombevoegde, nooit
      de aanvrager zelf (de kern vergelijkt de sleutel uit de inlog). Zonder
      `actie` geeft de route de lijst. */
'use strict';
const { wie: envelopWie } = require('../../opzet/envelop');

/* Gemonteerd vanuit ../rtmail-bestuur.js, op dezelfde domeingrens (GRENZEN.json:
   rtmail-bestuur mag boardroomAuth, boardroomWie en zwaarbewijs). */
module.exports = (kern) => {
  const { app, boardroomAuth, zwaarbewijs: zwaar } = kern;
  const boardroomUser = (req) => zwaar.boardroomUser(req);
  const body = (req) => (req && req.body) || {};
  const antwoord = (res, r) => (r.error ? res.status(r.status || 400).json(Object.assign({ error: r.error }, r.omvang ? { omvang: r.omvang } : {})) : res.json(r));
  const vinger = (req, actie, wat) => zwaar.eis(boardroomUser(req), actie, zwaar.sessieSleutel(req), req, wat, { zonderTerugval: true });

  app.post('/api/office/rtmail/leiding/toets', boardroomAuth, async (req, res) => {
    if (!req.boardroomBaas) return res.status(403).json({ error: 'De juridische toets zet alleen de eigenaar, op naam.' });
    const b = body(req);
    if (b.stap === 'omvang') return res.json(Object.assign({ ok: true }, kern.rtmailBewaar.leiding.omvang()));
    const bewijs = await vinger(req, 'eigenaar-leidingtoets', 'Het zetten van de juridische toets op sollicitatiepost');
    if (bewijs.error) return zwaar.stuur(res, bewijs);
    antwoord(res, kern.rtmailBewaar.leiding.toets({ getoetst: b.getoetst === true, vingerafdruk: b.vingerafdruk,
      door: envelopWie(req), notitie: b.notitie }));
  });

  app.post('/api/office/rtmail/leiding/hold', boardroomAuth, async (req, res) => {
    const b = body(req);
    const hold = kern.rtmailBewaar.leiding.hold;
    if (!b.actie) return res.json({ ok: true, holds: hold.lijst(new Date().toISOString()) });
    const bewijs = await vinger(req, 'eigenaar-leidinghold', 'Het beoordelen van een juridische hold op sollicitatiepost');
    if (bewijs.error) return zwaar.stuur(res, bewijs);
    antwoord(res, hold.beoordeel({ id: b.id, actie: String(b.actie), herbeoordeling: b.herbeoordeling,
      grondslag: b.grondslag, doel: b.doel, wie: kern.boardroomWie(req) }));
  });
};
