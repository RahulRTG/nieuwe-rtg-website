/* De go-live-deur: de keuring die tot nu toe alleen in een terminal stond.

   `npm run golive` telt acht blokkerende punten, en drie daarvan (het
   verwerkingsregister, het datalek-draaiboek en de achttien vragen) worden
   ingevuld in de boardroom. Wie daar zit, kon dus wel het werk doen maar niet
   zien of het genoeg was -- daarvoor moest iemand anders een script draaien op
   een machine waar de eigenaar niet bij kan. Die knip zit er nu niet meer in.

   Naast de papierwerk-deur en om precies dezelfde reden opgebouwd: de
   controles staan EEN keer (server/golive.js), en zowel het techniekbord als
   de boardroom hangen dezelfde handler op met hun eigen poortwachter. Wat
   `npm run golive` zegt en wat het bord zegt, kan daardoor niet uiteenlopen.

   ACHTER DE EIGENAAR, OVERAL. Deze lijst vertelt wat er aan de opstelling
   mankeert, en dat is een landkaart voor wie kwaad wil: welke sleutel er niet
   staat, of de tweede factor uit is, of de betaalprovider een demo is. Geen
   informatie voor iedereen met een kantoorsessie.

   DE DATABASE WORDT HIER NIET AANGERAAKT. `keuring({ database: false })` slaat
   de echte PostgreSQL-verbinding over: die doet netwerk-I/O met vier seconden
   wachttijd, en een scherm dat ververst hoort dat niet elke keer te doen. De
   keuring zegt dat zelf ook, in plaats van stil een controle over te slaan. */
const { keuring } = require('../golive');

/* prefix : het pad zonder /golive, bv. '/api/office'
   poort   : de middleware(s) die voor elke route komen
   isBaas  : (req) => is dit de eigenaar? (per plek anders bewezen) */
module.exports = function goliveDeur({ app, prefix, poort, isBaas }) {
  const wachters = [].concat(poort || []);
  const alleenBaas = (req, res, next) => {
    if (isBaas && !isBaas(req)) return res.status(403).json({ error: 'Alleen de eigenaar komt bij de go-live-keuring.' });
    next();
  };

  app.post(prefix + '/golive', ...wachters, alleenBaas, async (req, res) => {
    const r = await keuring({ database: false });
    res.json(r);
  });
};
