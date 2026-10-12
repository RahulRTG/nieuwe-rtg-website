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
  /* DE GROEPSBEREKENING (kern/reisgezelschap-opties.js): de reiziger zet opties
     klaar, elke deelnemer ziet per optie of hij voor iedereen past en alleen
     zijn EIGEN reden als hij voor hem niet past. */
  app.post('/api/reis/gezelschap/opties', auth, (req, res) =>
    gez(res, kern.reisgezelschap.groepsbeeld(req.session.key, String((req.body || {}).reis || ''))));
  app.post('/api/reis/gezelschap/opties/zet', auth, (req, res) => {
    const b = req.body || {};
    const r = kern.reisgezelschap.zetOptie(req.session.key, String(b.reis || ''), b.optie, b.id ? String(b.id) : null);
    r && r.error ? res.status(r.status || 400).json({ error: r.error, weerVanaf: r.weerVanaf }) : res.json(r);
  });
  app.post('/api/reis/gezelschap/opties/wis', auth, (req, res) => {
    const b = req.body || {};
    gez(res, kern.reisgezelschap.wisOptie(req.session.key, String(b.reis || ''), String(b.id || '')));
  });
  /* INSTEMMEN OP EEN VASTE VERSIE (kern/reisgezelschap-instemming.js). De
     reiziger legt voor of trekt in; ieder stemt zelf in op de versie en de
     vingerafdruk die hij zag, en kan zijn eigen antwoord terugnemen. */
  const post = (pad, fn) => app.post(pad, auth, (req, res) => {
    const b = req.body || {}, r = fn(req.session.key, String(b.reis || ''), b);
    r && r.error ? res.status(r.status || 400).json({ error: r.error, versie: r.versie }) : res.json(r);
  });
  post('/api/reis/gezelschap/voorstel/leg', (k, reis, b) => kern.reisgezelschap.legVoor(k, reis, String(b.optie || '')));
  post('/api/reis/gezelschap/voorstel/trek', (k, reis) => kern.reisgezelschap.trekVoorstelIn(k, reis));
  post('/api/reis/gezelschap/instem', (k, reis, b) => kern.reisgezelschap.instem(k, reis, b.versie, b.vingerafdruk, b.ja === true));
  post('/api/reis/gezelschap/instem/terug', (k, reis) => kern.reisgezelschap.neemInstemmingTerug(k, reis));
};
