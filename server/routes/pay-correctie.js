/* Domein "pay", DE CORRECTIE: een betaalde factuur terugboeken.

   Afgesplitst van ./pay.js omdat dat bestand over de keuringsgrens ging, maar
   de snede is inhoudelijk -- zelfde reden als bij ./pay-terug.js. Dit is de
   enige route in de betaallaag die geld van het HUIS naar een lid beweegt op
   gezag van een medewerker, en dat hoort niet weggestopt tussen de ledenknoppen.

   De terugweg van /api/pay/saldo. HERSTELBESLUIT.json verklaart dat pad als
   COMPENSATABLE; dit is de uitvoerder die daarbij hoort. Wat hij precies wel en
   niet doet staat in kern/factuurcorrectie.js -- kort: hij draait de heenweg
   niet terug maar boekt ernaast.

   DRIE GRENZEN ZITTEN IN DEZE ROUTE ZELF EN NIET IN DE KERN:

   1. ACHTER officeAuth EN NIET ACHTER auth. Een lid dat zijn eigen betaalde
      factuur kan terugdraaien is een kas die iedereen mag bedienen. Een lid
      MELDT, een mens van het kantoor corrigeert -- zelfde grens als
      kern/horeca/correctie.js.
   2. EEN GEDEELDE KANTOORCODE VOLSTAAT NIET. `boardroomWie` geeft dan `null` en
      de correctie gaat niet door. Dat is dezelfde grens die de toelatingsproef
      vond: een spoor dat eindigt bij een code die iedereen kent, is geen spoor.
      Let op de vorm -- `boardroomWie` geeft een SLEUTEL en geen object met een
      naam. Die val kostte kern/vertegenwoordiging een ronde met achttien groene
      unittoetsen die hem geen van alle zagen.
   3. DE CODENAAM WORDT AFGELEID EN KOMT NIET UIT HET LICHAAM. Stond hij daar,
      dan bepaalt de aanroeper op WELKE wallet het geld terechtkomt, los van wie
      de factuur bezit; een typefout betaalt dan een vreemde uit. Nu hangt het
      geld vast aan de eigenaar van de factuur. */
module.exports = (kern, { stuur }) => {
  const { app, officeAuth, corrigeerFactuur, boardroomWie, accounts, codenaamVan } = kern;

  app.post('/api/office/pay/factuurcorrectie', officeAuth, async (req, res) => {
    if (typeof corrigeerFactuur !== 'function')
      return res.status(501).json({ error: 'De factuurcorrectie draait hier niet.' });
    const door = boardroomWie ? boardroomWie(req) : null;
    if (!door)
      return res.status(403).json({ error: 'Deze handeling vraagt een medewerker met een eigen account; een gedeelde kantoorcode volstaat niet.' });
    const u = accounts.getUserById(Number((req.body || {}).userId));
    if (!u) return res.status(404).json({ error: 'Account niet gevonden.' });
    stuur(res, await corrigeerFactuur({
      own: true, accountId: u.id, wie: 'acc:' + u.id, tier: u.tier || null,
      codenaam: codenaamVan ? codenaamVan('user-' + u.id) : null,
      invoiceId: String(req.body.invoiceId || ''),
      grond: String(req.body.grond || ''),
      reden: String(req.body.reden || ''),
      door
    }));
  });

  /* Wat een scherm moet weten om het formulier te kunnen tonen: de gronden, en
     wat er met opzet niet bestaat. Alleen lezen, en alleen voor het kantoor. */
  app.get('/api/office/pay/factuurcorrectie/gronden', officeAuth, (req, res) => {
    const g = require('../kern/factuurcorrectie-gronden');
    res.json({ gronden: g.GRONDEN, nietGebouwd: g.NIET_GEBOUWD });
  });
};
