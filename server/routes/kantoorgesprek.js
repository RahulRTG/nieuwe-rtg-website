/* Routes "kantoorgesprek": de backoffice binnenkomen door met Rahul te praten.

   Bewust VOOR de inlog (wie hier aanklopt heeft nog geen sessie), dus met
   hetzelfde slot als de kantoordeur zelf: de kern telt elke misslag in de bucket
   'office:<ip>', dezelfde als /api/office/login. De chat is daarmee geen
   zachtere deur dan het codeveld dat hij vervangt.

   Er komt hier NOOIT iets terug wat het lid intypte; zie kern/kantoorgesprek.js. */
module.exports = (kern) => {
  const { app, kantoorStart, kantoorZeg } = kern;

  app.post('/api/kantoor/gesprek/start', (req, res) => {
    const r = kantoorStart(req.ip);
    res.status(r.status || 200).json(r);
  });

  app.post('/api/kantoor/gesprek/zeg', (req, res) => {
    const r = kantoorZeg(String((req.body || {}).id || ''), (req.body || {}).tekst, req.ip, req);
    res.status(r.status || 200).json(r);
  });
};
