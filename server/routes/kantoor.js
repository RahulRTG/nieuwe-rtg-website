/* RTG Kantoor, de samenhanglaag: uw werkdag uit alle kantoordomeinen bij
   elkaar (laag 2 uit PLATFORM.md).

   ALLEEN LEZEN. Maken, wijzigen en verwijderen blijft in de gespecialiseerde
   app -- RTG Office, Agenda, Notities en Bestanden -- en deze route heeft er
   met opzet geen tegenhanger voor. Zodra hier een schrijfroute bij komt, is
   het geen samenhanglaag meer maar een vijfde administratie naast vier die het
   al bijhouden (PLATFORM.md, en LAT.md regel 4). */
module.exports = (kern) => {
  const { app, auth } = kern;

  app.post('/api/kantoor/wereld', auth, (req, res) =>
    res.json(kern.kantoorwereld.werkdag(req.session.key)));
};
