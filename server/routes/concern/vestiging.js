/* Concern (deelmodule): VESTIGINGEN EN OPERATING UNITS -- een vestiging
   aanmaken, er een zaak aan hangen of loskoppelen, en sluiten.

   Afgesplitst van ../concern.js toen de samenvoeging van twee takken dat bestand
   over de 10 kB van het modulebeleid duwde. Dezelfde naad als ./mensen.js: de
   eigendomscontrole (mijn, mijnVestiging) blijft in het hoofdbestand en komt hier
   binnen als hulp, zodat er geen tweede kopie van ontstaat. */
module.exports = (kern, hulp) => {
  const { app, auth, accounts, vestigingNieuw, vestigingUnit, vestigingUnitLos, vestigingSluit,
    vestigingBeeld, vestigingAlleVanEntiteit } = kern;
  const { mijn, mijnVestiging, stuur, nietGevonden } = hulp;

  app.post('/api/concern/vestigingen', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    res.json({ ok: true, vestigingen: vestigingAlleVanEntiteit(e.id).map(vestigingBeeld) });
  });

  app.post('/api/concern/vestiging/nieuw', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    stuur(res, vestigingNieuw(e, req.body || {}));
  });

  /* De zaak aanwijzen. Het bewijs is hetzelfde als bij de onderneming: een lid
     dat als actieve beheerder in het personeelsregister van die zaak staat. */
  app.post('/api/concern/vestiging/zaak', auth, (req, res) => {
    const v = mijnVestiging(req);
    if (!v) return stuur(res, nietGevonden);
    const beheert = (code) => {
      const acc = req.session && req.session.account;
      if (!acc || acc.id == null || !accounts || !accounts.staffByMember) return false;
      const rij = accounts.staffByMember(code, acc.id);
      return !!(rij && rij.role === 'manager');
    };
    stuur(res, vestigingUnit(v, (req.body || {}).code, beheert));
  });

  app.post('/api/concern/vestiging/zaaklos', auth, (req, res) => {
    const v = mijnVestiging(req);
    if (!v) return stuur(res, nietGevonden);
    stuur(res, vestigingUnitLos(v, (req.body || {}).code));
  });

  app.post('/api/concern/vestiging/sluit', auth, (req, res) => {
    const v = mijnVestiging(req);
    if (!v) return stuur(res, nietGevonden);
    stuur(res, vestigingSluit(v, (req.body || {}).per));
  });
};
