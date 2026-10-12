'use strict';
/* De anonieme talentmatch aan de kant van de werkgever: interesse tonen of de
   match sluiten. Afgesplitst uit ./sollicitaties.js, dat over de sollicitatie
   en het besluit gaat. De opslag komt als functie mee (`interesses`), zodat er
   geen tweede bestand met een eigen greep in de database bijkomt -- dezelfde
   vorm als ./sollchat.js. Werving is van de manager: de route, de logregel en
   het sync-signaal (kern/leverancier/beschermdesoorten.js). */
const { datum: klokDatum } = require('../../../lib/klok');
module.exports = (kern, { interesses }) => {
  const { app, logActivity, managerOnly, save, sseToSupplier, supplierAuth } = kern;

  app.post('/api/supplier/talent/match', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const lijst = interesses();
    const match = lijst.find(x => x.id === req.body.id && x.supplierCode === req.supplier.code);
    if (!match || match.status !== 'interesse') return res.status(404).json({ error: 'Deze talentmatch is niet meer beschikbaar.' });
    match.status = req.body.action === 'interesse' ? 'wederzijds' : 'afgewezen';
    match.beslistAt = klokDatum().toISOString();
    save();
    logActivity(req.supplier.code, req.actor, (match.status === 'wederzijds' ? 'toonde wederzijdse interesse in ' : 'sloot een talentmatch voor ') + match.func, 'werving');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'team' }, { staffId: null });
    res.json({ ok: true, status: match.status });
  });
};
