/* De beperkte schermcredential heeft eigen ingangen. Dit contract bevat
   geen spelmutaties of toegang tot leden-/gezinsaccounts. */
const rem = require('../rem');
module.exports = (ctx) => {
  const { app, projectieKoppel, projectieStand, veilig } = ctx;
  /* HET GEDEELDE SCHERM blijft zonder ledenaccount, maar niet zonder een
     begrensde credential (eigenaarsbesluit 19 oktober 2026, uitzondering 6):
     de tv koppelt met de eenmalige code die een INGELOGD lid aanmaakte
     (projectie-open vraagt auth), en hangt zo aan dat account. De eenmalige koppeling en de blijvende schermsessie
     reizen uitsluitend in POST-lijven. Zo belandt geen geheim in een URL,
     accesslog of Referer. Beide antwoorden zijn no-store. */
  app.post('/api/projectie/koppel', rem({ windowMs: 60000, limit: 20 }), (req, res) => {
    res.set('Cache-Control', 'no-store'); res.set('Pragma', 'no-cache');
    veilig(res, () => projectieKoppel(String((req.body || {}).code || '')),
      'projectie-koppel', req);
  });
  app.post('/api/projectie/kijk', rem({ windowMs: 60000, limit: 90 }), (req, res) => {
    res.set('Cache-Control', 'no-store'); res.set('Pragma', 'no-cache');
    veilig(res, () => projectieStand(String((req.body || {}).token || '')),
      'projectie-kijk', req);
  });
  /* Oude 32-bits codes worden nooit gemigreerd naar werkende toegang. Deze
     route blijft alleen als expliciete, cacheloze eindstatus voor oude tv's. */
  app.get('/api/projectie/:code', rem({ windowMs: 60000, limit: 20 }), (req, res) => {
    res.set('Cache-Control', 'no-store'); res.set('Pragma', 'no-cache');
    res.status(410).json({ error: 'Deze oude schermcode is gesloten. Vraag een speler om een nieuwe code.' });
  });

};
