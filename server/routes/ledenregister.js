/* Route voor het ledenregister: het complete ledenoverzicht op codenaam,
   gesplitst per stad/land/alfabet/geslacht en pas, met de omzet per pas en de
   30%-foundationsplit. Achter de boardroom-poort: de omzet- en splitcijfers zijn
   gevoelig, dus alleen de eigenaar (of wie hij toegang gaf) ziet ze. */
module.exports = (kern) => {
  const { app, boardroomAuth, ledenregister } = kern;
  app.post('/api/office/ledenregister', boardroomAuth, (req, res) => {
    try { res.json(ledenregister.register(req.body || {})); }
    catch (e) { console.error('[ledenregister]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
