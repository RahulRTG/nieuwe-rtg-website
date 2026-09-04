/* Backoffice (deelmodule): HET ANKER -- het ene getal dat naar buiten moet.

   Losgeknipt van ./toegang.js omdat dat bestand over de tienkilobytegrens van
   keuringsregel 13 ging, en omdat het een eigen onderwerp is: inloggen, de
   tijdlijn en een export gaan over de backoffice, dit gaat over de vraag of het
   auditspoor te vertrouwen is. Zie server/lib/ankerdienst.js en ./ankerpost.js.

   Gemount vanuit routes/office.js, direct na ./toegang.js. */
module.exports = (octx) => {
  const { kern } = octx;
  const { app, officeAuth, ankerdienst, ankerpost } = kern;

/* HET ANKER: het ene getal dat naar buiten moet.

   De hashketen onder de auditjournalen ziet gesleutel MIDDEN in een spoor.
   Kopafknipping ziet hij NIET -- wie de nieuwste regels weggooit, houdt een
   keten over die van voor naar achter perfect klopt. Dat is precies wat iemand
   doet die zijn eigen bezoek uitwist.

   Daarvoor moet er een blok naar een GESCHEIDEN plek: een andere machine, een
   andere partij, desnoods een uitdraai in een kluis. Deze route levert dat
   blok; de tweede rekent ermee af zodra u het terugvoert.

   Let op wat er NIET is: een route die het blok zelf ergens wegschrijft. Een
   anker dat deze software op dezelfde schijf zet, is geen anker maar een tweede
   regel om te wijzigen. Waar het blok heen gaat is een besluit over uw
   infrastructuur, en dat hoort bij een mens. Zie server/lib/ankerdienst.js. */
app.post('/api/office/anker', officeAuth, (req, res) => {
  res.json(Object.assign({ ok: true, post: ankerpost.stand() },
    ankerdienst.stand(req.body && req.body.blok ? req.body.blok : null)));
});

/* Afrekenen met een eerder naar buiten gebracht blok. Per journaal het oordeel:
   is er iets van de kop verdwenen, en zo ja hoeveel. */
/* DE POST naar de tweede machine (server/lib/ankerpost.js). Het besluit over de
   bestemming is genomen -- een tweede machine binnen RTG -- maar de post doet
   niets zolang er geen adres staat, en zegt dat dan ook. */
app.post('/api/office/anker/post', officeAuth, async (req, res) => {
  /* DE UITKOMST NEST, en dat is geen opmaak. Hier stond een Object.assign, en
     die liet `ok: false` uit de post het `ok: true` van de ROUTE overschrijven.
     Gevolg: geen bestemming las als een mislukte aanroep, terwijl er niets mis
     is -- er is alleen nog geen tweede machine besloten. Precies het verschil
     dat ankerpost.js overal bewaakt, weggegooid door een merge van twee velden
     met dezelfde naam. Gevonden door test/integratie-routes.test.js toets 2. */
  res.json({ ok: true, post: ankerpost.stand(), uitkomst: await ankerpost.post() });
});

/* Afrekenen met het blok dat op de tweede machine LIGT, in plaats van met een
   blok dat iemand hier overtypt. */
app.post('/api/office/anker/post/reken', officeAuth, async (req, res) => {
  res.json({ ok: true, post: ankerpost.stand(), uitkomst: await ankerpost.afrekenen() });
});

app.post('/api/office/anker/reken', officeAuth, (req, res) => {
  const blok = req.body && req.body.blok;
  if (!blok) return res.status(400).json({ error: 'Geef het eerder weggezette blok mee onder de sleutel blok.' });
  res.json(Object.assign({ ok: true }, ankerdienst.reken(blok)));
});

};
