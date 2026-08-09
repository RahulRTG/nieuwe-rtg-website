/* Zaak Command, deel bestuur: het beleid van de zaak en zijn journaal.

   HET BELEID IS VAN DE ZAAK, niet van RTG. De grenzen die bepalen wat de
   assistent zelf mag rechtzetten, hoe lang een uitzondering mag liggen en na
   hoeveel minuten een onaangeroerde bestelling een signaal wordt, staan per
   zaak. Een restaurant en een jachthaven vinden niet hetzelfde "te lang", en
   dat hoort geen platformbesluit te zijn.

   GEEN VIER OGEN HIER, en dat is een bewuste afwijking van de RTG-kant. Daar
   vraagt een zware regel een tweede paar ogen omdat er altijd meer dan één mens
   met bevoegdheid is. Een zaak met één eigenaar heeft die tweede mens niet; een
   vier-ogen-eis zou daar betekenen dat de knop nooit werkt. De rem is hier een
   andere: elke wijziging krijgt een versie, een reden en een regel in het
   journaal van de zaak, en er is één knop terug.

   HET JOURNAAL IS VAN DE ZAAK ALLEEN. Eigen hashketen, eigen vak. Geen enkele
   regel van RTG of van een andere zaak staat erin, en andersom evenmin. */
module.exports = ({ app, supplierAuth, managerOnly, veilig, laag, wie }) => {

  app.post('/api/supplier/command/beleid', supplierAuth, (req, res) => veilig(res, () =>
    ({ regels: laag(req).beleid.alles() })));

  app.post('/api/supplier/command/beleid/zet', supplierAuth, (req, res) => veilig(res, () => {
    if (!managerOnly(req, res)) return null;
    return laag(req).beleid.zet(String(req.body.id || ''), req.body.waarde, wie(req), req.body.reden);
  }));

  app.post('/api/supplier/command/beleid/terug', supplierAuth, (req, res) => veilig(res, () => {
    if (!managerOnly(req, res)) return null;
    return laag(req).beleid.terug(String(req.body.id || ''), wie(req), req.body.reden);
  }));

  app.post('/api/supplier/command/beleid/geschiedenis', supplierAuth, (req, res) => veilig(res, () =>
    laag(req).beleid.geschiedenis(String(req.body.id || ''))));

  /* De gegevenskwaliteit en de kennisgraaf van de zaak. Voor het management:
     ze tonen de samenhang over de hele zaak heen, en dat is dezelfde grens die
     het journaal hieronder trekt. */
  app.post('/api/supplier/command/kwaliteit', supplierAuth, (req, res) => veilig(res, () => {
    if (!managerOnly(req, res)) return null;
    return laag(req).kwaliteit.meet();
  }));
  app.post('/api/supplier/command/graaf', supplierAuth, (req, res) => veilig(res, () => {
    if (!managerOnly(req, res)) return null;
    return laag(req).graaf.vorm();
  }));

  /* Het journaal, met de ketencontrole erbij. Een spoor waarvan je de heelheid
     niet kunt nakijken, is een lijst die je op zijn woord moet geloven. */
  app.post('/api/supplier/command/journaal', supplierAuth, (req, res) => veilig(res, () => {
    if (!managerOnly(req, res)) return null;
    const c = laag(req);
    return { regels: c.journaal.recent(Number(req.body.n || 60), {
      actor: req.body.actor, actie: req.body.actie, niveau: req.body.niveau }),
      aantal: c.journaal.aantal(), venster: c.journaal.venster(), keten: c.journaal.controleer() };
  }));

  app.post('/api/supplier/command/journaal/herbeleef', supplierAuth, (req, res) => veilig(res, () => {
    if (!managerOnly(req, res)) return null;
    return laag(req).journaal.herbeleef(req.body.van, req.body.tot,
      { objectType: req.body.type, objectId: req.body.id });
  }));
};
