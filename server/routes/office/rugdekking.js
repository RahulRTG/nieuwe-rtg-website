/* HET KANTOOR EN DE RUGDEKKING (kern/rugdekking/).

   Twee dingen die allebei OP NAAM gaan, en om dezelfde reden: wie achter een
   mens gaat staan en wie de beurs openzet, hoort later terug te vinden te zijn.
   `wieKijkt(req)` geeft alleen een sleutel of een id als er een echte medewerker
   achter het kantoortoken hangt; met de gedeelde OFFICE_CODE blijft dat leeg en
   weigert de kern. Een spoor dat eindigt bij een gedeelde code is geen spoor
   (KANTOORMACHT.md). */
module.exports = (octx, gedeeld) => {
  const { kern } = octx;
  const { app, kluisAuth, rugdekking } = kern;
  const { wieKijkt } = gedeeld;
  const stuur = (res, r) => (r && r.error)
    ? res.status(r.status || 400).json({ error: r.error })
    : res.json(r);
  /* Dezelfde herleidbaarheid als bij het voogdijbesluit: niet "is er tekst"
     maar "is dit terug te voeren op een mens". */
  const wie = (req) => { const w = wieKijkt(req) || {}; return w.sleutel || w.id || ''; };

  app.post('/api/office/rugdekking/alle', kluisAuth, (req, res) => stuur(res, rugdekking.alle()));

  app.post('/api/office/rugdekking/stel', kluisAuth, async (req, res) =>
    stuur(res, await rugdekking.stel(wie(req), req.body || {})));

  app.post('/api/office/rugdekking/stop', kluisAuth, async (req, res) => {
    const b = req.body || {};
    stuur(res, await rugdekking.stop(wie(req), String(b.id || ''), b.reden));
  });

  app.post('/api/office/rugdekking/beurs', kluisAuth, async (req, res) =>
    stuur(res, await rugdekking.beursStandZet(String((req.body || {}).stand || ''), wie(req))));
};
