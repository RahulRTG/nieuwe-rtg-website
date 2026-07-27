/* RTG Vertaler: een dunne route om de bestaande vertaalmotor
   (server/translate.js) -- met AI-sleutel echt vertalen, zonder sleutel
   het eerlijke woordenboek (translated:false als het niet lukte, nooit
   kapot). Door het stuur ook voor Rahul bereikbaar: "hoe zeg ik dit in
   het Japans" is een aanroep. Altijd-aan gemount. */
const TALEN = [
  ['nl', 'Nederlands'], ['en', 'English'], ['es', 'Espanol'], ['fr', 'Francais'],
  ['de', 'Deutsch'], ['it', 'Italiano'], ['pt', 'Portugues'], ['tr', 'Turkce'],
  ['ar', 'Arabisch'], ['hi', 'Hindi'], ['ja', 'Japans'], ['zh', 'Chinees'],
  ['ru', 'Russisch'], ['pl', 'Pools'], ['el', 'Grieks'], ['th', 'Thais']
];
const MAX_TEKST = 2000;

module.exports = (kern) => {
  const { app, i18n, auth } = kern;
  app.post('/api/vertaal/talen', auth, (req, res) => res.json({ talen: TALEN }));
  app.post('/api/vertaal', auth, async (req, res) => {
    const b = req.body || {};
    const tekst = String(b.tekst || '').slice(0, MAX_TEKST);
    if (!tekst.trim()) return res.status(400).json({ error: 'Er valt niets te vertalen.' });
    try {
      const r = await i18n.translate(tekst, String(b.naar || 'en'), b.van ? String(b.van) : undefined);
      res.json({ tekst: r.text, vertaald: r.translated, van: r.from });
    } catch (e) {
      res.status(502).json({ error: 'De vertaling lukte nu even niet.' });
    }
  });
};
