/* Backoffice (deelmodule): DE SCHADUWMETING VAN DE KANTOORDEUR.

   Toont per kantoorroute hoe vaak er een bewezen mens achter de handeling zat
   en hoe vaak niet. De meting zelf woont in kern/kantoor/mensdeur.js en telt
   mee op elk verzoek; deze route leest alleen.

   WAAROM boardroomAuth EN NIET officeAuth. Dit overzicht is de kaart van waar de
   deur openstaat: het noemt precies de routes die vandaag anoniem gebruikt
   worden. Wie die lijst heeft, weet waar hij moet zijn. Een kaart van de gaten
   hoort dus niet leesbaar te zijn voor precies de sessie die het gat IS -- de
   gedeelde kantoorcode. boardroomAuth eist een identiteit waar de kantoordeur
   een anonieme code toelaat (kern/kantoor/boardroom.js), en dat is hier geen
   ceremonie maar de hele reden.

   Er zit een aardigheid in die geen toeval is: deze route meet zichzelf mee.
   Wie hem opvraagt, staat daarna in `kanNuAlDicht` -- want hij kan alleen op
   naam worden aangeroepen. */
module.exports = (octx) => {
  const { kern } = octx;
  const { app, boardroomAuth, mensdeurStand } = kern;

  app.post('/api/office/mensdeur', boardroomAuth, (req, res) => {
    if (typeof mensdeurStand !== 'function') {
      /* Geen lege uitslag verzinnen: een meter die niet bedraad is, is iets
         anders dan een meter die niets zag. Zelfde regel als `ongemeten` in
         KANTOORMACHT.json -- nooit een 0 waar er niet gekeken is. */
      return res.status(503).json({ error: 'De schaduwmeting is niet bedraad in deze server.' });
    }
    res.json(mensdeurStand());
  });
};
