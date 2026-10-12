/* WAT IEDER VOOR ZICHZELF OPGEEFT bij een gezamenlijke reis
   (kern/reisgezelschap-opgave.js): plafond, data en voorkeuren. Een eigen
   bestand naast ./reis.js, dat anders over de grens van keuringsregel 13 ging;
   het krijgt dezelfde kern en hetzelfde antwoordhulpje mee.

   Elke route hier gaat over de EIGEN opgave van de sessie. Er is met opzet
   geen route die de opgave van een ander teruggeeft, en `voortgang` is een
   aantal zonder namen. */
module.exports = (kern, gez) => {
  const { app, auth } = kern;
  app.post('/api/reis/gezelschap/opgave', auth, (req, res) =>
    gez(res, kern.reisgezelschap.mijnOpgave(req.session.key, String((req.body || {}).reis || ''))));
  app.post('/api/reis/gezelschap/opgave/zet', auth, (req, res) => {
    const b = req.body || {};
    gez(res, kern.reisgezelschap.zetOpgave(req.session.key, String(b.reis || ''), b.opgave));
  });
  app.post('/api/reis/gezelschap/opgave/wis', auth, (req, res) =>
    gez(res, kern.reisgezelschap.wisOpgave(req.session.key, String((req.body || {}).reis || ''))));
  app.post('/api/reis/gezelschap/opgave/voortgang', auth, (req, res) =>
    gez(res, kern.reisgezelschap.opgaveVoortgang(req.session.key, String((req.body || {}).reis || ''))));
};
