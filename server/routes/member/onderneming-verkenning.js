/* Member-submodule "onderneming/verkenning": intake, verkenning en het plan.

   Apart van ./onderneming.js langs dezelfde naad als ./onderneming-geld.js en
   ./onderneming-bestuur.js -- dat bestand kroop de waarschuwingsband onder de
   10 kB-grens in. Hier staat wat er gebeurt VOOR de onderneming iets is: de
   vragen, het doorrekenen en het vastleggen van het plan. Daar staat wat zij
   IS en wordt. Alle routes gebruiken dezelfde eigendomscontrole, die als `mijn`
   wordt meegegeven. */
module.exports = (kern, mijn, stuur, nietGevonden) => {
  const { app, auth, save, ondernemingIntakeZet, ondernemingIntakeBeeld,
    ondernemingVerkenning, ondernemingPlanVastleggen } = kern;

  app.post('/api/onderneming/intake', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    if (req.body && (req.body.persoon || req.body.idee)) { ondernemingIntakeZet(o, req.body); save(); }
    res.json({ ok: true, intake: ondernemingIntakeBeeld(o) });
  });

  /* Alles in één antwoord, in de juiste volgorde. Zie kern/onderneming/index.js:
     een scherm dat de vier stappen zelf moet ordenen, ordent ze ooit verkeerd. */
  app.post('/api/onderneming/verkenning', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    stuur(res, ondernemingVerkenning(o, (req.body || {}).aannames));
  });

  /* Het plan vastleggen. Dit is de handeling die de fase van 'idee' naar
     'validatie' brengt -- niet een knop die de fase zet, maar het feit
     waar ./fase.js op kijkt. Adviseert de stress test 'niet starten', dan
     weigert dit met 409 tot `tochDoorzetten` meekomt; die keuze wordt dan
     mét het advies in het archief vastgelegd. */
  app.post('/api/onderneming/plan/vastleggen', auth, (req, res) => {
    const o = mijn(req);
    if (!o) return stuur(res, nietGevonden);
    const v = ondernemingVerkenning(o, (req.body || {}).aannames);
    stuur(res, ondernemingPlanVastleggen(o, v.plan, v.stress, req.body || {}));
  });
};
