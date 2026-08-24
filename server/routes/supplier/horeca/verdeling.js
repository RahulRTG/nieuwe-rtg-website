/* Horeca OS (deellaag): de VERDELING van de kant van de bediening.

   Tot nu toe had de zaal één manier om een rekening op te delen: `perPersoon:
   n` in horeca/schuif.js -- knip de tafel in n gelijke rekeningen. Dat is
   splitsen, en het is iets anders dan verdelen: bij splitsen ontstaan er nieuwe
   rekeningen, bij verdelen blijft het er één en wordt alleen afgesproken wie
   welk deel betaalt. De gast kon dat laatste al vanaf zijn telefoon (per
   product, per persoon, op percentage); de bediening niet.

   Beide blijven bestaan, want ze beantwoorden verschillende vragen:
   - "wij gaan apart betalen, zet het op twee rekeningen"  -> schuif.js
   - "hij betaalt de wijn, de rest doen we samen"          -> hier

   De rekensom staat in kern/horeca/verdeling.js en is dezelfde die de gastdeur
   gebruikt. Hier staat alleen de poort, de naam van wie het deed, en het
   opslaan. */
'use strict';

module.exports = (kern) => {
  const { app, save, supplierAuth, logActivity, sseToSupplier, horeca } = kern;
  const { nu } = horeca;
  const verdeling = require('../../../kern/horeca/verdeling')({ horeca });
  const gezelschap = require('../../../kern/horeca/gezelschap')({ horeca, schoon: kern.schoon });

  app.post('/api/supplier/horeca/rekening/verdeel', supplierAuth, (req, res) => {
    const r = kern.horecaRekVan(req, res); if (!r) return;
    const uit = verdeling.bereken(r, req.body || {});
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });

    r.verdeling = Object.assign({}, uit.verdeling, { at: nu(), door: req.actor.name });
    /* Het auditspoor van de rekening draagt WIE het deed. Een verdeling die de
       bediening maakt, hoort niet als "gast" in het spoor te staan -- dan is
       achteraf niet na te gaan wie wat heeft afgesproken. */
    if (!Array.isArray(r.audit)) r.audit = [];
    r.audit.push({ at: nu(), actor: req.actor.name, bron: 'zaak', apparaat: null,
      wat: 'verdeling', van: null,
      naar: uit.verdeling.wijze + ' over ' + uit.verdeling.delen.length, reden: null });
    if (r.audit.length > 400) r.audit = r.audit.slice(-400);
    /* De gastreis schuift hier BEWUST niet op. Die lijn is wat de gast op zijn
       eigen scherm ziet van zijn avond, en die hoort te bewegen doordat híj iets
       doet -- precies zoals de zaalbetaling hem ook niet aanraakt. */

    save();
    logActivity(req.supplier.code, req.actor, 'verdeelde de rekening op ' + (r.tafel || r.kanaal) +
      ' (' + uit.verdeling.wijze + ', ' + uit.verdeling.delen.length + ' delen)');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });

    /* De namen erbij, want een scherm dat "nr 3 betaalt 18,50" toont laat de
       bediening zoeken wie dat ook alweer was. */
    res.json({ ok: true, wijzen: verdeling.WIJZEN,
      verdeling: Object.assign({}, r.verdeling, {
        delen: r.verdeling.delen.map((d) => Object.assign({}, d, { handle: gezelschap.handleVan(r, d.nr) }))
      }),
      rekening: kern.horecaPubliek(r) });
  });
};
