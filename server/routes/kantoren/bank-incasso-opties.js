/* Kantoren, deel "bank-incasso-opties": DE CEREMONIE VOOR DE INCASSORONDE OPENEN.

   kern/zwaarbewijs.js eist voor `bank.incasso` een passkeyceremonie zodra het
   account van de medewerker een passkey heeft, gebonden aan de handeling en aan de
   grens van de ronde ('incasso:' + tot). Er was geen kantoordeur die die ceremonie
   kon openen: de boardroom-deur bindt aan de sessie en staat alleen open voor de
   boardroom. Een medewerker MET passkey kon de ronde daardoor nooit starten,
   terwijl een medewerker zonder passkey er op de terugval door kwam -- de veiligere
   mens werd buitengesloten (gevonden 25 september 2026, test/kantoordeur-passkey).

   Dezelfde deur als de ronde zelf (kluisAuth: een naam, nooit de gedeelde code), en
   dezelfde binding: een ceremonie voor een andere grens dekt deze ronde niet.

   Gemount vanuit ./bank.js, met dezelfde context. */
'use strict';

module.exports = (ctx) => {
  const { app, kluisAuth, zwaar, boardroomUser } = ctx;

  app.post('/api/office/bank/incasso/opties', kluisAuth, async (req, res) => {
    const tot = req.body && req.body.tot != null ? Number(req.body.tot) : NaN;
    if (!Number.isFinite(tot)) return res.status(400).json({ error: 'Die grens is geen tijdstip.' });
    const r = await zwaar.opties(boardroomUser(req), 'bank.incasso', 'incasso:' + tot, req);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
};
