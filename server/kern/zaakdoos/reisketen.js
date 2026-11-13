/* De huidige reisketen heeft geen gekwalificeerde offline noodprojectie of
   gedelegeerde doosautoriteit. Online blijft de bestaande proxy leidend.
   Bij uitval is een oude lokale rij geen actuele persoonlijke bevoegdheid;
   weigeren gebeurt vóór ontvangstcache, domeinwerk en journaling. */
'use strict';
const { isReisketenPad } = require('../../lib/idemsleutels-reisketen');
module.exports = doos => (req, res, next) => {
  if (!doos.actief || !isReisketenPad(req.path)) return next();
  // Deze middleware wordt alleen bereikt als de cloudproxy niet antwoordde.
  // Ook een onbekende modus of proxyfout mag geen lokale reisautoriteit geven.
  res.setHeader('Cache-Control', 'no-store');
  return res.status(503).json({ code: 'reisketen-online-vereist',
    error: 'De reisketen vraagt een actuele online broncontrole. Deze Zaakdoos kan geen reisbesluit bewaren of naspelen. Herstel de verbinding en lees de reis opnieuw.' });
};
