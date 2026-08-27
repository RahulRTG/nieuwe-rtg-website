/* Domein "pay", DE INKOMSTEN: wat kwam er binnen, en waarvoor.

   Afgesplitst van ./pay.js omdat dat bestand over de keuringsgrens ging, maar
   net als bij ./pay-terug.js is de snede inhoudelijk: de rest van die routes
   BEWEEGT geld, deze twee LEZEN alleen -- en ze lezen iets waar een mens een
   belastingaangifte op baseert.

   Dat is precies waarom ze apart horen te kunnen falen. Ligt het opladen plat,
   dan hoort iemand nog steeds bij zijn jaarcijfers te kunnen; en een fout in een
   csv-uitdraai hoort nooit een betaling te kunnen raken.

   De grenzen van wat hier gelezen wordt, staan in kern/pay/inkomsten.js en
   reizen mee in elk antwoord -- ook in het csv-bestand, want dat belandt los van
   elk scherm op het bureau van een boekhouder. */
module.exports = (kern, hulp) => {
  const { app, auth, pay, liveCodename } = kern;
  const { geenGast } = hulp;

  /* WAT KWAM ER BINNEN, per jaar. Het gereedschap dat hoort bij de positie van
     dit huis: bij een verkoop tussen leden is de particulier zelf
     verantwoordelijk voor zijn belasting, en RTG geeft de tools. Zonder dit kon
     een lid dertig grootboekregels zien, en daar valt geen aangifte mee te doen.

     De csv is een aparte route en geen vlag op de eerste: een bestand dat je
     doorstuurt heeft een andere levensduur dan een scherm, en het draagt zijn
     eigen grenzen mee (kern/pay/inkomsten.js). */
  app.post('/api/pay/inkomsten', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json(pay.inkomsten(liveCodename(req.session), { jaar: (req.body || {}).jaar }));
  });
  app.post('/api/pay/inkomsten.csv', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const r = pay.inkomstenCsv(liveCodename(req.session), { jaar: (req.body || {}).jaar });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rtg-inkomsten-' + r.jaar + '.csv"');
    res.write(r.csv);
    res.end();
  });
};
