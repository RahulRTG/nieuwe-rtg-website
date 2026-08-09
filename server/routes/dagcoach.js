/* Route "dagcoach": wat er vandaag staat, op volgorde van de klok
   (kern/dagcoach.js).

   EEN route, en die leest alleen. Er is met opzet geen /zet en geen /af: deze
   laag bezit niets, en afvinken gebeurt in de app die het ding wel bezit. Een
   tweede route hier zou een tweede waarheid over dezelfde dag maken. */
module.exports = (kern) => {
  const { app, auth, liveCodename, dagVoor } = kern;

  app.post('/api/dag', auth, (req, res) =>
    res.json(dagVoor(req.session.key, liveCodename(req.session))));
};
